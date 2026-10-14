import Link from 'next/link';
import type { HouseSlug } from '@/lib/houses';
import { seatLabel, type PostView } from '@/lib/team';
import { AddPersonButton } from './add-person-button';

export function personHref(houseSlug: HouseSlug, personId: string, year?: number): string {
  return `/${houseSlug}/team?person=${personId}${year ? `&year=${year}` : ''}`;
}

/** One post: label, weekly schedule, and the person of each seat or "Vacant". */
export function PostCard({ houseSlug, post }: Readonly<{ houseSlug: HouseSlug; post: PostView }>) {
  const titleId = `post-${post.seats[0].encoded.replace(/:/g, '-')}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-clay">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={titleId} className="text-base">
            {post.label}
          </h3>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{post.roleCode}</span>
        </div>
        <p className="mt-0.5 text-[0.8125rem] tabular-nums text-muted-foreground">
          <span>{post.summary}</span>
          {post.alternates && <span> · setmanes alternes</span>}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {post.seats.map((seat) => (
          <li key={seat.encoded}>
            {seat.person ? (
              <Link
                href={personHref(houseSlug, seat.person.id)}
                scroll={false}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 transition-colors duration-150 ease-out hover:bg-hover"
              >
                <span className="font-medium text-foreground">{seat.person.fullName}</span>
                {seat.onDutyThisWeek !== null && (
                  <span className="text-[0.8125rem] text-muted-foreground">{seat.onDutyThisWeek ? 'Aquesta setmana' : 'La setmana vinent'}</span>
                )}
              </Link>
            ) : (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-1.5">
                <span className="text-muted-foreground">Vacant</span>
                <AddPersonButton houseSlug={houseSlug} seat={seat.encoded} seatName={seatLabel(seat.ref)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
