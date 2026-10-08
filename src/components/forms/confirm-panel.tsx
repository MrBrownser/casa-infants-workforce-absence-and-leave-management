import { Button } from '@/components/ui/button';

/** Step two of handovers, transfers and ending a membership: nothing is written until "Confirma". */
export function ConfirmPanel({
  lines,
  pending,
  onConfirm,
  onCancel,
}: Readonly<{ lines: readonly string[]; pending: boolean; onConfirm: () => void; onCancel: () => void }>) {
  return (
    <section aria-labelledby="confirm-title" className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <p id="confirm-title" className="font-semibold text-foreground">
        Revisa els canvis abans de confirmar
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm tabular-nums text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirm} disabled={pending} className="h-11 md:h-10">
          {pending ? 'Desant…' : 'Confirma'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending} className="h-11 md:h-10">
          Cancel·la
        </Button>
      </div>
    </section>
  );
}
