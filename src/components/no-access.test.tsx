import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoAccess } from './no-access';

vi.mock('@clerk/nextjs', () => ({ UserButton: () => <button type="button">Compte</button> }));

describe('NoAccess', () => {
  it('explains the block with an icon and text, and offers the account menu', () => {
    render(<NoAccess />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Sense accés');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aquesta zona és només per a la direcció');
    expect(screen.getByRole('button', { name: 'Compte' })).toBeInTheDocument();
  });
});
