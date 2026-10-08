// src/server/staffing-store-transfer.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dateToIsoDate } from '@/lib/dates';
import { createTestClient, ctx, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { endMembership, previewEndMembership, previewTransfer, transfer } from './staffing-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

const iso = (d: Date | null) => (d ? dateToIsoDate(d) : null);

async function anaHoldingEr1() {
  const { pf, ca } = await houseIds(db);
  const ana = await insertEmployee(db, 'Ana Puig');
  const membership = await insertMembership(db, ana, pf, '2026-01-01');
  const er1 = await insertPosition(db, pf, 'ER', 'ER 1');
  const erA = await insertPosition(db, ca, 'ER', 'ER A');
  const assignment = await insertAssignment(db, ana, er1, pf, '2026-01-01');
  return { pf, ca, ana, membership, er1, erA, assignment };
}

async function snapshot(employeeId: string) {
  const memberships = await db.houseMembership.findMany({ where: { employeeId }, orderBy: { startsOn: 'asc' } });
  const assignments = await db.positionAssignment.findMany({ where: { employeeId }, orderBy: { startsOn: 'asc' } });
  return {
    memberships: memberships.map((m) => [m.houseId, iso(m.startsOn), iso(m.endsOn)]),
    assignments: assignments.map((a) => [a.positionId, iso(a.startsOn), iso(a.endsOn)]),
  };
}

describe('transfer', () => {
  it('closes and opens membership and assignment atomically (AC-009)', async () => {
    const { pf, ca, ana, er1, erA } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: erA };
    const preview = await previewTransfer(db, pf, request);
    await transfer(db, ctx(), pf, { ...request, planToken: preview.planToken });
    expect(await snapshot(ana)).toEqual({
      memberships: [[pf, '2026-01-01', '2026-06-30'], [ca, '2026-07-01', null]],
      assignments: [[er1, '2026-01-01', '2026-06-30'], [erA, '2026-07-01', null]],
    });
  });

  it('transfers without a destination position (AC-011)', async () => {
    const { pf, ca, ana } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: null };
    const preview = await previewTransfer(db, pf, request);
    const { result } = await transfer(db, ctx(), pf, { ...request, planToken: preview.planToken });
    expect(result.assignmentId).toBeNull();
    expect((await snapshot(ana)).assignments).toHaveLength(1);
  });

  it('changes nothing when the destination position is occupied (AC-010)', async () => {
    const { pf, ca, ana, erA } = await anaHoldingEr1();
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, ca, '2025-09-01');
    await insertAssignment(db, pau, erA, ca, '2025-09-01');
    const before = await snapshot(ana);
    await expect(
      previewTransfer(db, pf, { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: erA }),
    ).rejects.toMatchObject({ reason: 'position-occupied' });
    expect(await snapshot(ana)).toEqual(before);
  });

  it('cannot transfer the destination membership on a second submit (AC-012)', async () => {
    const { pf, ca, ana } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: null };
    const preview = await previewTransfer(db, pf, request);
    const operation = ctx();
    await transfer(db, operation, pf, { ...request, planToken: preview.planToken });
    await expect(transfer(db, operation, pf, { ...request, planToken: preview.planToken })).resolves.toMatchObject({ status: 'already-applied' });
    await expect(transfer(db, ctx(), pf, { ...request, planToken: preview.planToken })).rejects.toMatchObject({ reason: 'not-ongoing' });
    expect(await db.houseMembership.count({ where: { employeeId: ana } })).toBe(2);
  });

  it('refuses to cancel a future source assignment (AC-013)', async () => {
    const { pf, ca, ana, assignment } = await anaHoldingEr1();
    await db.positionAssignment.update({ where: { id: assignment }, data: { endsOn: new Date('2026-03-31T00:00:00Z') } });
    const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
    await insertAssignment(db, ana, er2, pf, '2026-07-15');
    const before = await snapshot(ana);
    await expect(
      previewTransfer(db, pf, { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: null }),
    ).rejects.toMatchObject({ reason: 'future-assignment-blocks' });
    expect(await snapshot(ana)).toEqual(before);
  });
});

describe('endMembership', () => {
  it('closes the crossing assignment with the membership (AC-016)', async () => {
    const { pf, ana, membership, er1 } = await anaHoldingEr1();
    const preview = await previewEndMembership(db, pf, { membershipId: membership, endsOn: '2026-08-31' });
    expect(preview.plan.closes.map((c) => c.kind)).toEqual(['assignment', 'membership']);
    await endMembership(db, ctx(), pf, { membershipId: membership, endsOn: '2026-08-31', planToken: preview.planToken });
    expect(await snapshot(ana)).toEqual({ memberships: [[pf, '2026-01-01', '2026-08-31']], assignments: [[er1, '2026-01-01', '2026-08-31']] });
  });

  it('is blocked by an assignment that starts after the end', async () => {
    const { pf, ana, membership, assignment } = await anaHoldingEr1();
    await db.positionAssignment.update({ where: { id: assignment }, data: { endsOn: new Date('2026-03-31T00:00:00Z') } });
    const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
    await insertAssignment(db, ana, er2, pf, '2026-09-15');
    await expect(previewEndMembership(db, pf, { membershipId: membership, endsOn: '2026-08-31' })).rejects.toMatchObject({
      reason: 'future-assignment-blocks',
    });
  });
});

describe('confirm safety', () => {
  it('is stale when the destination position is taken after the preview', async () => {
    const { pf, ca, ana, erA } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: erA };
    const preview = await previewTransfer(db, pf, request);
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, ca, '2025-09-01');
    await insertAssignment(db, pau, erA, ca, '2025-09-01');
    const before = await snapshot(ana);
    await expect(transfer(db, ctx(), pf, { ...request, planToken: preview.planToken })).rejects.toMatchObject({ reason: 'stale' });
    expect(await snapshot(ana)).toEqual(before);
  });

  it('is stale when the membership changed after the end preview', async () => {
    const { pf, ana, membership } = await anaHoldingEr1();
    const preview = await previewEndMembership(db, pf, { membershipId: membership, endsOn: '2026-08-31' });
    await db.positionAssignment.updateMany({ where: { employeeId: ana }, data: { endsOn: new Date('2026-05-31T00:00:00Z') } });
    const before = await snapshot(ana);
    await expect(
      endMembership(db, ctx(), pf, { membershipId: membership, endsOn: '2026-08-31', planToken: preview.planToken }),
    ).rejects.toMatchObject({ reason: 'stale' });
    expect(await snapshot(ana)).toEqual(before);
  });

  it('rolls back every write, receipt included, when the last write fails (tasks 4.5)', async () => {
    const { pf, ca, ana, erA } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: erA };
    const preview = await previewTransfer(db, pf, request);
    const before = await snapshot(ana);
    await db.$executeRawUnsafe(`CREATE FUNCTION test_fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_fail_assignment BEFORE INSERT ON "position_assignments" FOR EACH ROW EXECUTE FUNCTION test_fail_assignment()`);
    try {
      const operation = ctx();
      await expect(transfer(db, operation, pf, { ...request, planToken: preview.planToken })).rejects.toBeDefined();
      expect(await snapshot(ana)).toEqual(before);
      expect(await db.operationReceipt.count({ where: { id: operation.operationId } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER test_fail_assignment ON "position_assignments"');
      await db.$executeRawUnsafe('DROP FUNCTION test_fail_assignment()');
    }
  });
});
