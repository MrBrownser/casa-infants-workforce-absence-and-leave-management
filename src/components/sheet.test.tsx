import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Afegeix una persona">x</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled dialog that closes with Escape, the button and the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Afegeix una persona" description="Paulo Freire · Corretorn">
        contingut
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Afegeix una persona' });
    expect(dialog).toHaveAccessibleDescription('Paulo Freire · Corretorn');
    expect(screen.getByText('Paulo Freire · Corretorn')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await userEvent.click(document.querySelector('[data-slot="drawer-overlay"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

// The parent passes a new onClose on every render, as real callers may.
function Harness({ autofocus = true }: { autofocus?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Obre
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Afegeix una persona">
        <input aria-label="Nom" data-autofocus={autofocus || undefined} />
        <button type="button">Desa</button>
      </Sheet>
    </>
  );
}

describe('Sheet closing', () => {
  it('calls onClosed once the close has finished', async () => {
    const onClosed = vi.fn();
    function Closing() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet open={open} onClose={() => setOpen(false)} onClosed={onClosed} title="Fitxa">
          contingut
        </Sheet>
      );
    }
    render(<Closing />);
    expect(onClosed).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Sheet focus', () => {
  it('focuses the marked field, keeps Tab inside and returns focus on close', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Obre' });
    await userEvent.click(opener);
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveFocus());
    // The page behind is out of reach while the sheet is open.
    expect(opener.closest('[aria-hidden="true"]')).not.toBeNull();
    await userEvent.type(screen.getByLabelText('Nom'), 'Ona');
    expect(screen.getByLabelText('Nom')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Desa' })).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tanca' })).toHaveFocus());
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desa' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('focuses the panel when no field is marked', async () => {
    render(<Harness autofocus={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Obre' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
  });

  it('locks the page scroll while open', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Obre' }));
    await waitFor(() => expect(document.documentElement.style.overflowY).toBe('hidden'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.documentElement.style.overflowY).toBe(''));
  });
});
