import { HouseMark } from '@/components/house-mark';
import { formatDateCa } from '@/lib/dates';
import type { TeamMember } from '@/lib/house-membership';

/** Current members of one House (FR-006). Read-only until SPEC-002 adds people management. */
export function TeamList({ houseName, members }: Readonly<{ houseName: string; members: readonly TeamMember[] }>) {
  if (members.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center shadow-clay">
        <HouseMark className="size-24" />
        <p className="text-[0.9375rem] text-muted-foreground">Encara no hi ha ningú a l&apos;equip de {houseName}.</p>
      </section>
    );
  }

  return (
    <section aria-label={`Equip de ${houseName}`} className="rounded-2xl bg-card shadow-clay">
      <ul className="divide-y divide-border">
        {members.map((member) => (
          <li key={member.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <span className="font-semibold text-foreground">{member.fullName}</span>
            <span className="text-sm tabular-nums text-muted-foreground">Des del {formatDateCa(member.startsOn)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
