import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PositionHistory } from './position-history';

describe('PositionHistory', () => {
  it('lists successive occupants of one position in date order (AC-004)', () => {
    render(
      <PositionHistory
        houseSlug="paulo-freire"
        today="2026-10-08"
        rows={[
          { id: 'a1', employeeId: 'e1', positionId: 'p1', houseId: 'pf', startsOn: '2025-09-01', endsOn: '2026-06-30', fullName: 'Marta Soler' },
          { id: 'a2', employeeId: 'e2', positionId: 'p1', houseId: 'pf', startsOn: '2026-07-01', endsOn: null, fullName: 'Ana Puig' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Marta Soler');
    expect(items[1]).toHaveTextContent('Des del 1 de juliol del 2026');
  });

  it('has an empty state', () => {
    render(<PositionHistory houseSlug="paulo-freire" today="2026-10-08" rows={[]} />);
    expect(screen.getByText('Aquest lloc encara no ha tingut cap ocupant.')).toBeInTheDocument();
  });
});
