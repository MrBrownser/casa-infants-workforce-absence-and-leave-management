import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPersonAction } from '@/app/(app)/[house]/team/actions';
import { AddPersonForm } from './add-person-form';

vi.mock('@/app/(app)/[house]/team/actions', () => ({ addPersonAction: vi.fn() }));

const SEAT = 'paulo-freire:er:1';

beforeEach(() => vi.clearAllMocks());

describe('AddPersonForm', () => {
  it('shows the server error with an icon and keeps the form open and filled', async () => {
    const message = "Aquest lloc ja l'ocupa Carla Ribas Solé.";
    vi.mocked(addPersonAction).mockResolvedValue({ ok: false, message });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<AddPersonForm houseSlug="paulo-freire" seat={SEAT} onDone={onDone} />);

    await user.type(screen.getByLabelText('Nom complet'), 'Marta Puig Vidal');
    await user.click(screen.getByRole('button', { name: 'Afegeix' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nom complet')).toHaveValue('Marta Puig Vidal');
  });

  it('calls onDone once when the action succeeds', async () => {
    vi.mocked(addPersonAction).mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<AddPersonForm houseSlug="paulo-freire" seat={SEAT} onDone={onDone} />);

    await user.type(screen.getByLabelText('Nom complet'), 'Marta Puig Vidal');
    await user.click(screen.getByRole('button', { name: 'Afegeix' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(addPersonAction).toHaveBeenCalledWith('paulo-freire', { fullName: 'Marta Puig Vidal', startedOn: '', seat: SEAT });
  });
});
