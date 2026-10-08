import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { formatPeriodCa } from '@/lib/dates';
import type { FormerRow } from '@/lib/staffing-views';

export function FormerMembersList({
  houseSlug,
  houseName,
  rows,
}: Readonly<{ houseSlug: string; houseName: string; rows: readonly FormerRow[] }>) {
  if (rows.length === 0) return <EmptyState>No hi ha membres anteriors a {houseName}.</EmptyState>;
  return (
    <section aria-label={`Membres anteriors de ${houseName}`} className="rounded-2xl bg-card shadow-clay">
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <Link href={`/${houseSlug}/team/${row.employeeId}`} className="inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-4 hover:underline md:min-h-0">
              {row.fullName}
            </Link>
            <span className="text-sm tabular-nums text-muted-foreground">{formatPeriodCa(row)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
