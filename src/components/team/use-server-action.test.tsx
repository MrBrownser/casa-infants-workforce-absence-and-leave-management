import { Component, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import type { ActionResult } from '@/lib/action-result';
import { SAVE_FAILED_MESSAGE, useServerAction } from './use-server-action';

function Harness({ action, onSuccess }: { action: () => Promise<ActionResult>; onSuccess?: () => void }) {
  const { error, saved, pending, run } = useServerAction();
  return (
    <div>
      <button onClick={() => run(action, onSuccess)}>go</button>
      <p data-testid="state">{pending ? 'pending' : 'idle'}</p>
      {saved && <p>saved</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { caught: string | null }> {
  state = { caught: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { caught: String((e as Error & { digest?: string }).digest ?? e.message) };
  }
  render() {
    return this.state.caught ? <p data-testid="caught">{this.state.caught}</p> : this.props.children;
  }
}

describe('useServerAction', () => {
  it('marks saved and calls onSuccess on success', async () => {
    const onSuccess = vi.fn();
    render(<Harness action={async () => ({ ok: true })} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByText('go'));
    expect(await screen.findByText('saved')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('shows the message of a failed result', async () => {
    render(<Harness action={async () => ({ ok: false, message: 'Aquesta plaça ja està ocupada.' })} />);
    await userEvent.click(screen.getByText('go'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aquesta plaça ja està ocupada.');
  });

  it('shows a Catalan message when the action throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Harness
        action={async () => {
          throw new Error('db down');
        }}
      />,
    );
    await userEvent.click(screen.getByText('go'));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED_MESSAGE);
    expect(screen.queryByText('saved')).not.toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('rethrows redirect errors instead of showing the message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Boundary>
        <Harness
          action={async () => {
            redirect('/no-access');
          }}
        />
      </Boundary>,
    );
    await act(async () => {
      await userEvent.click(screen.getByText('go'));
    });
    expect(await screen.findByTestId('caught')).toHaveTextContent(/NEXT_REDIRECT/);
    expect(screen.queryByText(SAVE_FAILED_MESSAGE)).not.toBeInTheDocument();
  });
});
