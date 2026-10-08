import Link from 'next/link';
import { FutureTag } from '@/components/future-tag';
import { formatPeriodCa, type IsoDate } from '@/lib/dates';
import type { PositionDetail } from '@/lib/staffing-views';

/** Successive occupants of one stable position (AC-004). */
export function PositionHistory({
  houseSlug,
  rows,
  today,
}: Readonly<{ houseSlug: string; rows: PositionDetail['history']; today: IsoDate }>) {
  if (rows.length === 0) return <p className="text-[0.9375rem] text-muted-foreground">Aquest lloc encara no ha tingut cap ocupant.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <Link href={`/${houseSlug}/team/${row.employeeId}`} className="inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline md:min-h-0">
            {row.fullName}
          </Link>
          <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
            {row.startsOn > today && <FutureTag />}
            {formatPeriodCa(row)}
          </span>
        </li>
      ))}
    </ul>
  );
}
