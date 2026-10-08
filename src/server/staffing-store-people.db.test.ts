// src/server/staffing-store-people.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestClient, ctx, houseIds, insertEmployee, insertMembership, resetData } from '../../test/db/helpers';
import { addMembership, createEmployee, createPosition, editEmployeeName, relabelPosition } from './staffing-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

describe('positions', () => {
  it('creates positions and rejects a label taken in the same House', async () => {
    const { pf, ca } = await houseIds(db);
    await createPosition(db, ctx(), pf, { roleCode: 'CT', label: 'CT nit' });
    await expect(createPosition(db, ctx(), pf, { roleCode: 'CT', label: ' ct NIT ' })).rejects.toMatchObject({ reason: 'label-taken' });
    await expect(createPosition(db, ctx(), ca, { roleCode: 'CT', label: 'CT nit' })).resolves.toMatchObject({ status: 'applied' });
  });

  it('treats labels differing only by accent case as the same in a House', async () => {
    const { pf, ca } = await houseIds(db);
    await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'Àrea' });
    await expect(createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'àrea' })).rejects.toMatchObject({ reason: 'label-taken' });
    await expect(createPosition(db, ctx(), ca, { roleCode: 'ER', label: 'àrea' })).resolves.toMatchObject({ status: 'applied' });
  });

  it('relabels inside the House only', async () => {
    const { pf, ca } = await houseIds(db);
    const { result } = await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'ER 1' });
    await relabelPosition(db, ctx(), pf, { positionId: result.positionId, label: 'ER matins' });
    expect((await db.position.findUniqueOrThrow({ where: { id: result.positionId } })).label).toBe('ER matins');
    await expect(relabelPosition(db, ctx(), ca, { positionId: result.positionId, label: 'X' })).rejects.toMatchObject({ reason: 'not-found' });
  });
});

describe('createEmployee', () => {
  it('commits employee, membership and assignment together (AC-001)', async () => {
    const { pf } = await houseIds(db);
    const { result: position } = await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'ER 1' });
    const { result } = await createEmployee(db, ctx(), pf, { fullName: ' Ana Puig ', startsOn: '2026-01-01', endsOn: null, positionId: position.positionId });
    expect((await db.employee.findUniqueOrThrow({ where: { id: result.employeeId } })).fullName).toBe('Ana Puig');
    expect(await db.houseMembership.count({ where: { employeeId: result.employeeId, houseId: pf } })).toBe(1);
    expect(await db.positionAssignment.findUniqueOrThrow({ where: { id: result.assignmentId! } })).toMatchObject({ positionId: position.positionId, houseId: pf });
  });

  it('leaves nothing behind when the position is occupied (AC-002)', async () => {
    const { pf } = await houseIds(db);
    const { result: position } = await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'ER 1' });
    await createEmployee(db, ctx(), pf, { fullName: 'Marta Soler', startsOn: '2025-09-01', endsOn: null, positionId: position.positionId });
    await expect(
      createEmployee(db, ctx(), pf, { fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: position.positionId }),
    ).rejects.toMatchObject({ reason: 'position-occupied' });
    expect(await db.employee.count()).toBe(1);
    expect(await db.houseMembership.count()).toBe(1);
  });

  it('rejects a position from the other House', async () => {
    const { pf, ca } = await houseIds(db);
    const { result: position } = await createPosition(db, ctx(), ca, { roleCode: 'ER', label: 'ER A' });
    await expect(
      createEmployee(db, ctx(), pf, { fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: position.positionId }),
    ).rejects.toMatchObject({ reason: 'not-found' });
    expect(await db.employee.count()).toBe(0);
  });

  it('allows two people with the same name (AC-003)', async () => {
    const { pf } = await houseIds(db);
    const a = await createEmployee(db, ctx(), pf, { fullName: 'Maria Garcia', startsOn: '2026-01-01', endsOn: null, positionId: null });
    const b = await createEmployee(db, ctx(), pf, { fullName: 'Maria Garcia', startsOn: '2026-01-01', endsOn: null, positionId: null });
    expect(a.result.employeeId).not.toBe(b.result.employeeId);
  });
});

describe('addMembership', () => {
  it('accepts a return after a gap and keeps the ID (AC-024)', async () => {
    const { pf } = await houseIds(db);
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, pf, '2025-01-01', '2025-12-31');
    const { result } = await addMembership(db, ctx(), pf, { employeeId: pau, startsOn: '2026-03-01', endsOn: null, positionId: null });
    expect(result.employeeId).toBe(pau);
    expect(await db.houseMembership.count({ where: { employeeId: pau } })).toBe(2);
  });

  it('rejects an overlapping period in either House', async () => {
    const { pf, ca } = await houseIds(db);
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, pf, '2025-01-01');
    await expect(addMembership(db, ctx(), ca, { employeeId: pau, startsOn: '2026-03-01', endsOn: null, positionId: null })).rejects.toMatchObject({
      reason: 'membership-overlap',
    });
  });
});

describe('editEmployeeName', () => {
  it('renames with the current version and rejects a stale one', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01');
    const loaded = (await db.employee.findUniqueOrThrow({ where: { id: ana } })).updatedAt.toISOString();
    await editEmployeeName(db, ctx(), pf, { employeeId: ana, fullName: 'Anna Puig', expectedUpdatedAt: loaded });
    await expect(editEmployeeName(db, ctx(), pf, { employeeId: ana, fullName: 'Ana P.', expectedUpdatedAt: loaded })).rejects.toMatchObject({
      reason: 'stale',
    });
    expect((await db.employee.findUniqueOrThrow({ where: { id: ana } })).fullName).toBe('Anna Puig');
  });

  it('does not touch an employee who never belonged to the House', async () => {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01');
    const loaded = (await db.employee.findUniqueOrThrow({ where: { id: ana } })).updatedAt.toISOString();
    await expect(editEmployeeName(db, ctx(), ca, { employeeId: ana, fullName: 'X', expectedUpdatedAt: loaded })).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});
