// src/server/staffing-store.ts
//
// Staffing writes with the Prisma client passed in. No auth and no
// `server-only` here, so the dev seed and the DB tests can use it. App code
// calls it only from the Server Functions in src/app/(app)/[house]/team/actions.ts,
// after requireDirector(). Every write goes through runOperation (design D4).
import type { PrismaClient } from '@/generated/prisma/client';
import { isoDateToDate, type IsoDate } from '@/lib/dates';
import type { RoleCode } from '@/lib/roles';
import type { PlanNames } from '@/lib/staffing-messages';
import {
  planEndAssignment,
  planEndMembership,
  planHandover,
  planHouseTransfer,
  planNewMembership,
  type PlanClose,
  type PlanOpen,
  type StaffingPlan,
} from '@/lib/staffing';
import { StaffingError } from '@/lib/staffing-error';
import { toStaffingError } from './db-errors';
import { planToken } from './plan-token';
import { runOperation, type OperationContext, type Outcome, type Tx } from './operation';
import { toAssignment, toMembership, toPosition } from './rows';

export type { OperationContext, Outcome } from './operation';

const byStart = [{ startsOn: 'asc' as const }, { id: 'asc' as const }];

// ── Loaders (inside or outside a transaction) ────────────────────────────────

async function employeeMemberships(db: Tx, employeeId: string) {
  return (await db.houseMembership.findMany({ where: { employeeId }, orderBy: byStart })).map(toMembership);
}

async function employeeAssignments(db: Tx, employeeId: string) {
  return (await db.positionAssignment.findMany({ where: { employeeId }, orderBy: byStart })).map(toAssignment);
}

async function positionAssignments(db: Tx, positionId: string) {
  return (await db.positionAssignment.findMany({ where: { positionId }, orderBy: byStart })).map(toAssignment);
}

/** The position, if it belongs to `houseId` (FR-009); otherwise not found. */
async function positionInHouse(db: Tx, positionId: string, houseId: string) {
  const row = await db.position.findFirst({ where: { id: positionId, houseId } });
  if (!row) throw new StaffingError('not-found');
  return toPosition(row);
}

/** Closes first, then new memberships, then new assignments (exclusion constraints are checked per statement). */
async function applyPlan(tx: Tx, plan: StaffingPlan): Promise<{ membershipIds: string[]; assignmentIds: string[] }> {
  for (const close of plan.closes) {
    const data = { endsOn: isoDateToDate(close.endsOn) };
    if (close.kind === 'assignment') await tx.positionAssignment.update({ where: { id: close.id }, data });
    else await tx.houseMembership.update({ where: { id: close.id }, data });
  }
  const dates = (open: PlanOpen) => ({
    startsOn: isoDateToDate(open.startsOn),
    endsOn: open.endsOn ? isoDateToDate(open.endsOn) : null,
  });
  const membershipIds: string[] = [];
  const assignmentIds: string[] = [];
  for (const open of plan.opens) {
    if (open.kind !== 'membership') continue;
    const row = await tx.houseMembership.create({ data: { employeeId: open.employeeId, houseId: open.houseId, ...dates(open) } });
    membershipIds.push(row.id);
  }
  for (const open of plan.opens) {
    if (open.kind !== 'assignment') continue;
    const row = await tx.positionAssignment.create({
      data: { employeeId: open.employeeId, positionId: open.positionId, houseId: open.houseId, ...dates(open) },
    });
    assignmentIds.push(row.id);
  }
  return { membershipIds, assignmentIds };
}

/** Database errors from reads outside runOperation become StaffingErrors too. */
async function mapped<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toStaffingError(error);
  }
}

// ── Previews ─────────────────────────────────────────────────────────────────

export type Preview = { plan: StaffingPlan; planToken: string; names: PlanNames };

function positionIdOf(item: PlanClose | PlanOpen): string | null {
  return 'positionId' in item ? item.positionId : null;
}

async function previewOf(db: PrismaClient, plan: StaffingPlan): Promise<Preview> {
  const items = [...plan.closes, ...plan.opens];
  const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => v !== null))];
  const [employees, positions, houses] = await Promise.all([
    db.employee.findMany({ where: { id: { in: unique(items.map((i) => i.employeeId)) } } }),
    db.position.findMany({ where: { id: { in: unique(items.map(positionIdOf)) } } }),
    db.house.findMany({ where: { id: { in: unique(items.map((i) => i.houseId)) } } }),
  ]);
  return {
    plan,
    planToken: planToken(plan),
    names: {
      employees: Object.fromEntries(employees.map((e) => [e.id, e.fullName])),
      positions: Object.fromEntries(positions.map((p) => [p.id, p.label])),
      houses: Object.fromEntries(houses.map((h) => [h.id, h.name])),
    },
  };
}

// ── Positions ────────────────────────────────────────────────────────────────

export function createPosition(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { roleCode: RoleCode; label: string },
): Promise<Outcome<{ positionId: string }>> {
  return runOperation(db, ctx, 'create-position', [], async (tx) => {
    const position = await tx.position.create({ data: { houseId, roleCode: input.roleCode, label: input.label.trim() } });
    return { positionId: position.id };
  });
}

export function relabelPosition(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { positionId: string; label: string },
): Promise<Outcome<{ positionId: string }>> {
  return runOperation(db, ctx, 'relabel-position', [], async (tx) => {
    await positionInHouse(tx, input.positionId, houseId);
    await tx.position.update({ where: { id: input.positionId }, data: { label: input.label.trim() } });
    return { positionId: input.positionId };
  });
}

// ── People and membership periods ────────────────────────────────────────────

export type MembershipResult = { employeeId: string; membershipId: string; assignmentId: string | null };

/** A new employee with an initial membership and optional position, all or nothing (FR-002). */
export function createEmployee(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { fullName: string; startsOn: IsoDate; endsOn: IsoDate | null; positionId: string | null },
): Promise<Outcome<MembershipResult>> {
  return runOperation(db, ctx, 'create-employee', [], async (tx) => {
    const position = input.positionId ? await positionInHouse(tx, input.positionId, houseId) : null;
    const employee = await tx.employee.create({ data: { fullName: input.fullName.trim() } });
    const plan = planNewMembership({
      employeeId: employee.id,
      houseId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      position,
      employeeMemberships: [],
      employeeAssignments: [],
      positionAssignments: position ? await positionAssignments(tx, position.id) : [],
    });
    const ids = await applyPlan(tx, plan);
    return { employeeId: employee.id, membershipId: ids.membershipIds[0], assignmentId: ids.assignmentIds[0] ?? null };
  });
}

/** A new period for an existing employee, from either House (returns, cross-House picks; FR-003, FR-009). */
export function addMembership(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { employeeId: string; startsOn: IsoDate; endsOn: IsoDate | null; positionId: string | null },
): Promise<Outcome<MembershipResult>> {
  return runOperation(db, ctx, 'add-membership', [input.employeeId], async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new StaffingError('not-found');
    const position = input.positionId ? await positionInHouse(tx, input.positionId, houseId) : null;
    const plan = planNewMembership({
      employeeId: employee.id,
      houseId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      position,
      employeeMemberships: await employeeMemberships(tx, employee.id),
      employeeAssignments: await employeeAssignments(tx, employee.id),
      positionAssignments: position ? await positionAssignments(tx, position.id) : [],
    });
    const ids = await applyPlan(tx, plan);
    return { employeeId: employee.id, membershipId: ids.membershipIds[0], assignmentId: ids.assignmentIds[0] ?? null };
  });
}

/** Corrects a name; the ID and every period stay as they are. Stale if the name changed since it was loaded. */
export function editEmployeeName(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { employeeId: string; fullName: string; expectedUpdatedAt: string },
): Promise<Outcome<{ employeeId: string }>> {
  return runOperation(db, ctx, 'edit-name', [input.employeeId], async (tx) => {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, memberships: { some: { houseId } } } });
    if (!employee) throw new StaffingError('not-found');
    if (employee.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new StaffingError('stale');
    await tx.employee.update({ where: { id: employee.id }, data: { fullName: input.fullName.trim() } });
    return { employeeId: employee.id };
  });
}

// ── Positions over time ──────────────────────────────────────────────────────

export type HandoverRequest = { positionId: string; employeeId: string; startsOn: IsoDate; endsOn: IsoDate | null };

async function handoverPlan(db: Tx, houseId: string, input: HandoverRequest): Promise<StaffingPlan> {
  const position = await positionInHouse(db, input.positionId, houseId);
  return planHandover({
    position,
    incomingEmployeeId: input.employeeId,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    positionAssignments: await positionAssignments(db, position.id),
    incomingAssignments: await employeeAssignments(db, input.employeeId),
    incomingMemberships: await employeeMemberships(db, input.employeeId),
  });
}

export function previewHandover(db: PrismaClient, houseId: string, input: HandoverRequest): Promise<Preview> {
  return mapped(async () => previewOf(db, await handoverPlan(db, houseId, input)));
}

/**
 * Assign, replace or move (FR-004). Locks the incoming employee and everyone
 * whose period on the position the handover can touch (design D4), recomputes
 * the plan under the lock and applies it only if it matches the previewed
 * token; any change since the preview is `stale` (design D6).
 */
export function handover(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: HandoverRequest & { planToken: string },
): Promise<Outcome<{ positionId: string; employeeId: string; assignmentId: string }>> {
  return mapped(async () => {
    await positionInHouse(db, input.positionId, houseId);
    const affected = await db.positionAssignment.findMany({
      where: { positionId: input.positionId, OR: [{ endsOn: null }, { endsOn: { gte: isoDateToDate(input.startsOn) } }] },
      select: { employeeId: true },
    });
    const lockIds = [input.employeeId, ...affected.map((a) => a.employeeId)];
    return runOperation(db, ctx, 'handover', lockIds, async (tx) => {
      let plan: StaffingPlan;
      try {
        plan = await handoverPlan(tx, houseId, input);
      } catch (error) {
        // The preview succeeded, so a rule failure now means the state moved.
        if (error instanceof StaffingError && error.reason !== 'not-found') throw new StaffingError('stale');
        throw error;
      }
      if (planToken(plan) !== input.planToken) throw new StaffingError('stale');
      const ids = await applyPlan(tx, plan);
      return { positionId: input.positionId, employeeId: input.employeeId, assignmentId: ids.assignmentIds[0] };
    });
  });
}

/** Ends an ongoing assignment of this House. An already closed one is `not-ongoing`. */
export async function endAssignment(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { assignmentId: string; endsOn: IsoDate },
): Promise<Outcome<{ assignmentId: string; employeeId: string }>> {
  const owner = await mapped(() =>
    db.positionAssignment.findFirst({ where: { id: input.assignmentId, houseId }, select: { employeeId: true } }),
  );
  if (!owner) throw new StaffingError('not-found');
  return runOperation(db, ctx, 'end-assignment', [owner.employeeId], async (tx) => {
    const row = await tx.positionAssignment.findFirst({ where: { id: input.assignmentId, houseId } });
    if (!row) throw new StaffingError('not-found');
    await applyPlan(tx, planEndAssignment(toAssignment(row), input.endsOn));
    return { assignmentId: row.id, employeeId: row.employeeId };
  });
}

// ── Ending a membership and House transfers ──────────────────────────────────

/**
 * Recomputes the plan under the locks and checks it against the previewed
 * token. A rule failure now means the state moved since the preview (`stale`),
 * except `not-found` and `not-ongoing`: those say the thing is gone or already
 * done, which the person needs to hear as it is (a second submit of a transfer).
 */
async function confirmedPlan(compute: () => Promise<StaffingPlan>, expectedToken: string): Promise<StaffingPlan> {
  let plan: StaffingPlan;
  try {
    plan = await compute();
  } catch (error) {
    if (error instanceof StaffingError && error.reason !== 'not-found' && error.reason !== 'not-ongoing') throw new StaffingError('stale');
    throw error;
  }
  if (planToken(plan) !== expectedToken) throw new StaffingError('stale');
  return plan;
}

async function endMembershipPlan(db: Tx, houseId: string, input: { membershipId: string; endsOn: IsoDate }): Promise<StaffingPlan> {
  const row = await db.houseMembership.findFirst({ where: { id: input.membershipId, houseId } });
  if (!row) throw new StaffingError('not-found');
  return planEndMembership({ membership: toMembership(row), endsOn: input.endsOn, assignments: await employeeAssignments(db, row.employeeId) });
}

export function previewEndMembership(db: PrismaClient, houseId: string, input: { membershipId: string; endsOn: IsoDate }): Promise<Preview> {
  return mapped(async () => previewOf(db, await endMembershipPlan(db, houseId, input)));
}

/** Ends an ongoing membership and closes its assignments that run past the end (FR-003). Not erasure. */
export async function endMembership(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { membershipId: string; endsOn: IsoDate; planToken: string },
): Promise<Outcome<{ membershipId: string; employeeId: string }>> {
  const owner = await mapped(() => db.houseMembership.findFirst({ where: { id: input.membershipId, houseId }, select: { employeeId: true } }));
  if (!owner) throw new StaffingError('not-found');
  return runOperation(db, ctx, 'end-membership', [owner.employeeId], async (tx) => {
    const plan = await confirmedPlan(() => endMembershipPlan(tx, houseId, input), input.planToken);
    await applyPlan(tx, plan);
    return { membershipId: input.membershipId, employeeId: owner.employeeId };
  });
}

export type TransferRequest = { employeeId: string; toHouseId: string; startsOn: IsoDate; destinationPositionId: string | null };

async function transferPlan(db: Tx, houseId: string, input: TransferRequest): Promise<StaffingPlan> {
  // The source must be an ongoing membership of the route's House, so a
  // second submit cannot transfer the newly created destination membership.
  const source = await db.houseMembership.findFirst({ where: { employeeId: input.employeeId, houseId, endsOn: null } });
  if (!source) throw new StaffingError('not-ongoing');
  const destinationPosition = input.destinationPositionId ? await positionInHouse(db, input.destinationPositionId, input.toHouseId) : null;
  return planHouseTransfer({
    source: toMembership(source),
    toHouseId: input.toHouseId,
    startsOn: input.startsOn,
    destinationPosition,
    employeeMemberships: await employeeMemberships(db, input.employeeId),
    employeeAssignments: await employeeAssignments(db, input.employeeId),
    destinationPositionAssignments: destinationPosition ? await positionAssignments(db, destinationPosition.id) : [],
  });
}

export function previewTransfer(db: PrismaClient, houseId: string, input: TransferRequest): Promise<Preview> {
  return mapped(async () => previewOf(db, await transferPlan(db, houseId, input)));
}

/**
 * House transfer (FR-006): memberships and assignments close on D-1 and open on D
 * in one transaction. Only the transferred employee's rows are written (the
 * destination position must be free, never displaced), so only they are locked.
 */
export function transfer(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: TransferRequest & { planToken: string },
): Promise<Outcome<MembershipResult>> {
  return runOperation(db, ctx, 'transfer', [input.employeeId], async (tx) => {
    const plan = await confirmedPlan(() => transferPlan(tx, houseId, input), input.planToken);
    const ids = await applyPlan(tx, plan);
    return { employeeId: input.employeeId, membershipId: ids.membershipIds[0], assignmentId: ids.assignmentIds[0] ?? null };
  });
}
