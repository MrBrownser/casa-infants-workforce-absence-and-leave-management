import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamList } from './team-list';

describe('TeamList', () => {
  it('lists current members with their start date in Catalan', () => {
    render(
      <TeamList
        houseName="Carme Aymerich"
        members={[
          { employeeId: 'e1', fullName: 'Ana Puig', startsOn: '2026-07-01' },
          { employeeId: 'e2', fullName: 'Marta Soler', startsOn: '2025-09-01' },
        ]}
      />,
    );
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ana Puig');
    expect(items[0]).toHaveTextContent('Des del 1 de juliol del 2026');
    expect(within(items[0]).getByText(/Des del/)).toHaveClass('tabular-nums');
  });

  it('shows a warm empty state', () => {
    render(<TeamList houseName="Paulo Freire" members={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText("Encara no hi ha ningú a l'equip de Paulo Freire.")).toBeInTheDocument();
  });
});
