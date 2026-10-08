// src/server/staffing-queries.ts
//
// Staffing reads with the Prisma client passed in (no auth). App code reads
// through src/server/staffing.ts, which checks requireDirector() first. Volumes
// are tens of rows per House, so views are computed with the pure functions.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IsoDate } from '@/lib/dates';
import { isActiveOn } from '@/lib/house-membership';
import type { HouseSlug } from '@/lib/houses';
import { isUuid } from '@/lib/ids';
import { roleOrder, type RoleCode } from '@/lib/roles';
import { formerMembers, occupancyOn, teamOn, type Assignment, type Position } from '@/lib/staffing';
import type { EmployeeHistory, PositionDetail, PositionRow, TeamView } from '@/lib/staffing-views';
import { toAssignment, toMembership, toPosition } from './rows';

export type * from '@/lib/staffing-views';

const byName = <T extends { fullName: string }>(a: T, b: T) => a.fullName.localeCompare(b.fullName, 'ca');
const byRoleThenLabel = (a: Position, b: Position) =>
  roleOrder(a.roleCode) - roleOrder(b.roleCode) || a.label.localeCompare(b.label, 'ca', { numeric: true });
const byStart = [{ startsOn: 'asc' as const }, { id: 'asc' as const }];

async function loadHouse(db: PrismaClient, houseId: string) {
  const [membershipRows, positionRows, assignmentRows] = await Promise.all([
    db.houseMembership.findMany({ where: { houseId }, include: { employee: true }, orderBy: byStart }),
    db.position.findMany({ where: { houseId } }),
    db.positionAssignment.findMany({ where: { houseId }, orderBy: byStart }),
  ]);
  // Every assignment lies inside a membership of the same House, so this map covers occupants too.
  const names = new Map(membershipRows.map((row) => [row.employeeId, row.employee.fullName]));
  return {
    memberships: membershipRows.map(toMembership),
    positions: positionRows.map(toPosition).sort(byRoleThenLabel),
    assignments: assignmentRows.map(toAssignment),
    names,
  };
}

function toPositionRows(
  positions: readonly Position[],
  assignments: readonly Assignment[],
  names: Map<string, string>,
  date: IsoDate,
): PositionRow[] {
  return occupancyOn(positions, assignments, date).map(({ position, assignment }) => ({
    positionId: position.id,
    label: position.label,
    roleCode: position.roleCode,
    occupant: assignment ? { employeeId: assignment.employeeId, fullName: names.get(assignment.employeeId) ?? '' } : null,
  }));
}

/** The Equip page: people and positions on `date`, former members as of `today` (FR-005). */
export async function getTeamView(db: PrismaClient, houseId: string, date: IsoDate, today: IsoDate): Promise<TeamView> {
  const { memberships, positions, assignments, names } = await loadHouse(db, houseId);
  const labels = new Map(positions.map((p) => [p.id, p.label]));
  const people = teamOn(memberships, assignments, houseId, date)
    .map(({ membership, assignment }) => ({
      employeeId: membership.employeeId,
      fullName: names.get(membership.employeeId) ?? '',
      memberSince: membership.startsOn,
      positionId: assignment?.positionId ?? null,
      positionLabel: assignment ? (labels.get(assignment.positionId) ?? null) : null,
    }))
    .sort(byName);
  const former = formerMembers(memberships, houseId, today)
    .map((m) => ({ employeeId: m.employeeId, fullName: names.get(m.employeeId) ?? '', startsOn: m.startsOn, endsOn: m.endsOn ?? m.startsOn }))
    .sort(byName);
  return { people, positions: toPositionRows(positions, assignments, names, date), former };
}

export async function listPositionRows(db: PrismaClient, houseId: string, date: IsoDate): Promise<PositionRow[]> {
  const { positions, assignments, names } = await loadHouse(db, houseId);
  return toPositionRows(positions, assignments, names, date);
}

export async function listMemberOptions(db: PrismaClient, houseId: string, date: IsoDate) {
  const { memberships, names } = await loadHouse(db, houseId);
  return teamOn(memberships, [], houseId, date)
    .map(({ membership }) => ({ employeeId: membership.employeeId, fullName: names.get(membership.employeeId) ?? '' }))
    .sort(byName);
}

/** Employees who are not members of `houseId` today: candidates for "Persona existent" (FR-009 allows either House). */
export async function listEmployeeOptions(db: PrismaClient, houseId: string, today: IsoDate) {
  const employees = await db.employee.findMany({ include: { memberships: { include: { house: true } } } });
  return employees
    .flatMap((employee) => {
      const memberships = employee.memberships.map((row) => ({ ...toMembership(row), houseName: row.house.name }));
      if (memberships.some((m) => m.houseId === houseId && isActiveOn(m, today))) return [];
      const current = memberships.find((m) => isActiveOn(m, today));
      return [{ employeeId: employee.id, fullName: employee.fullName, currentHouseName: current?.houseName ?? null }];
    })
    .sort(byName);
}

/** History across both Houses, readable only from a House the employee has belonged to (FR-005, FR-009). */
export async function getEmployeeHistory(db: PrismaClient, houseId: string, employeeId: string): Promise<EmployeeHistory | null> {
  if (!isUuid(employeeId)) return null;
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      memberships: { include: { house: true }, orderBy: byStart },
      assignments: { include: { house: true, position: true }, orderBy: byStart },
    },
  });
  if (!employee || !employee.memberships.some((m) => m.houseId === houseId)) return null;
  return {
    employee: { id: employee.id, fullName: employee.fullName, updatedAt: employee.updatedAt.toISOString() },
    memberships: employee.memberships.map((row) => ({
      ...toMembership(row),
      houseSlug: row.house.slug as HouseSlug,
      houseName: row.house.name,
    })),
    assignments: employee.assignments.map((row) => ({
      ...toAssignment(row),
      positionLabel: row.position.label,
      roleCode: row.position.roleCode as RoleCode,
      houseSlug: row.house.slug as HouseSlug,
      houseName: row.house.name,
    })),
  };
}

export async function getPositionDetail(db: PrismaClient, houseId: string, positionId: string): Promise<PositionDetail | null> {
  if (!isUuid(positionId)) return null;
  const row = await db.position.findFirst({
    where: { id: positionId, houseId },
    include: { assignments: { include: { employee: true }, orderBy: byStart } },
  });
  if (!row) return null;
  return {
    position: toPosition(row),
    history: row.assignments.map((a) => ({ ...toAssignment(a), fullName: a.employee.fullName })),
  };
}
