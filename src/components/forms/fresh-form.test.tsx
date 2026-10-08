import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IDLE, type ActionState } from '@/lib/action-state';
import { FormCard } from './form-card';
import { CreatePositionForm } from './position-forms';

describe('FormCard form identity', () => {
  it('uses a new operation ID after the server re-renders the page (create, redirect, create again)', async () => {
    const operationIds: string[] = [];
    const action = vi.fn(async (_state: ActionState, input: unknown): Promise<ActionState> => {
      operationIds.push((input as { operationId: string }).operationId);
      return IDLE;
    });
    const page = () => (
      <FormCard title="Nou lloc">
        <CreatePositionForm action={action} />
      </FormCard>
    );
    const { rerender } = render(page());
    await userEvent.type(screen.getByLabelText('Nom del lloc'), 'ER 7');
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    const [first, retry] = operationIds;
    expect(retry).toBe(first);

    rerender(page());
    await userEvent.type(screen.getByLabelText('Nom del lloc'), 'ER 8');
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    expect(operationIds.at(-1)).not.toBe(first);
  });
});
