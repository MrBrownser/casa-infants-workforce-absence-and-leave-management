'use client';

import { Input } from '@/components/ui/input';
import { maskDate } from '@/lib/dates';

/** Always reads and writes dd/mm/aaaa, whatever the browser language (docs/domain.md §10). */
export function DateInput({
  value,
  onChange,
  ...props
}: Readonly<Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void }>) {
  return (
    <Input
      {...props}
      value={value}
      onChange={(event) => onChange(maskDate(event.target.value))}
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      className="w-36 tabular-nums"
    />
  );
}
