import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DateInput } from './date-input';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="d">Des del</label>
      <DateInput id="d" value={value} onChange={setValue} />
    </>
  );
}

describe('DateInput', () => {
  it('writes dd/mm/aaaa while typing digits', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Des del');
    expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa');
    await userEvent.type(input, '01072026');
    expect(input).toHaveValue('01/07/2026');
  });
});
