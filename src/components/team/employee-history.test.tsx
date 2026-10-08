import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmployeeHistory } from '@/lib/staffing-views';
import { EmployeeHistoryView } from './employee-history';

const history: EmployeeHistory = {
  employee: { id: 'e1', fullName: 'Ana Puig', updatedAt: '2026-10-01T00:00:00.000Z' },
  memberships: [
    { id: 'm1', employeeId: 'e1', houseId: 'pf', houseSlug: 'paulo-freire', houseName: 'Paulo Freire', startsOn: '2026-01-01', endsOn: '2026-06-30' },
    { id: 'm2', employeeId: 'e1', houseId: 'ca', houseSlug: 'carme-aymerich', houseName: 'Carme Aymerich', startsOn: '2026-11-01', endsOn: null },
  ],
  assignments: [
    { id: 'a1', employeeId: 'e1', positionId: 'p1', houseId: 'pf', startsOn: '2026-01-01', endsOn: '2026-06-30', positionLabel: 'ER 1', roleCode: 'ER', houseSlug: 'paulo-freire', houseName: 'Paulo Freire' },
  ],
};

describe('EmployeeHistoryView', () => {
  it('labels each period with its House and marks future ones neutrally', () => {
    render(<EmployeeHistoryView history={history} today="2026-10-08" />);
    const memberships = within(screen.getByRole('region', { name: 'Pertinença' })).getAllByRole('listitem');
    expect(memberships[0]).toHaveTextContent('Paulo Freire');
    expect(memberships[0]).toHaveTextContent('Del 1 de gener del 2026 al 30 de juny del 2026');
    expect(memberships[1]).toHaveTextContent('Futur');
    expect(memberships[1].innerHTML).not.toMatch(/accent/);
    const positions = within(screen.getByRole('region', { name: 'Llocs' })).getAllByRole('listitem');
    expect(positions[0]).toHaveTextContent('ER 1 · Educadora referent');
    expect(positions[0]).toHaveTextContent('Paulo Freire');
  });

  it('says when there is no position history', () => {
    render(<EmployeeHistoryView history={{ ...history, assignments: [] }} today="2026-10-08" />);
    expect(screen.getByText('Encara no ha ocupat cap lloc.')).toBeInTheDocument();
  });
});
