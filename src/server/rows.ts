// Prisma rows to domain types. Dates cross the boundary as IsoDate strings.
import { dateToIsoDate } from '@/lib/dates';
import type { Membership } from '@/lib/house-membership';
import type { RoleCode } from '@/lib/roles';
import type { Assignment, Position } from '@/lib/staffing';

type PeriodRow = { startsOn: Date; endsOn: Date | null };

function period(row: PeriodRow) {
  return { startsOn: dateToIsoDate(row.startsOn), endsOn: row.endsOn ? dateToIsoDate(row.endsOn) : null };
}

export function toMembership(row: PeriodRow & { id: string; employeeId: string; houseId: string }): Membership {
  return { id: row.id, employeeId: row.employeeId, houseId: row.houseId, ...period(row) };
}

export function toAssignment(
  row: PeriodRow & { id: string; employeeId: string; positionId: string; houseId: string },
): Assignment {
  return { id: row.id, employeeId: row.employeeId, positionId: row.positionId, houseId: row.houseId, ...period(row) };
}

export function toPosition(row: { id: string; houseId: string; roleCode: string; label: string }): Position {
  return { id: row.id, houseId: row.houseId, roleCode: row.roleCode as RoleCode, label: row.label };
}
