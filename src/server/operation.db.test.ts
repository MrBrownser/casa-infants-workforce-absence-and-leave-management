import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { StaffingError } from '@/lib/staffing-error';
import { isoDateToDate } from '@/lib/dates';
import { createTestClient, ctx, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { runOperation } from './operation';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

function createEmployeeOp(operation: ReturnType<typeof ctx>, name = 'Ana Puig', delayMs = 0) {
  return runOperation(db, operation, 'test-create', [], async (tx) => {
    const employee = await tx.employee.create({ data: { fullName: name } });
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { employeeId: employee.id };
  });
}

describe('runOperation', () => {
  it('applies once and returns the stored result on a retry (AC-023)', async () => {
    const operation = ctx();
    const first = await createEmployeeOp(operation);
    const second = await createEmployeeOp(operation);
    expect(first.status).toBe('applied');
    expect(second).toEqual({ status: 'already-applied', result: first.result });
    expect(await db.employee.count()).toBe(1);
    expect(await db.operationReceipt.findUniqueOrThrow({ where: { id: operation.operationId } })).toMatchObject({
      kind: 'test-create', actorClerkUserId: 'user_test', result: first.result,
    });
  });

  it('applies concurrent duplicates exactly once', async () => {
    const operation = ctx();
    const outcomes = await Promise.all([createEmployeeOp(operation, 'Ana Puig', 300), createEmployeeOp(operation, 'Ana Puig', 300)]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(['already-applied', 'applied']);
    expect(await db.employee.count()).toBe(1);
  });

  it('rejects a reused operation ID for another kind of operation', async () => {
    const operation = ctx();
    await createEmployeeOp(operation);
    await expect(runOperation(db, operation, 'other-kind', [], async () => ({}))).rejects.toMatchObject({ reason: 'operation-conflict' });
  });

  it('rolls back everything, receipt included, when the work fails', async () => {
    const operation = ctx();
    await expect(
      runOperation(db, operation, 'test-create', [], async (tx) => {
        await tx.employee.create({ data: { fullName: 'Ana Puig' } });
        throw new StaffingError('position-occupied');
      }),
    ).rejects.toMatchObject({ reason: 'position-occupied' });
    expect(await db.employee.count()).toBe(0);
    expect(await db.operationReceipt.count()).toBe(0);
    // The same form can be corrected and resubmitted with its operation ID.
    await expect(createEmployeeOp(operation)).resolves.toMatchObject({ status: 'applied' });
  });

  it('maps database errors raised inside the work', async () => {
    const { pf } = await houseIds(db);
    await db.position.create({ data: { houseId: pf, roleCode: 'CT', label: 'CT' } });
    await expect(
      runOperation(db, ctx(), 'test-position', [], async (tx) => {
        await tx.position.create({ data: { houseId: pf, roleCode: 'CT', label: 'ct' } });
        return {};
      }),
    ).rejects.toMatchObject({ reason: 'label-taken' });
  });

  it('maps a deferred constraint that fails at commit (CI001)', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db);
    await insertMembership(db, ana, pf, '2025-09-01');
    await insertAssignment(db, ana, await insertPosition(db, pf, 'CT', 'CT'), pf, '2025-09-01');
    const operation = ctx();
    await expect(
      runOperation(db, operation, 'test-shorten', [ana], async (tx) => {
        await tx.houseMembership.updateMany({ where: { employeeId: ana }, data: { endsOn: isoDateToDate('2026-08-31') } });
        return {};
      }),
    ).rejects.toMatchObject({ reason: 'outside-membership' });
    expect(await db.operationReceipt.count()).toBe(0);
  });
});
