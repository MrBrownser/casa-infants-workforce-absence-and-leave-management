import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { AddMembershipForm } from './add-membership-form';
import { CreatePersonForm } from './create-person-form';

const POS = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const EMP = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const positions = [
  { positionId: POS, label: 'ER 1', roleCode: 'ER' as const, occupant: null },
  { positionId: 'p2', label: 'CT', roleCode: 'CT' as const, occupant: { employeeId: 'x', fullName: 'Pol Jiménez Alcover' } },
];

describe('CreatePersonForm', () => {
  it('validates in Catalan and keeps the typed values', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<CreatePersonForm action={action} houseName="Paulo Freire" today="2026-10-08" positions={positions} />);
    // jsdom date inputs: set the whole value (typing digit by digit is unreliable).
    fireEvent.change(screen.getByLabelText('Final (opcional)'), { target: { value: '2026-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix la persona' }));
    expect(await screen.findByText('Escriu el nom complet.')).toBeInTheDocument();
    expect(screen.getByText("La data de final no pot ser anterior a la d'inici.")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Final (opcional)')).toHaveValue('2026-01-01');
  });

  it('labels occupied positions and submits parsed values with an operation ID', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'error', message: 'Aquest lloc ja està ocupat en aquestes dates.' }));
    render(<CreatePersonForm action={action} houseName="Paulo Freire" today="2026-10-08" positions={positions} />);
    expect(screen.getByRole('option', { name: 'CT · Corretor (ara: Pol Jiménez Alcover)' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nom complet'), '  Ana Puig ');
    await userEvent.selectOptions(screen.getByLabelText('Lloc (opcional)'), POS);
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix la persona' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ocupat');
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, {
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      fullName: 'Ana Puig',
      startsOn: '2026-10-08',
      endsOn: null,
      positionId: POS,
    });
    expect(screen.getByLabelText('Nom complet')).toHaveValue('  Ana Puig ');
  });
});

describe('AddMembershipForm', () => {
  it('picks an existing person and shows where they are now', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(
      <AddMembershipForm
        action={action}
        houseName="Paulo Freire"
        today="2026-10-08"
        positions={positions}
        employees={[{ employeeId: EMP, fullName: 'Ana Puig', currentHouseName: 'Carme Aymerich' }]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Persona'), EMP);
    expect(screen.getByRole('option', { name: 'Ana Puig (ara a Carme Aymerich)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix el període' }));
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ employeeId: EMP, startsOn: '2026-10-08', positionId: null }));
  });
});
