import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';
import { Sheet } from './sheet';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={() => {}} title="Apuntar AP">x</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled dialog that closes with Escape, the button and the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Apuntar AP" description="Saldos 2026">
        contingut
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Apuntar AP' });
    expect(dialog).toHaveAccessibleDescription('Saldos 2026');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await userEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('focuses the marked field', async () => {
    render(
      <Dialog open onClose={() => {}} title="Apuntar AP">
        <input aria-label="Dia" data-autofocus />
      </Dialog>,
    );
    await waitFor(() => expect(screen.getByLabelText('Dia')).toHaveFocus());
  });

  // The Saldos board renders the Dialog next to the person Sheet, not inside it.
  it('opens over a Sheet, and Escape closes only the dialog', async () => {
    function Harness() {
      const [sheet, setSheet] = useState(true);
      const [dialog, setDialog] = useState(false);
      return (
        <>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Laia Puig">
            <button type="button" onClick={() => setDialog(true)}>
              Obre el formulari
            </button>
          </Sheet>
          <Dialog open={dialog} onClose={() => setDialog(false)} title="Apuntar AP">
            formulari
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(await screen.findByRole('button', { name: 'Obre el formulari' }));
    expect(await screen.findByRole('dialog', { name: 'Apuntar AP' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Apuntar AP' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Laia Puig' })).toBeInTheDocument();
  });
});
