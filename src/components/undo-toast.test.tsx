import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_MS, UndoToast } from './undo-toast';

const RULE = "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.";

afterEach(() => vi.useRealTimers());

describe('UndoToast', () => {
  it('shows the message and goes away after 6 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: 1, text: 'Esborrat.' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('Esborrat.');
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('undoes once, even when "Desfés" is pressed twice, and goes away', async () => {
    let resolve!: (result: { ok: true }) => void;
    const undo = vi.fn(() => new Promise<{ ok: true }>((r) => (resolve = r)));
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: 1, text: 'Esborrat.', undo }} onDismiss={onDismiss} />);
    const button = screen.getByRole('button', { name: 'Desfés' });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(undo).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows why an undo failed, with an icon, and stays', async () => {
    const undo = vi.fn(async () => ({ ok: false as const, message: RULE }));
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: 1, text: 'Esborrat.', undo }} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Desfés' }));
    expect(await screen.findByText(RULE)).toBeInTheDocument();
    expect(screen.getByRole('status').querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows an error message without "Desfés"', () => {
    render(<UndoToast toast={{ key: 1, text: 'Aquest AP ja no existeix.', error: true }} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Aquest AP ja no existeix.');
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
  });
});
