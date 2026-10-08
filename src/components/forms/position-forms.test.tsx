import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { CreatePositionForm, RelabelPositionForm } from './position-forms';

const P1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('CreatePositionForm', () => {
  it('offers the nine roles and requires a label', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'error', message: 'Ja hi ha un lloc amb aquest nom en aquesta casa.' }));
    render(<CreatePositionForm action={action} />);
    expect(screen.getAllByRole('option')).toHaveLength(9);
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    expect(await screen.findByText('Escriu un nom per al lloc.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'CT');
    await userEvent.type(screen.getByLabelText('Nom del lloc'), 'CT nit');
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ja hi ha un lloc amb aquest nom');
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ roleCode: 'CT', label: 'CT nit' }));
  });
});

describe('RelabelPositionForm', () => {
  it('only edits the label', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<RelabelPositionForm action={action} positionId={P1} label="ER 1" />);
    await userEvent.clear(screen.getByLabelText('Nom del lloc'));
    await userEvent.type(screen.getByLabelText('Nom del lloc'), 'ER matins');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    const [, input] = action.mock.calls[0] as unknown as [ActionState, Record<string, unknown>];
    expect(Object.keys(input).sort()).toEqual(['label', 'operationId', 'positionId']);
  });

  it('shows a label-taken error from the action', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'error', message: 'Ja hi ha un lloc amb aquest nom en aquesta casa.' }));
    render(<RelabelPositionForm action={action} positionId={P1} label="ER 1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ja hi ha un lloc amb aquest nom');
  });
});
