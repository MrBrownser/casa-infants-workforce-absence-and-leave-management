import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('announces errors with an icon and text, never honey', () => {
    render(<Alert variant="error">No s&apos;ha pogut desar.</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("No s'ha pogut desar.");
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(alert.className).not.toMatch(/accent/);
  });

  it('uses a status role for information and success', () => {
    render(<Alert variant="success">Persona afegida.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Persona afegida.');
  });
});
