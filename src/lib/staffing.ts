// src/lib/staffing.ts
//
// Pure staffing rules (SPEC-002): positions, dated assignments, the team and
// occupancy on a date, and the plans for every staffing write. No Prisma here.
// The database enforces the same rules (staffing migration) and
// src/server/staffing-store.ts runs these plans inside transactions.
import type { IsoDate } from './dates';
import { isActiveOn, type Membership } from './house-membership';
import type { RoleCode } from './roles';
import { StaffingError } from './staffing-error';

/** Inclusive calendar dates; `endsOn: null` means ongoing. */
export type Period = { startsOn: IsoDate; endsOn: IsoDate | null };

/** A stable staffing slot. House and role never change after creation. */
export type Position = { id: string; houseId: string; roleCode: RoleCode; label: string };

/** A dated occupancy of a position. Its House is stored at creation (BR-005). */
export type Assignment = Period & { id: string; employeeId: string; positionId: string; houseId: string };

const OPEN_END: IsoDate = '9999-12-31';

function lastDay(period: Period): IsoDate {
  return period.endsOn ?? OPEN_END;
}

export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startsOn <= lastDay(b) && b.startsOn <= lastDay(a);
}

export function periodContains(outer: Period, inner: Period): boolean {
  return outer.startsOn <= inner.startsOn && lastDay(outer) >= lastDay(inner);
}

export function assertValidPeriod(period: Period): void {
  if (period.endsOn !== null && period.endsOn < period.startsOn) throw new StaffingError('invalid-dates');
}

export type Occupancy = { position: Position; assignment: Assignment | null };

/** Each position with its occupant on `date`, or none (vacant). Future occupants do not fill it early. */
export function occupancyOn(positions: readonly Position[], assignments: readonly Assignment[], date: IsoDate): Occupancy[] {
  return positions.map((position) => ({
    position,
    assignment: assignments.find((a) => a.positionId === position.id && isActiveOn(a, date)) ?? null,
  }));
}

export type TeamRow = { membership: Membership; assignment: Assignment | null };

/**
 * Members of `houseId` on `date` with their position that day, or none.
 * Memberships never overlap, so each employee appears at most once.
 */
export function teamOn(
  memberships: readonly Membership[],
  assignments: readonly Assignment[],
  houseId: string,
  date: IsoDate,
): TeamRow[] {
  return memberships
    .filter((m) => m.houseId === houseId && isActiveOn(m, date))
    .map((membership) => ({
      membership,
      assignment:
        assignments.find((a) => a.employeeId === membership.employeeId && a.houseId === houseId && isActiveOn(a, date)) ?? null,
    }));
}

/**
 * Employees with a completed membership in `houseId` who are not members of it
 * on `today`, each with their latest completed period there.
 */
export function formerMembers(memberships: readonly Membership[], houseId: string, today: IsoDate): Membership[] {
  const inHouse = memberships.filter((m) => m.houseId === houseId);
  const current = new Set(inHouse.filter((m) => isActiveOn(m, today)).map((m) => m.employeeId));
  const latest = new Map<string, Membership>();
  for (const m of inHouse) {
    if (current.has(m.employeeId) || m.endsOn === null || m.endsOn >= today) continue;
    const seen = latest.get(m.employeeId);
    if (!seen || seen.startsOn < m.startsOn) latest.set(m.employeeId, m);
  }
  return [...latest.values()];
}

/** The House's CT positions with their occupant on `date` (FR-007). Vacant CT positions stay listed. */
export function ctOccupantsOn(
  positions: readonly Position[],
  assignments: readonly Assignment[],
  houseId: string,
  date: IsoDate,
): Occupancy[] {
  return occupancyOn(
    positions.filter((p) => p.houseId === houseId && p.roleCode === 'CT'),
    assignments,
    date,
  );
}

export type AssignmentConflict = { reason: 'employee-has-position' | 'position-occupied'; assignment: Assignment };

/** Mirrors the two exclusion constraints on assignments (one occupant per position, one position per employee). */
export function findAssignmentConflict(
  existing: readonly Assignment[],
  candidate: Period & { employeeId: string; positionId: string },
): AssignmentConflict | null {
  for (const assignment of existing) {
    if (!periodsOverlap(assignment, candidate)) continue;
    if (assignment.positionId === candidate.positionId) return { reason: 'position-occupied', assignment };
    if (assignment.employeeId === candidate.employeeId) return { reason: 'employee-has-position', assignment };
  }
  return null;
}

/** Mirrors the containment trigger: the one membership of the same employee and House covering the whole interval. */
export function findContainingMembership(
  memberships: readonly Membership[],
  candidate: Period & { employeeId: string; houseId: string },
): Membership | undefined {
  return memberships.find(
    (m) => m.employeeId === candidate.employeeId && m.houseId === candidate.houseId && periodContains(m, candidate),
  );
}
