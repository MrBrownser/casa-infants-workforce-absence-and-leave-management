import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HouseSwitcher } from './house-switcher';

vi.mock('next/navigation', () => ({ usePathname: () => '/paulo-freire/team' }));

const linkProps: Array<{ href: string; prefetch?: boolean | null }> = [];
vi.mock('next/link', () => ({
  default: ({ prefetch, children, ...rest }: { prefetch?: boolean | null; children: React.ReactNode; href: string }) => {
    linkProps.push({ href: rest.href, prefetch });
    return <a {...rest}>{children}</a>;
  },
}));

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

  it('never prefetches, so the remembered-House cookie is not overwritten', () => {
    linkProps.length = 0;
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    expect(linkProps).toHaveLength(2);
    for (const link of linkProps) expect(link.prefetch).toBe(false);
  });
});
