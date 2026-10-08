// The one transaction template for staffing writes (design D4).
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { StaffingError } from '@/lib/staffing-error';
import { isReceiptConflict, toStaffingError } from './db-errors';

export type Tx = Prisma.TransactionClient;
export type OperationContext = { operationId: string; actor: string };
export type OperationResult = Record<string, string | null>;
export type Outcome<T extends OperationResult> = { status: 'applied' | 'already-applied'; result: T };

/**
 * 1. Insert the operation receipt first, so a concurrent duplicate waits on its
 *    primary key and then fails with 23505.
 * 2. Lock the affected employees (sorted, to avoid deadlocks).
 * 3. Run the work: re-read, check the expected state, plan, write.
 * 4. Store the result IDs on the receipt.
 * A repeated operation ID returns the stored result as already applied. A
 * failed operation rolls back its receipt too, so the form can be resubmitted.
 */
export async function runOperation<T extends OperationResult>(
  db: PrismaClient,
  ctx: OperationContext,
  kind: string,
  employeeIds: readonly string[],
  work: (tx: Tx) => Promise<T>,
): Promise<Outcome<T>> {
  try {
    const result = await db.$transaction(async (tx) => {
      await tx.operationReceipt.create({ data: { id: ctx.operationId, kind, actorClerkUserId: ctx.actor } });
      await lockEmployees(tx, employeeIds);
      const result = await work(tx);
      await tx.operationReceipt.update({ where: { id: ctx.operationId }, data: { result } });
      return result;
    });
    return { status: 'applied', result };
  } catch (error) {
    if (!isReceiptConflict(error)) throw toStaffingError(error);
    const receipt = await db.operationReceipt.findUnique({ where: { id: ctx.operationId } });
    if (receipt?.kind !== kind || receipt.result === null) throw new StaffingError('operation-conflict');
    return { status: 'already-applied', result: receipt.result as T };
  }
}

/** Row locks that serialise concurrent writes for the same people (the containment trigger takes the same lock). */
export async function lockEmployees(tx: Tx, employeeIds: readonly string[]): Promise<void> {
  const ids = [...new Set(employeeIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT "id" FROM "employees" WHERE "id" = ANY(${ids}::uuid[]) ORDER BY "id" FOR UPDATE`;
}
