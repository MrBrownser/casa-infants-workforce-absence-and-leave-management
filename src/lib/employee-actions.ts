import type { IsoDate } from './dates';
import type { EmployeeHistory, HistoryAssignment, HistoryMembership } from './staffing-views';

/** Which actions the history page offers in the page's House. */
export function employeeActionState(history: EmployeeHistory, houseId: string, today: IsoDate) {
  const ongoingHere: HistoryMembership | null = history.memberships.find((m) => m.houseId === houseId && m.endsOn === null) ?? null;
  // Assigning needs only a membership here that is current or still to come (end-dated ones included).
  const canAssignHere = history.memberships.some((m) => m.houseId === houseId && (m.endsOn === null || m.endsOn >= today));
  const openAssignmentHere: HistoryAssignment | null = history.assignments.find((a) => a.houseId === houseId && a.endsOn === null) ?? null;
  return { ongoingHere, canAssignHere, openAssignmentHere, hasOngoingMembership: history.memberships.some((m) => m.endsOn === null) };
}
