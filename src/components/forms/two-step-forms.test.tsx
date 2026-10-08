import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { EndMembershipForm } from './end-membership-form';
import { HandoverForm } from './handover-form';
import { TransferForm } from './transfer-form';

const E1 = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const P1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const M1 = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';
const TOKEN = 'a'.repeat(64);

function twoStepAction() {
  return vi.fn(async (_state: ActionState, input: unknown): Promise<ActionState> =>
    (input as { intent: string }).intent === 'preview'
      ? { status: 'preview', lines: ['Marta Soler: lloc ER 1 a Paulo Freire acaba el 30 de juny del 2026.'], planToken: TOKEN }
      : { status: 'error', message: 'Les dades han canviat mentrestant. Torna a carregar la pàgina.' },
  );
}

describe('HandoverForm', () => {
  it('previews, then confirms with the plan token', async () => {
    const action = twoStepAction();
    render(
      <HandoverForm
        action={action}
        from="position"
        fixed={{ positionId: P1 }}
        members={[{ employeeId: E1, fullName: 'Ana Puig' }]}
        intro="Lloc ER 1"
        today="2026-07-01"
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Persona que entra'), E1);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    expect(await screen.findByText(/Marta Soler: lloc ER 1/)).toBeInTheDocument();
    expect(action).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ intent: 'preview', positionId: P1, employeeId: E1, from: 'position' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Les dades han canviat');
    expect(action).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ intent: 'confirm', planToken: TOKEN }));
  });

  it('cancels without writing', async () => {
    const action = twoStepAction();
    render(<HandoverForm action={action} from="position" fixed={{ positionId: P1 }} members={[{ employeeId: E1, fullName: 'Ana Puig' }]} intro="Lloc ER 1" today="2026-07-01" />);
    await userEvent.selectOptions(screen.getByLabelText('Persona que entra'), E1);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel·la' }));
    expect(screen.queryByRole('button', { name: 'Confirma' })).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Persona que entra')).toBeEnabled();
  });

  it('keeps one operation ID across preview and confirm, and lets the director preview again after a lost race', async () => {
    const action = twoStepAction();
    render(<HandoverForm action={action} from="position" fixed={{ positionId: P1 }} members={[{ employeeId: E1, fullName: 'Ana Puig' }]} intro="Lloc ER 1" today="2026-07-01" />);
    await userEvent.selectOptions(screen.getByLabelText('Persona que entra'), E1);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirma' }));
    await screen.findByRole('alert');
    const [preview, confirm] = action.mock.calls.map(([, input]) => input as { operationId: string });
    expect(confirm.operationId).toBe(preview.operationId);
    expect(screen.getByRole('button', { name: 'Revisa els canvis' })).toBeEnabled();
    expect(screen.getByLabelText('Persona que entra')).toBeEnabled();
  });
});

describe('EndMembershipForm', () => {
  it('previews the closures first', async () => {
    const action = twoStepAction();
    render(<EndMembershipForm action={action} membership={{ id: M1, startsOn: '2025-09-01' }} houseName="Paulo Freire" today="2026-08-31" />);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    expect(action).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ intent: 'preview', membershipId: M1, endsOn: '2026-08-31' }));
    expect(await screen.findByRole('button', { name: 'Confirma' })).toBeInTheDocument();
  });
});

describe('TransferForm', () => {
  it('names both Houses and sends the destination by slug', async () => {
    const action = twoStepAction();
    render(
      <TransferForm
        action={action}
        employeeId={E1}
        fromHouseName="Paulo Freire"
        toHouse={{ slug: 'carme-aymerich', name: 'Carme Aymerich' }}
        destinationPositions={[]}
        today="2026-05-10"
      />,
    );
    expect(screen.getByText(/De Paulo Freire a Carme Aymerich/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Primer dia a Carme Aymerich'), { target: { value: '2026-07-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    expect(action).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ intent: 'preview', employeeId: E1, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: null }),
    );
  });
});
