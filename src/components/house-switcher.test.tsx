import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HouseSwitcher } from './house-switcher';

vi.mock('next/navigation', () => ({ usePathname: () => '/paulo-freire/team' }));

describe('HouseSwitcher', () => {
  it('shows both Houses and marks the active one', () => {
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    const active = screen.getByRole('link', { name: 'Paulo Freire' });
    const other = screen.getByRole('link', { name: 'Carme Aymerich' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('switches House while keeping the section', () => {
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    expect(screen.getByRole('link', { name: 'Carme Aymerich' })).toHaveAttribute('href', '/carme-aymerich/team');
  });

  it('never uses honey for the active House', () => {
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    const active = screen.getByRole('link', { name: 'Paulo Freire' });
    expect(active.className).toContain('bg-secondary');
    expect(active.className).not.toMatch(/accent/);
  });
});
