import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Callout } from './callout';

describe('Callout', () => {
  it('announces an error, with an icon', () => {
    render(<Callout tone="error">La data ha de ser entre el 01/01/2026 i el 31/01/2027.</Callout>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('La data ha de ser entre el 01/01/2026 i el 31/01/2027.');
    expect(alert.querySelector('svg')).not.toBeNull();
  });

  it('shows a warning with an icon and no alert role', () => {
    const { container } = render(<Callout tone="warning">És festiu (Nadal).</Callout>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
