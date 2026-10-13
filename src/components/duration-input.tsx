'use client';

import { Input } from '@/components/ui/input';
import { maskDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';

type Sign = '+' | '-';
const SIGNS: { value: Sign; text: string; label: string }[] = [
  { value: '+', text: '+', label: 'Excedent positiu' },
  { value: '-', text: '−', label: 'Excedent negatiu' },
];

/**
 * The one standard duration field (design D7): `H:MM` only, hours may exceed
 * 24. With `sign` and `onSignChange` it adds the + / − choice of a surplus.
 */
export function DurationInput({
  id,
  value,
  onChange,
  onBlur,
  sign,
  onSignChange,
  invalid,
  describedBy,
}: Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  sign?: Sign;
  onSignChange?: (sign: Sign) => void;
  invalid?: boolean;
  describedBy?: string;
}>) {
  return (
    <div className="flex items-center gap-2">
      {sign && onSignChange && (
        <div role="radiogroup" aria-label="Signe" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {SIGNS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={sign === option.value}
              aria-label={option.label}
              onClick={() => onSignChange(option.value)}
              className={cn(
                'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-base font-semibold transition-colors duration-150 ease-out md:min-h-9 md:min-w-9',
                sign === option.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(maskDuration(event.target.value))}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="off"
        placeholder="H:MM"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="w-28 tabular-nums"
      />
    </div>
  );
}
