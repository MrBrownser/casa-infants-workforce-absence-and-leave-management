import { Button } from '@/components/ui/button';

/** Disabled while pending; the server's operation receipts still guard against repeats. */
export function SubmitButton({ pending, children }: Readonly<{ pending: boolean; children: React.ReactNode }>) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending || undefined} className="h-11 md:h-10">
      {pending ? 'Desant…' : children}
    </Button>
  );
}
