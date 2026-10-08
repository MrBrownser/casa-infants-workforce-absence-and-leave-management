import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/input';
import { ConfirmPanel } from './confirm-panel';
import { DoneNote } from './done-note';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';

describe('Field', () => {
  it('links the label and shows the error with an icon', () => {
    render(
      <Field id="fullName" label="Nom complet" error="Escriu el nom complet.">
        <Input {...describedBy('fullName', 'Escriu el nom complet.')} />
      </Field>,
    );
    const input = screen.getByLabelText('Nom complet');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'fullName-error');
    const error = screen.getByText('Escriu el nom complet.');
    expect(error.querySelector('svg')).not.toBeNull();
  });
});

describe('SubmitButton', () => {
  it('is disabled while pending', () => {
    const { rerender } = render(<SubmitButton pending={false}>Desa</SubmitButton>);
    expect(screen.getByRole('button', { name: 'Desa' })).toBeEnabled();
    rerender(<SubmitButton pending>Desa</SubmitButton>);
    expect(screen.getByRole('button', { name: 'Desant…' })).toBeDisabled();
  });
});

describe('ConfirmPanel', () => {
  it('lists the changes and confirms or cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmPanel lines={['Ana Puig: lloc ER 1 a Paulo Freire comença el 1 de juliol del 2026.']} pending={false} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Ana Puig');
    await userEvent.click(screen.getByRole('button', { name: 'Confirma' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel·la' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('FormStatus and DoneNote', () => {
  it('shows only errors', () => {
    const { container } = render(<FormStatus state={{ status: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
    render(<FormStatus state={{ status: 'error', message: 'Aquest lloc ja està ocupat en aquestes dates.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('ocupat');
  });

  it('says when a retry changed nothing', () => {
    render(<DoneNote done="person-created" repeat />);
    expect(screen.getByRole('status')).toHaveTextContent("Aquesta acció ja s'havia desat. No s'ha duplicat res.");
  });
});
