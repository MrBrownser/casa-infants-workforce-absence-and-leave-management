import { describe, expect, it } from 'vitest';
import { employeeActionState } from './employee-actions';
import type { EmployeeHistory } from './staffing-views';

const history: EmployeeHistory = {
  employee: { id: 'e1', fullName: 'Ana Puig', updatedAt: '2026-10-01T00:00:00.000Z' },
  memberships: [
    { id: 'm1', employeeId: 'e1', houseId: 'pf', houseSlug: 'paulo-freire', houseName: 'Paulo Freire', startsOn: '2026-01-01', endsOn: '2026-06-30' },
    { id: 'm2', employeeId: 'e1', houseId: 'ca', houseSlug: 'carme-aymerich', houseName: 'Carme Aymerich', startsOn: '2026-07-01', endsOn: null },
  ],
  assignments: [
    { id: 'a2', employeeId: 'e1', positionId: 'p2', houseId: 'ca', startsOn: '2026-07-01', endsOn: null, positionLabel: 'ER A', roleCode: 'ER', houseSlug: 'carme-aymerich', houseName: 'Carme Aymerich' },
  ],
};

describe('employeeActionState', () => {
  it('finds the ongoing membership and open assignment of the page House only', () => {
    expect(employeeActionState(history, 'ca')).toMatchObject({ ongoingHere: { id: 'm2' }, openAssignmentHere: { id: 'a2' }, hasOngoingMembership: true });
    expect(employeeActionState(history, 'pf')).toEqual({ ongoingHere: null, openAssignmentHere: null, hasOngoingMembership: true });
  });
});
