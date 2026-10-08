// src/server/staffing-constraints.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isoDateToDate } from '@/lib/dates';
import {
  createTestClient,
  expectPgError,
  houseIds,
  insertAssignment,
  insertEmployee,
  insertMembership,
  insertPosition,
  resetData,
} from '../../test/db/helpers';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

describe('role catalogue', () => {
  it('has the nine roles and tolerates a re-run', async () => {
    expect(await db.occupationalRole.count()).toBe(9);
    await db.$executeRawUnsafe(`INSERT INTO "occupational_roles" ("code", "label") VALUES ('CT', 'Corretor') ON CONFLICT ("code") DO NOTHING`);
    expect(await db.occupationalRole.count()).toBe(9);
  });
});

describe('positions', () => {
  it('trims labels and keeps them unique per House ignoring case', async () => {
    const { pf, ca } = await houseIds(db);
    const id = await insertPosition(db, pf, 'CT', '  CT nit ');
    expect((await db.position.findUniqueOrThrow({ where: { id } })).label).toBe('CT nit');
    await expectPgError(insertPosition(db, pf, 'CT', ' ct NIT '), '23505');
    await expect(insertPosition(db, ca, 'CT', 'CT nit')).resolves.toBeTypeOf('string');
  });

  it('compares accented labels case-insensitively', async () => {
    const { pf } = await houseIds(db);
    await insertPosition(db, pf, 'ER', 'Àrea');
    await expectPgError(insertPosition(db, pf, 'ER', 'àrea'), '23505');
  });

  it('freezes House and role but allows relabelling', async () => {
    const { pf, ca } = await houseIds(db);
    const id = await insertPosition(db, pf, 'ER', 'ER 1');
    await expectPgError(db.position.update({ where: { id }, data: { roleCode: 'CT' } }), 'CI002');
    await expectPgError(db.position.update({ where: { id }, data: { houseId: ca } }), 'CI002');
    const relabelled = await db.position.update({ where: { id }, data: { label: 'ER matins' } });
    expect(relabelled).toMatchObject({ id, label: 'ER matins', labelKey: 'er matins', roleCode: 'ER', houseId: pf });
  });
});

describe('position assignments', () => {
  async function setup() {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    const marta = await insertEmployee(db, 'Marta Soler');
    await insertMembership(db, ana, pf, '2026-01-01');
    await insertMembership(db, marta, pf, '2025-09-01');
    const er1 = await insertPosition(db, pf, 'ER', 'ER 1');
    const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
    return { pf, ca, ana, marta, er1, er2 };
  }

  it('rejects a second occupant on overlapping dates and accepts the adjacent day (AC-005)', async () => {
    const { pf, ana, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01', '2026-06-30');
    await expectPgError(
      db.$executeRaw`INSERT INTO "position_assignments" ("employee_id", "position_id", "house_id", "starts_on") VALUES (${ana}::uuid, ${er1}::uuid, ${pf}::uuid, '2026-06-30')`,
      '23P01',
    );
    await expect(insertAssignment(db, ana, er1, pf, '2026-07-01')).resolves.toBeTypeOf('string');
  });

  it('rejects two positions for one employee on the same date', async () => {
    const { pf, ana, er1, er2 } = await setup();
    await insertAssignment(db, ana, er1, pf, '2026-01-01');
    await expectPgError(insertAssignment(db, ana, er2, pf, '2026-03-01'), '23P01');
  });

  it("rejects an assignment stored with another House than its position's", async () => {
    const { ca, ana, er2 } = await setup();
    await expectPgError(insertAssignment(db, ana, er2, ca, '2027-01-01'), '23503');
  });

  it('rejects an end before the start', async () => {
    const { pf, ana, er1 } = await setup();
    await expectPgError(insertAssignment(db, ana, er1, pf, '2026-03-01', '2026-02-01'), '23514');
  });

  it('rejects an open assignment on a finite membership (AC-007)', async () => {
    const { pf, er1 } = await setup();
    const pol = await insertEmployee(db, 'Pol Mas');
    await insertMembership(db, pol, pf, '2026-01-01', '2026-06-30');
    await expectPgError(insertAssignment(db, pol, er1, pf, '2026-06-01'), 'CI001');
  });

  it('rejects shortening a membership below its assignment, checked at commit', async () => {
    const { pf, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await expectPgError(
      // An explicit transaction: Prisma hides a commit-time error behind P2028 for a lone implicit one.
      db.$transaction((tx) => tx.houseMembership.updateMany({ where: { employeeId: marta }, data: { endsOn: isoDateToDate('2026-08-31') } })),
      'CI001',
    );
  });

  it('accepts closing membership and assignment in either order inside one transaction', async () => {
    const { pf, marta, er1 } = await setup();
    const assignment = await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await db.$transaction(async (tx) => {
      await tx.houseMembership.updateMany({ where: { employeeId: marta }, data: { endsOn: isoDateToDate('2026-08-31') } });
      await tx.positionAssignment.update({ where: { id: assignment }, data: { endsOn: isoDateToDate('2026-08-31') } });
    });
    expect((await db.positionAssignment.findUniqueOrThrow({ where: { id: assignment } })).endsOn).toEqual(isoDateToDate('2026-08-31'));
  });

  it('deleting an employee removes memberships, assignments and the link, and keeps positions and grants', async () => {
    const { pf, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await db.employeeAccountLink.create({ data: { employeeId: marta, clerkUserId: 'user_marta' } });
    await db.accessGrant.create({ data: { clerkUserId: 'user_marta', role: 'director' } });
    await db.employee.delete({ where: { id: marta } });
    expect(await db.houseMembership.count({ where: { employeeId: marta } })).toBe(0);
    expect(await db.positionAssignment.count({ where: { employeeId: marta } })).toBe(0);
    expect(await db.employeeAccountLink.count()).toBe(0);
    expect(await db.position.count({ where: { id: er1 } })).toBe(1);
    expect(await db.accessGrant.count()).toBe(1);
  });
});
