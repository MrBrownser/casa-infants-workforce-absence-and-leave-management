import { Clock, Hourglass } from 'lucide-react';
import { formatDuration } from '@/lib/duration';
import type { SaldosTotals } from '@/lib/saldos';
import { cn } from '@/lib/utils';

const label = 'flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground';
const value = 'mt-1 block text-[1.5rem] font-[650] leading-tight tabular-nums sm:text-[1.875rem]';
const sub = 'block text-[0.8125rem] tabular-nums text-muted-foreground';

/** Two totals for the active people listed; the second one toggles the "Deuen hores" filter. */
export function SaldosStats({
  totals,
  oweOnly,
  onToggleOwe,
}: Readonly<{ totals: SaldosTotals; oweOnly: boolean; onToggleOwe: () => void }>) {
  const { apnrUsedMinutes, apnrCapMinutes, owePeople, oweMinutes } = totals;
  return (
    <section aria-label="Resum" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:gap-4">
      <div className="rounded-xl bg-card p-4 shadow-clay">
        <p className={label}>
          <Clock aria-hidden="true" className="size-4" />
          AP no recuperables usats
        </p>
        <p className={value}>{formatDuration(apnrUsedMinutes)}</p>
        <p className={sub}>de {formatDuration(apnrCapMinutes)} de tot l&apos;equip</p>
      </div>
      <button
        type="button"
        aria-pressed={oweOnly}
        onClick={onToggleOwe}
        className={cn(
          'rounded-xl bg-card p-4 text-left shadow-clay transition-colors duration-150 ease-out hover:bg-hover',
          oweOnly && 'ring-2 ring-primary',
        )}
      >
        <span className={label}>
          <Hourglass aria-hidden="true" className="size-4" />
          Han de retornar hores
        </span>
        <span className={value}>
          {owePeople} {owePeople === 1 ? 'persona' : 'persones'}
        </span>
        <span className={sub}>
          {owePeople ? `${formatDuration(oweMinutes)} en total, per cobrir necessitats puntuals` : "Ningú té l'excedent en negatiu"}
        </span>
      </button>
    </section>
  );
}
