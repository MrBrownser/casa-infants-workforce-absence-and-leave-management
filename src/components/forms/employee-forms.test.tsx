import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { EditNameForm } from './edit-name-form';
import { EndAssignmentForm } from './end-assignment-form';

const E1 = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const A1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('EditNameForm', () => {
  it('sends the loaded version with the new name', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<EditNameForm action={action} employeeId={E1} fullName="Ana Puig" updatedAt="2026-10-01T10:00:00.000Z" />);
    const input = screen.getByLabelText('Nom complet');
    await userEvent.clear(input);
    await userEvent.type(input, 'Anna Puig');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ employeeId: E1, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' }));
  });
});

describe('EndAssignmentForm', () => {
  it('defaults the end to today and names the position', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<EndAssignmentForm action={action} assignment={{ id: A1, positionLabel: 'ER 1', startsOn: '2026-01-01' }} today="2026-10-08" />);
    expect(screen.getByText(/ER 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finalitza el lloc' }));
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ assignmentId: A1, endsOn: '2026-10-08' }));
  });
});
