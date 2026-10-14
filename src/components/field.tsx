import { Check, CircleAlert } from 'lucide-react';

/** Crimson is close to terracotta (DESIGN.md): errors always carry an icon and text. */
export function ErrorText({ id, children }: Readonly<{ id?: string; children: React.ReactNode }>) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-error">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SuccessText({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-success">
      <Check aria-hidden="true" className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Label, control, hint or error. The control sets aria-describedby to `${id}-error` when there is one. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: Readonly<{ id: string; label: string; hint?: string; error?: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[0.8125rem] text-muted-foreground">{hint}</p>}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}
