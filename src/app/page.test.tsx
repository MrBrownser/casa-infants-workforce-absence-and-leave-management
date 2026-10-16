import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from './page';

// Render the landing page as a signed-out visitor sees it.
vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: string; children: React.ReactNode }) => (when === 'signed-out' ? children : null),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
}));

describe('landing page', () => {
  it('offers sign-in but not sign-up: access is by invitation', () => {
    render(<HomePage />);
    expect(screen.getAllByRole('button', { name: 'Inicia la sessió' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Crea un compte')).toBeNull();
  });
});
