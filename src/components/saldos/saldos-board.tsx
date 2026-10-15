'use client';

import { useState } from 'react';
import { HousePageHeader } from '@/components/house-page-header';
import type { HouseSlug } from '@/lib/houses';
import { matchesName, type SaldoRow, type SaldosView } from '@/lib/saldos';
import { SaldosStats } from './saldos-stats';
import { SaldosTable } from './saldos-table';
import { SaldosToolbar } from './saldos-toolbar';
import { YearSwitcher } from './year-switcher';

/** The Saldos page body (design D9): totals, filter, search, the list and former members. */
export function SaldosBoard({
  houseSlug,
  houseName,
  currentYear,
  view,
}: Readonly<{ houseSlug: HouseSlug; houseName: string; currentYear: number; view: SaldosView; personId: string | null }>) {
  const [oweOnly, setOweOnly] = useState(false);
  const [query, setQuery] = useState('');
  const keep = (row: SaldoRow) => (!oweOnly || row.balances.surplusMinutes < 0) && matchesName(row.person.fullName, query);
  const rows = view.rows.filter(keep);
  const former = view.former.filter(keep);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <HousePageHeader houseName={houseName} title={`Saldos ${view.year}`} />
          <p className="max-w-prose text-muted-foreground">Vacances i hores d&apos;AP de cada persona.</p>
        </div>
        <YearSwitcher houseSlug={houseSlug} year={view.year} currentYear={currentYear} />
      </div>

      <SaldosStats totals={view.totals} oweOnly={oweOnly} onToggleOwe={() => setOweOnly((value) => !value)} />

      <section aria-labelledby="saldos-team" className="flex flex-col gap-3">
        <SaldosToolbar oweOnly={oweOnly} onOweOnlyChange={setOweOnly} query={query} onQueryChange={setQuery} />
        {rows.length > 0 ? (
          <SaldosTable houseSlug={houseSlug} year={view.year} rows={rows} />
        ) : (
          <p className="rounded-2xl bg-card p-8 text-center text-muted-foreground shadow-clay">Ningú coincideix amb aquest filtre.</p>
        )}
      </section>

      {former.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer font-display text-xl">
            Antics membres <span className="font-sans text-[0.8125rem] tabular-nums text-muted-foreground">({former.length})</span>
          </summary>
          <div className="mt-3">
            <SaldosTable houseSlug={houseSlug} year={view.year} rows={former} />
          </div>
        </details>
      )}
    </div>
  );
}
