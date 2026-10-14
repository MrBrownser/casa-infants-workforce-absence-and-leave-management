import Link from 'next/link';
import type { IsoDate } from '@/lib/dates';
import { findHouseBySlug, type HouseSlug } from '@/lib/houses';
import { sharedWeekSplit } from '@/lib/posts';
import { seatLabel, type PersonRecord, type TeamView } from '@/lib/team';
import { PostCard, personHref } from './post-card';

function PeopleList({ houseSlug, people }: Readonly<{ houseSlug: HouseSlug; people: readonly PersonRecord[] }>) {
  return (
    <ul className="divide-y divide-border rounded-2xl bg-card shadow-clay">
      {people.map((person) => (
        <li key={person.id}>
          <Link
            href={personHref(houseSlug, person.id)}
            scroll={false}
            className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-5 py-3 transition-colors duration-150 ease-out hover:bg-hover"
          >
            <span className="font-medium text-foreground">{person.fullName}</span>
            <span className="text-[0.8125rem] text-muted-foreground">{seatLabel(person)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The Equip page body (design D9): shared posts, the House posts, unplaced and former people. */
export function TeamBoard({
  houseSlug,
  houseName,
  team,
  today,
}: Readonly<{ houseSlug: HouseSlug; houseName: string; team: TeamView; today: IsoDate }>) {
  const split = sharedWeekSplit(today)
    .map(({ days, house }) => `${days} a ${findHouseBySlug(house)?.name ?? house}`)
    .join(', ');

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="shared-title" className="flex flex-col gap-3">
        <div>
          <h2 id="shared-title" className="text-xl">
            Compartits entre les dues cases
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">Aquesta setmana: {split}.</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {team.shared.map((post) => (
            <PostCard key={post.key} houseSlug={houseSlug} post={post} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="posts-title" className="flex flex-col gap-3">
        <h2 id="posts-title" className="text-xl">
          Llocs de {houseName}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {team.posts.map((post) => (
            <PostCard key={post.key} houseSlug={houseSlug} post={post} />
          ))}
        </ul>
      </section>

      {team.unplaced.length > 0 && (
        <section aria-labelledby="unplaced-title" className="flex flex-col gap-3">
          <div>
            <h2 id="unplaced-title" className="text-xl">
              Sense lloc
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">El seu lloc ja no existeix: mou-les a un lloc vacant.</p>
          </div>
          <PeopleList houseSlug={houseSlug} people={team.unplaced} />
        </section>
      )}

      <section aria-labelledby="former-title" className="flex flex-col gap-3">
        <h2 id="former-title" className="text-xl">
          Antics membres
        </h2>
        {team.former.length > 0 ? (
          <PeopleList houseSlug={houseSlug} people={team.former} />
        ) : (
          <p className="text-[0.9375rem] text-muted-foreground">Ningú ha deixat {houseName}.</p>
        )}
      </section>
    </div>
  );
}
