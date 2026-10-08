// src/server/staffing-store.ts
//
// Staffing writes with the Prisma client passed in. No auth and no
// `server-only` here, so the dev seed and the DB tests can use it. App code
// calls it only from the Server Functions in src/app/(app)/[house]/team/actions.ts,
// after requireDirector(). Every write goes through runOperation (design D4).
import type { PrismaClient } from '@/generated/prisma/client';
import { isoDateToDate, type IsoDate } from '@/lib/dates';
import type { RoleCode } from '@/lib/roles';
import { planNewMembership, type PlanOpen, type StaffingPlan } from '@/lib/staffing';
import { StaffingError } from '@/lib/staffing-error';
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
