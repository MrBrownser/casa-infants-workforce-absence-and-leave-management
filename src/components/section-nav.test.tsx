import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomTabBar, SectionNav, sectionHref } from './section-nav';

const pathname = vi.hoisted(() => ({ value: '/carme-aymerich/team' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

describe('sectionHref', () => {
  it('builds hrefs inside the active House', () => {
    expect(sectionHref('carme-aymerich', '')).toBe('/carme-aymerich');
    expect(sectionHref('carme-aymerich', 'team')).toBe('/carme-aymerich/team');
  });
});

describe.each([
  ['SectionNav', SectionNav],
  ['BottomTabBar', BottomTabBar],
])('%s', (_name, Nav) => {
  it('keeps every link in the active House and marks the current section', () => {
    pathname.value = '/carme-aymerich/team';
    render(<Nav houseSlug="carme-aymerich" />);
    expect(screen.getByRole('link', { name: /Inici/ })).toHaveAttribute('href', '/carme-aymerich');
    const team = screen.getByRole('link', { name: /Equip/ });
    expect(team).toHaveAttribute('href', '/carme-aymerich/team');
    expect(team).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Inici/ })).not.toHaveAttribute('aria-current');
  });

  it('marks Inici only on the House home', () => {
    pathname.value = '/carme-aymerich';
    render(<Nav houseSlug="carme-aymerich" />);
    expect(screen.getByRole('link', { name: /Inici/ })).toHaveAttribute('aria-current', 'page');
  });
});
