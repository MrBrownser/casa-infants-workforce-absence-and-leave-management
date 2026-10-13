import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { Input } from './ui/input';

describe('Field', () => {
  it('labels its input and shows errors with an icon and text', () => {
    render(
      <Field id="name" label="Nom complet" error="Escriu el nom complet.">
        <Input id="name" aria-invalid aria-describedby="name-error" />
      </Field>,
    );
    expect(screen.getByLabelText('Nom complet')).toHaveAttribute('aria-describedby', 'name-error');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Escriu el nom complet.');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(alert).toHaveAttribute('id', 'name-error');
  });

  it('shows the hint only without an error', () => {
    render(
      <Field id="d" label="Data" hint="dd/mm/aaaa">
        <Input id="d" />
      </Field>,
    );
    expect(screen.getByText('dd/mm/aaaa')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
