import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomTabBar, SectionNav } from './section-nav';

const pathname = vi.hoisted(() => ({ value: '/carme-aymerich/team' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

describe.each([
  ['SectionNav', SectionNav],
  ['BottomTabBar', BottomTabBar],
])('%s', (_name, Nav) => {
  it('links Equip inside the active House and marks it current', () => {
    pathname.value = '/carme-aymerich/team';
    render(<Nav houseSlug="carme-aymerich" />);
    const team = screen.getByRole('link', { name: /Equip/ });
    expect(team).toHaveAttribute('href', '/carme-aymerich/team');
    expect(team).toHaveAttribute('aria-current', 'page');
  });

  it('links Saldos inside the active House', () => {
    pathname.value = '/carme-aymerich/team';
    render(<Nav houseSlug="carme-aymerich" />);
    expect(screen.getByRole('link', { name: /Saldos/ })).toHaveAttribute('href', '/carme-aymerich/saldos');
  });

  it('shows the sections not built yet as text, not links', () => {
    render(<Nav houseSlug="carme-aymerich" />);
    for (const label of ['Vacances', 'El mes']) {
      expect(screen.queryByRole('link', { name: new RegExp(label) })).toBeNull();
      expect(screen.getByText(label).closest('[aria-disabled="true"]')).not.toBeNull();
    }
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});

describe('SectionNav', () => {
  it('tags unavailable sections "aviat"', () => {
    render(<SectionNav houseSlug="paulo-freire" />);
    expect(screen.getAllByText('aviat')).toHaveLength(2);
  });
});
