import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DurationInput } from './duration-input';

function Harness({ signed = false }: { signed?: boolean }) {
  const [value, setValue] = useState('');
  const [sign, setSign] = useState<'+' | '-'>('+');
  return (
    <>
      <label htmlFor="d">Excedent</label>
      <DurationInput id="d" value={value} onChange={setValue} sign={signed ? sign : undefined} onSignChange={signed ? setSign : undefined} />
      <output>{`${sign}${value}`}</output>
    </>
  );
}

describe('DurationInput', () => {
  it('inserts the colon and keeps only digits', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Excedent');
    await userEvent.type(input, '5530');
    expect(input).toHaveValue('55:30');
    await userEvent.clear(input);
    await userEvent.type(input, 'ab');
    expect(input).toHaveValue('');
  });

  it('offers + and − for a surplus', async () => {
    render(<Harness signed />);
    expect(screen.getByRole('radio', { name: 'Excedent positiu' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Excedent negatiu' }));
    await userEvent.type(screen.getByLabelText('Excedent'), '915');
    expect(screen.getByRole('status')).toHaveTextContent('-9:15');
  });

  it('has no sign choice for plain durations', () => {
    render(<Harness />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('marks itself invalid', () => {
    render(<DurationInput id="x" value="9:75" onChange={() => {}} invalid describedBy="x-error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'x-error');
  });
});
