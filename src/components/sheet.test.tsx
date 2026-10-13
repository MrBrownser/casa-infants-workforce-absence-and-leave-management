import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Afegeix una persona">x</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog that closes with Escape, the button and the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Afegeix una persona" description="Paulo Freire · Corretorn">
        contingut
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Afegeix una persona' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Paulo Freire · Corretorn')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
