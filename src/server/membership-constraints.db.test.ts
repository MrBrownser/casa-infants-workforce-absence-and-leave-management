import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestClient,
  expectPgError,
  houseIds,
  insertEmployee,
  insertMembership,
  resetData,
} from '../../test/db/helpers';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

describe('SPEC-001 membership constraints on a real database', () => {
  it('has both Houses after the migrations', async () => {
    const houses = await db.house.findMany({ orderBy: { slug: 'asc' } });
    expect(houses.map((h) => h.slug)).toEqual(['carme-aymerich', 'paulo-freire']);
  });

  it('rejects an overlapping membership inserted with SQL', async () => {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01', '2026-06-30');
    await expectPgError(
      db.$executeRaw`INSERT INTO "house_memberships" ("employee_id", "house_id", "starts_on") VALUES (${ana}::uuid, ${ca}::uuid, '2026-06-15')`,
      '23P01',
    );
  });

  it('rejects an end before the start', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await expectPgError(insertMembership(db, ana, pf, '2026-03-01', '2026-02-01'), '23514');
  });

  it('accepts adjacent periods', async () => {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01', '2026-06-30');
    await insertMembership(db, ana, ca, '2026-07-01');
    expect(await db.houseMembership.count({ where: { employeeId: ana } })).toBe(2);
  });
});
