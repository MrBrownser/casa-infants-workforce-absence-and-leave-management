// src/server/staffing-store-handover.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dateToIsoDate } from '@/lib/dates';
import { StaffingError } from '@/lib/staffing-error';
import { createTestClient, ctx, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { endAssignment, handover, previewHandover } from './staffing-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

async function setup() {
  const { pf, ca } = await houseIds(db);
  const ana = await insertEmployee(db, 'Ana Puig');
  const marta = await insertEmployee(db, 'Marta Soler');
  const pol = await insertEmployee(db, 'Pol Mas');
  for (const id of [ana, marta, pol]) await insertMembership(db, id, pf, '2025-09-01');
  const er1 = await insertPosition(db, pf, 'ER', 'ER 1');
  const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
  return { pf, ca, ana, marta, pol, er1, er2 };
}

const periodsOf = async (positionId: string) =>
  (await db.positionAssignment.findMany({ where: { positionId }, orderBy: { startsOn: 'asc' }, include: { employee: true } })).map((a) => [
    a.employee.fullName,
    dateToIsoDate(a.startsOn),
    a.endsOn ? dateToIsoDate(a.endsOn) : null,
  ]);

describe('handover', () => {
  it('previews then replaces the occupant on the same position (AC-004)', async () => {
    const { pf, ana, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    expect(preview.names.employees[marta]).toBe('Marta Soler');
    await handover(db, ctx(), pf, { ...request, planToken: preview.planToken });
    expect(await periodsOf(er1)).toEqual([
      ['Marta Soler', '2025-09-01', '2026-06-30'],
      ['Ana Puig', '2026-07-01', null],
    ]);
  });

  it('rejects a confirm whose plan changed since the preview (stale)', async () => {
    const { pf, ana, marta, er1 } = await setup();
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    // A later occupant appears after the preview: the plan would now differ.
    await insertAssignment(db, marta, er1, pf, '2026-09-01');
    await expect(handover(db, ctx(), pf, { ...request, planToken: preview.planToken })).rejects.toMatchObject({ reason: 'stale' });
    expect(await db.positionAssignment.count({ where: { employeeId: ana } })).toBe(0);
  });

  it('rejects a confirm as stale when an open occupant appears across the start date', async () => {
    const { pf, ana, marta, er1 } = await setup();
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await expect(handover(db, ctx(), pf, { ...request, planToken: preview.planToken })).rejects.toMatchObject({ reason: 'stale' });
  });

  it('reports a retried confirm as already applied (Review Focus 3)', async () => {
    const { pf, ana, er1 } = await setup();
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    const operation = ctx();
    const first = await handover(db, operation, pf, { ...request, planToken: preview.planToken });
    const second = await handover(db, operation, pf, { ...request, planToken: preview.planToken });
    expect(second).toEqual({ status: 'already-applied', result: first.result });
  });

  it('lets one of two concurrent assignments to a vacant position win (AC-006)', async () => {
    const { pf, ana, pol, er1 } = await setup();
    const forAna = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const forPol = { ...forAna, employeeId: pol };
    const [tokenAna, tokenPol] = await Promise.all([previewHandover(db, pf, forAna), previewHandover(db, pf, forPol)]);
    const results = await Promise.allSettled([
      handover(db, ctx(), pf, { ...forAna, planToken: tokenAna.planToken }),
      handover(db, ctx(), pf, { ...forPol, planToken: tokenPol.planToken }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(StaffingError);
    expect(['position-occupied', 'stale']).toContain((failure.reason as StaffingError).reason);
    expect(await db.positionAssignment.count({ where: { positionId: er1 } })).toBe(1);
  });

  it('lets one of two concurrent positions for the same person win (AC-006)', async () => {
    const { pf, ana, er1, er2 } = await setup();
    const one = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const two = { ...one, positionId: er2 };
    const [p1, p2] = await Promise.all([previewHandover(db, pf, one), previewHandover(db, pf, two)]);
    const results = await Promise.allSettled([
      handover(db, ctx(), pf, { ...one, planToken: p1.planToken }),
      handover(db, ctx(), pf, { ...two, planToken: p2.planToken }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.positionAssignment.count({ where: { employeeId: ana } })).toBe(1);
  });


  it('serialises two crossed handovers without an unexpected error (design D4)', async () => {
    const { pf, ana, marta, er1, er2 } = await setup();
    await insertAssignment(db, ana, er1, pf, '2025-09-01');
    await insertAssignment(db, marta, er2, pf, '2025-09-01');
    // Marta takes er1 (displacing Ana) while Ana takes er2 (displacing Marta): crossed.
    const a = { positionId: er1, employeeId: marta, startsOn: '2026-07-01', endsOn: null };
    const b = { positionId: er2, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const [pa, pb] = await Promise.all([previewHandover(db, pf, a), previewHandover(db, pf, b)]);
    const results = await Promise.allSettled([
      handover(db, ctx(), pf, { ...a, planToken: pa.planToken }),
      handover(db, ctx(), pf, { ...b, planToken: pb.planToken }),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(StaffingError);
        expect(['stale', 'position-occupied', 'employee-has-position']).toContain((r.reason as StaffingError).reason);
      }
    }
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('rejects a position from the other House', async () => {
    const { pf, ca, ana } = await setup();
    const erA = await insertPosition(db, ca, 'ER', 'ER A');
    await expect(previewHandover(db, pf, { positionId: erA, employeeId: ana, startsOn: '2026-07-01', endsOn: null })).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});

describe('endAssignment', () => {
  it('ends an ongoing assignment of the House and then refuses to edit it again', async () => {
    const { pf, ca, ana, er1 } = await setup();
    const id = await insertAssignment(db, ana, er1, pf, '2026-01-01');
    await expect(endAssignment(db, ctx(), ca, { assignmentId: id, endsOn: '2026-08-31' })).rejects.toMatchObject({ reason: 'not-found' });
    await endAssignment(db, ctx(), pf, { assignmentId: id, endsOn: '2026-08-31' });
    expect(await periodsOf(er1)).toEqual([['Ana Puig', '2026-01-01', '2026-08-31']]);
    await expect(endAssignment(db, ctx(), pf, { assignmentId: id, endsOn: '2026-09-30' })).rejects.toMatchObject({ reason: 'not-ongoing' });
  });
});
