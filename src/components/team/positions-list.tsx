import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ROLES } from '@/lib/roles';
import type { PositionRow } from '@/lib/staffing-views';

/** Every position grouped by role, with its occupant or "Vacant" (FR-005, FR-007). */
export function PositionsList({
  houseSlug,
  houseName,
  rows,
}: Readonly<{ houseSlug: string; houseName: string; rows: readonly PositionRow[] }>) {
  if (rows.length === 0) return <EmptyState>Encara no hi ha llocs de treball a {houseName}.</EmptyState>;
  const groups = ROLES.map((role) => ({ role, rows: rows.filter((row) => row.roleCode === role.code) })).filter((group) => group.rows.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ role, rows: items }) => (
        <section key={role.code} aria-labelledby={`role-${role.code}`} className="rounded-2xl bg-card shadow-clay">
          <h2 id={`role-${role.code}`} className="px-5 pt-4 text-xl">
            {role.label}
          </h2>
          <ul className="divide-y divide-border">
            {items.map((row) => (
              <li key={row.positionId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
                <Link href={`/${houseSlug}/team/positions/${row.positionId}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
                  {row.label}
                </Link>
                {row.occupant ? (
                  <Link href={`/${houseSlug}/team/${row.occupant.employeeId}`} className="text-sm text-foreground underline-offset-4 hover:underline">
                    {row.occupant.fullName}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Vacant</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
