import { FutureTag } from '@/components/future-tag';
import { formatPeriodCa, type IsoDate } from '@/lib/dates';
import { findRole } from '@/lib/roles';
import type { EmployeeHistory } from '@/lib/staffing-views';

/** Every membership and assignment, in both Houses, including future periods (FR-005). */
export function EmployeeHistoryView({ history, today }: Readonly<{ history: EmployeeHistory; today: IsoDate }>) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="memberships-title" className="rounded-2xl bg-card p-5 shadow-clay">
        <h2 id="memberships-title" className="text-xl">
          Pertinença
        </h2>
        <ul className="mt-2 divide-y divide-border">
          {history.memberships.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-medium text-foreground">{m.houseName}</span>
              <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
                {m.startsOn > today && <FutureTag />}
                {formatPeriodCa(m)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="positions-title" className="rounded-2xl bg-card p-5 shadow-clay">
        <h2 id="positions-title" className="text-xl">
          Llocs
        </h2>
        {history.assignments.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">Encara no ha ocupat cap lloc.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {history.assignments.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-3">
                <span className="font-medium text-foreground">
                  {a.positionLabel} · {findRole(a.roleCode)?.label ?? a.roleCode}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm tabular-nums text-muted-foreground">
                  {a.startsOn > today && <FutureTag />}
                  {a.houseName} · {formatPeriodCa(a)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
