import type { EmployeeHistory, HistoryAssignment, HistoryMembership } from './staffing-views';

/** Which actions the history page offers in the page's House. */
export function employeeActionState(history: EmployeeHistory, houseId: string) {
  const ongoingHere: HistoryMembership | null = history.memberships.find((m) => m.houseId === houseId && m.endsOn === null) ?? null;
  const openAssignmentHere: HistoryAssignment | null = history.assignments.find((a) => a.houseId === houseId && a.endsOn === null) ?? null;
  return { ongoingHere, openAssignmentHere, hasOngoingMembership: history.memberships.some((m) => m.endsOn === null) };
}
