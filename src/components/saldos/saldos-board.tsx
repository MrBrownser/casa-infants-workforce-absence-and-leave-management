// src/components/saldos/saldos-board.tsx
'use client';

import { useState, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Plus } from 'lucide-react';
import { deleteApAction, restoreApAction } from '@/app/(app)/[house]/saldos/actions';
import { Dialog } from '@/components/dialog';
import { HousePageHeader } from '@/components/house-page-header';
import { SAVE_FAILED_MESSAGE } from '@/components/team/use-server-action';
import { Button } from '@/components/ui/button';
import { UndoToast, type ToastMessage } from '@/components/undo-toast';
import type { ApRecord } from '@/lib/balances';
import type { HouseSlug } from '@/lib/houses';
import { matchesName, type SaldoRow, type SaldosView } from '@/lib/saldos';
import { ApForm } from './ap-form';
import { PersonSaldoSheet } from './person-saldo-sheet';
import { SaldosStats } from './saldos-stats';
import { SaldosTable } from './saldos-table';
import { SaldosToolbar } from './saldos-toolbar';
import { YearSwitcher } from './year-switcher';

// `open` and the content are kept apart so the dialog can animate out with its
// content; `key` gives every opening a fresh form.
type DialogState = { open: boolean; personId: string | null; key: number };

/** The Saldos page body (design D9): totals, filter, search, the list, a person's sheet, the AP form and "Desfés". */
export function SaldosBoard({
  houseSlug,
  houseName,
  currentYear,
  view,
  personId,
}: Readonly<{ houseSlug: HouseSlug; houseName: string; currentYear: number; view: SaldosView; personId: string | null }>) {
  const [oweOnly, setOweOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false, personId: null, key: 0 });
  const [deleting, startDelete] = useTransition();

  const keep = (row: SaldoRow) => (!oweOnly || row.balances.surplusMinutes < 0) && matchesName(row.person.fullName, query);
  const rows = view.rows.filter(keep);
  const former = view.former.filter(keep);
  const everyone = [...view.rows, ...view.former];
  // Only people listed here: a person of the other House or a stale id opens nothing.
  const personRow = personId ? (everyone.find((row) => row.person.id === personId) ?? null) : null;

  const showToast = (message: Omit<ToastMessage, 'key'>) => setToast((previous) => ({ ...message, key: (previous?.key ?? 0) + 1 }));
  const openDialog = (forPersonId: string | null) => setDialog((current) => ({ open: true, personId: forPersonId, key: current.key + 1 }));
  const closeDialog = () => setDialog((current) => ({ ...current, open: false }));

  function deleteAp(ap: ApRecord) {
    startDelete(async () => {
      try {
        const result = await deleteApAction(houseSlug, { apId: ap.id });
        if (!result.ok) {
          showToast({ text: result.message, error: true });
          return;
        }
        const { removed } = result.data;
        showToast({ text: 'Esborrat.', undo: () => restoreApAction(houseSlug, removed) });
      } catch (error) {
        // Let redirect() (for example to /no-access) keep working.
        unstable_rethrow(error);
        console.error(error);
        showToast({ text: SAVE_FAILED_MESSAGE, error: true });
      }
    });
  }

  function recorded({ id, text }: { id: string; text: string }) {
    closeDialog();
    showToast({ text, undo: () => deleteApAction(houseSlug, { apId: id }) });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <HousePageHeader houseName={houseName} title={`Saldos ${view.year}`} />
          <p className="max-w-prose text-muted-foreground">Vacances i hores d&apos;AP de cada persona.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <YearSwitcher houseSlug={houseSlug} year={view.year} currentYear={currentYear} />
          <Button type="button" onClick={() => openDialog(null)}>
            <Plus aria-hidden="true" />
            Apuntar AP
          </Button>
        </div>
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

      {personRow && (
        <PersonSaldoSheet
          key={personRow.person.id}
          houseSlug={houseSlug}
          year={view.year}
          row={personRow}
          deleting={deleting}
          onRecord={() => openDialog(personRow.person.id)}
          onDelete={deleteAp}
        />
      )}

      {/* Next to the Sheet, not inside it: Escape and outside press close only the dialog (checked in dialog.test.tsx). */}
      <Dialog open={dialog.open} onClose={closeDialog} title="Apuntar AP" description={`Saldos ${view.year}`}>
        <ApForm
          key={dialog.key}
          houseSlug={houseSlug}
          year={view.year}
          rows={everyone}
          initialPersonId={dialog.personId}
          onSaved={recorded}
          onCancel={closeDialog}
        />
      </Dialog>

      {toast && <UndoToast key={toast.key} toast={toast} onDismiss={() => setToast((current) => (current?.key === toast.key ? null : current))} />}
    </div>
  );
}
