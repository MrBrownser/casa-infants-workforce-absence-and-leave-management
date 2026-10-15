// src/components/saldos/person-saldo-sheet.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hourglass, Plus, Trash2 } from 'lucide-react';
import { Callout } from '@/components/callout';
import { Sheet } from '@/components/sheet';
import { personHref } from '@/components/team/post-card';
import { Button } from '@/components/ui/button';
import type { ApKind, ApRecord, KindBalance } from '@/lib/balances';
import { formatDuration } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { apDateLabel, saldosHref, vacationLabel, type SaldoRow } from '@/lib/saldos';
import { describePerson } from '@/lib/team';
import { cn } from '@/lib/utils';

function Tile({ label, value, warn = false }: Readonly<{ label: string; value: string; warn?: boolean }>) {
  return (
    <div className={cn('rounded-xl p-3', warn ? 'bg-warning-bg' : 'bg-background')}>
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 text-base font-semibold tabular-nums">
        {warn && <Hourglass aria-hidden="true" className="size-4 shrink-0 text-warning" />}
        {value}
      </dd>
    </div>
  );
}

function ApList({
  title,
  kind,
  balance,
  aps,
  year,
  deleting,
  onDelete,
  empty,
}: Readonly<{
  title: string;
  kind: ApKind;
  balance: KindBalance;
  aps: readonly ApRecord[];
  year: number;
  deleting: boolean;
  onDelete: (ap: ApRecord) => void;
  empty: string;
}>) {
  const own = aps.filter((ap) => ap.kind === kind);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
        {title}
        <span className="text-[0.8125rem] font-normal tabular-nums text-muted-foreground">
          {formatDuration(balance.usedMinutes)} de {formatDuration(balance.capMinutes)} · {balance.count}/{balance.maxCount} dies
        </span>
      </h3>
      {own.length === 0 ? (
        <p className="rounded-xl border border-border px-3.5 py-3 text-[0.875rem] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {own.map((ap) => {
            const label = apDateLabel(ap.date, year);
            return (
              <li key={ap.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span aria-hidden="true" className={cn('w-1.5 self-stretch rounded-full', kind === 'recoverable' ? 'bg-sage' : 'bg-sage-foreground/60')} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {label.text}
                    {label.note && <span className="text-[0.8125rem] font-normal text-muted-foreground"> ({label.note})</span>}
                  </p>
                  {kind === 'recoverable' && <p className="text-[0.8125rem] text-muted-foreground">Descomptat de l&apos;excedent</p>}
                </div>
                <span className="text-[0.875rem] font-semibold tabular-nums">{formatDuration(ap.minutes)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={deleting}
                  aria-label={`Esborra l'AP del ${label.text}`}
                  onClick={() => onDelete(ap)}
                  className="text-muted-foreground hover:text-error"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A person's balances and APs of the year, opened from Saldos with `?person=<id>` (design D9). */
export function PersonSaldoSheet({
  houseSlug,
  year,
  row,
  deleting,
  onRecord,
  onDelete,
}: Readonly<{
  houseSlug: HouseSlug;
  year: number;
  row: SaldoRow;
  deleting: boolean;
  onRecord: () => void;
  onDelete: (ap: ApRecord) => void;
}>) {
  const router = useRouter();
  // Starts closed and opens on the next frame: Base UI only animates a drawer
  // that goes from closed to open. Closing animates first, then leaves the URL.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const { person, balances: b, aps } = row;
  const owes = b.surplusMinutes < 0;

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onClosed={() => router.push(saldosHref(houseSlug, year), { scroll: false })}
      title={person.fullName}
      description={describePerson(person)}
    >
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-3 gap-2">
          <Tile label="Vacances" value={vacationLabel(b)} />
          <Tile label="AP no recuperables" value={`Queden ${formatDuration(b.nonRecoverable.leftMinutes)}`} />
          <Tile
            label="Excedent calendari"
            value={owes ? `Deu ${formatDuration(-b.surplusMinutes)}` : formatDuration(b.surplusMinutes, { signed: true })}
            warn={owes}
          />
        </dl>
        {owes && <Callout tone="warning">Ha de retornar {formatDuration(-b.surplusMinutes)} treballant quan calgui.</Callout>}
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onRecord}>
          <Plus aria-hidden="true" />
          Apuntar AP
        </Button>
        <section className="flex flex-col gap-2">
          <h3 className="text-[0.9375rem]">Vacances</h3>
          <p className="text-[0.875rem] tabular-nums">
            {vacationLabel(b)} · <span className="text-muted-foreground">Els períodes s&apos;apuntaran a Vacances.</span>
          </p>
        </section>
        <ApList
          title="AP no recuperables"
          kind="non_recoverable"
          balance={b.nonRecoverable}
          aps={aps}
          year={year}
          deleting={deleting}
          onDelete={onDelete}
          empty="Cap AP no recuperable aquest any."
        />
        <ApList
          title="AP recuperables"
          kind="recoverable"
          balance={b.recoverable}
          aps={aps}
          year={year}
          deleting={deleting}
          onDelete={onDelete}
          empty="Cap AP recuperable aquest any."
        />
        <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
          Excedent a l&apos;inici de l&apos;any: {formatDuration(b.openingSurplusMinutes, { signed: true })} ·{' '}
          <Link href={personHref(houseSlug, person.id, year)} className="font-medium text-primary underline-offset-4 hover:underline">
            Edita&apos;l a Equip
          </Link>
        </p>
      </div>
    </Sheet>
  );
}
