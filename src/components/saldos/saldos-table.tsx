import Link from 'next/link';
import { ChevronRight, Hourglass } from 'lucide-react';
import { formatDuration } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { initials, saldosHref, vacationLabel, type SaldoRow } from '@/lib/saldos';
import { cn } from '@/lib/utils';

/** The current surplus: signed, or "Deu …" with an hourglass when the person owes hours (warning tokens, never honey). */
export function SurplusValue({ minutes }: Readonly<{ minutes: number }>) {
  if (minutes >= 0) return <span className="font-semibold tabular-nums">{formatDuration(minutes, { signed: true })}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warning-bg px-2 py-0.5 font-semibold tabular-nums text-foreground">
      <Hourglass aria-hidden="true" className="size-4 text-warning" />
      Deu {formatDuration(-minutes)}
    </span>
  );
}

function Avatar({ name }: Readonly<{ name: string }>) {
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-[0.8125rem] font-semibold text-sage-foreground">
      {initials(name)}
    </span>
  );
}

function Meter({ value, max }: Readonly<{ value: number; max: number }>) {
  const percent = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-sage-foreground/70" style={{ width: `${percent}%` }} />
    </div>
  );
}

function Tile({ label, value, warn = false }: Readonly<{ label: string; value: string; warn?: boolean }>) {
  return (
    <span className={cn('block rounded-lg p-2.5', warn ? 'bg-warning-bg' : 'bg-background')}>
      <span className="block text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-semibold tabular-nums">
        {warn && <Hourglass aria-hidden="true" className="size-4 shrink-0 text-warning" />}
        {value}
      </span>
    </span>
  );
}

/** Desktop table and mobile cards (DESIGN.md: no sidebar, cards on mobile). Each person opens their details. */
export function SaldosTable({ houseSlug, year, rows }: Readonly<{ houseSlug: HouseSlug; year: number; rows: readonly SaldoRow[] }>) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl bg-card shadow-clay md:block">
        <table className="w-full text-left">
          <thead className="border-b border-border bg-background/60">
            <tr className="text-[0.8125rem] text-muted-foreground">
              <th scope="col" className="py-3 pl-5 pr-3 font-medium">Persona</th>
              <th scope="col" className="w-[16%] px-3 py-3 font-medium">Vacances</th>
              <th scope="col" className="w-[22%] px-3 py-3 font-medium">AP no recuperables</th>
              <th scope="col" className="w-[16%] px-3 py-3 font-medium">AP recuperables</th>
              <th scope="col" className="w-[16%] px-3 py-3 font-medium">Excedent calendari</th>
              <th scope="col" className="w-10 py-3 pr-4"><span className="sr-only">Obre</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, postLabel, balances: b }) => (
              <tr key={person.id} className="relative border-b border-border transition-colors duration-150 ease-out last:border-0 hover:bg-hover">
                <td className="py-3.5 pl-5 pr-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={person.fullName} />
                    <div className="min-w-0">
                      <Link href={saldosHref(houseSlug, year, person.id)} scroll={false} className="font-semibold leading-tight after:absolute after:inset-0">
                        {person.fullName}
                      </Link>
                      <p className="truncate text-[0.8125rem] text-muted-foreground">{postLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-[0.875rem] font-semibold tabular-nums">{vacationLabel(b)}</td>
                <td className="px-3 py-3.5">
                  <Meter value={b.nonRecoverable.usedMinutes} max={b.nonRecoverable.capMinutes} />
                  <p className="mt-1.5 text-[0.8125rem] tabular-nums">
                    <span className="font-semibold">Queden {formatDuration(b.nonRecoverable.leftMinutes)}</span>
                    <span className="text-muted-foreground"> · {b.nonRecoverable.count}/{b.nonRecoverable.maxCount} dies</span>
                  </p>
                </td>
                <td className="px-3 py-3.5 text-[0.875rem] tabular-nums">
                  {b.recoverable.count > 0 ? (
                    `${formatDuration(b.recoverable.usedMinutes)} usades · ${b.recoverable.count}/${b.recoverable.maxCount}`
                  ) : (
                    <span className="text-muted-foreground">Cap</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-[0.875rem]">
                  <SurplusValue minutes={b.surplusMinutes} />
                </td>
                <td className="py-3.5 pr-4 text-muted-foreground">
                  <ChevronRight aria-hidden="true" className="size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map(({ person, postLabel, balances: b }) => (
          <li key={person.id}>
            <Link href={saldosHref(houseSlug, year, person.id)} scroll={false} className="block rounded-xl bg-card p-4 shadow-clay active:bg-hover">
              <span className="flex items-center gap-3">
                <Avatar name={person.fullName} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{person.fullName}</span>
                  <span className="block truncate text-[0.8125rem] text-muted-foreground">{postLabel}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </span>
              <span className="mt-3.5 grid grid-cols-3 gap-2 text-[0.8125rem]">
                <Tile label="Vacances" value={`${b.vacationTotal} dies`} />
                <Tile label="AP no rec." value={formatDuration(b.nonRecoverable.leftMinutes)} />
                <Tile
                  label="Excedent"
                  value={b.surplusMinutes < 0 ? `Deu ${formatDuration(-b.surplusMinutes)}` : formatDuration(b.surplusMinutes, { signed: true })}
                  warn={b.surplusMinutes < 0}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
