import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HouseError from './error';

describe('House error boundary', () => {
  it('shows the Catalan message with an icon and retries on click', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    const { container } = render(<HouseError error={new Error('boom')} unstable_retry={retry} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alguna cosa ha anat malament');
    expect(screen.getByRole('alert').querySelector('svg')).not.toBeNull();
    expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders inside the House layout, so it draws no second top bar', () => {
    render(<HouseError error={new Error('boom')} unstable_retry={() => {}} />);
    expect(screen.queryByRole('link', { name: /Casa d'Infants/ })).toBeNull();
  });
});
