import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormerMembersList } from './former-members-list';
import { PeopleList } from './people-list';
import { PositionsList } from './positions-list';

describe('PeopleList', () => {
  it('shows each member with position or "Sense lloc assignat", linking to the history', () => {
    render(
      <PeopleList
        houseSlug="paulo-freire"
        houseName="Paulo Freire"
        isToday
        rows={[
          { employeeId: 'e1', fullName: 'Ana Puig', memberSince: '2026-01-01', positionId: 'p1', positionLabel: 'ER 1' },
          { employeeId: 'e2', fullName: 'Núria Costa', memberSince: '2025-09-01', positionId: null, positionLabel: null },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('ER 1');
    expect(items[0]).toHaveTextContent('Des del 1 de gener del 2026');
    expect(within(items[0]).getByRole('link', { name: 'Ana Puig' })).toHaveAttribute('href', '/paulo-freire/team/e1');
    expect(items[1]).toHaveTextContent('Sense lloc assignat');
  });

  it('distinguishes an empty team today from an empty past date', () => {
    const { rerender } = render(<PeopleList houseSlug="paulo-freire" houseName="Paulo Freire" isToday rows={[]} />);
    expect(screen.getByText("Encara no hi ha ningú a l'equip de Paulo Freire.")).toBeInTheDocument();
    rerender(<PeopleList houseSlug="paulo-freire" houseName="Paulo Freire" isToday={false} rows={[]} />);
    expect(screen.getByText("Ningú no formava part de l'equip de Paulo Freire aquest dia.")).toBeInTheDocument();
  });
});

describe('PositionsList', () => {
  it('groups by role and shows vacancies in neutral text (no honey)', () => {
    const { container } = render(
      <PositionsList
        houseSlug="paulo-freire"
        houseName="Paulo Freire"
        rows={[
          { positionId: 'p1', label: 'ER 1', roleCode: 'ER', occupant: { employeeId: 'e1', fullName: 'Laia Serra' } },
          { positionId: 'p2', label: 'ER 2', roleCode: 'ER', occupant: null },
          { positionId: 'p3', label: 'CT', roleCode: 'CT', occupant: null },
        ]}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Educadora referent', 'Corretor']);
    const er = screen.getByRole('region', { name: 'Educadora referent' });
    expect(within(er).getAllByRole('listitem')[0]).toHaveTextContent('ER 1Laia Serra');
    expect(within(er).getAllByRole('listitem')[1]).toHaveTextContent('ER 2Vacant');
    expect(container.innerHTML).not.toMatch(/accent/);
  });

  it('has an empty state', () => {
    render(<PositionsList houseSlug="paulo-freire" houseName="Paulo Freire" rows={[]} />);
    expect(screen.getByText('Encara no hi ha llocs de treball a Paulo Freire.')).toBeInTheDocument();
  });
});

describe('FormerMembersList', () => {
  it('shows the last period in the House', () => {
    render(<FormerMembersList houseSlug="paulo-freire" houseName="Paulo Freire" rows={[{ employeeId: 'e1', fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: '2026-06-30' }]} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Del 1 de gener del 2026 al 30 de juny del 2026');
  });
});
