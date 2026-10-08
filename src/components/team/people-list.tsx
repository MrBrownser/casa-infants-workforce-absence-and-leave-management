import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { formatDateCa } from '@/lib/dates';
import type { PersonRow } from '@/lib/staffing-views';
import { cn } from '@/lib/utils';

/** Members on the selected date with their position (FR-005). */
export function PeopleList({
  houseSlug,
  houseName,
  rows,
  isToday,
}: Readonly<{ houseSlug: string; houseName: string; rows: readonly PersonRow[]; isToday: boolean }>) {
  if (rows.length === 0) {
    return (
      <EmptyState>
        {isToday ? `Encara no hi ha ningú a l'equip de ${houseName}.` : `Ningú no formava part de l'equip de ${houseName} aquest dia.`}
      </EmptyState>
    );
  }
  return (
    <section aria-label={`Equip de ${houseName}`} className="rounded-2xl bg-card shadow-clay">
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <Link href={`/${houseSlug}/team/${row.employeeId}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
                {row.fullName}
              </Link>
              <span className={cn('text-sm', row.positionLabel ? 'text-foreground' : 'text-muted-foreground')}>
                {row.positionLabel ?? 'Sense lloc assignat'}
              </span>
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">Des del {formatDateCa(row.memberSince)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
