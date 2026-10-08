import { CircleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';

/** Props that tie a control to its label and error message. */
export function describedBy(id: string, error?: string) {
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined } as const;
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: Readonly<{ id: string; label: string; error?: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
