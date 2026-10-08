import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { DoneNote } from '@/components/forms/done-note';
import { HousePageHeader } from '@/components/house-page-header';
import { SegmentedLinks } from '@/components/segmented-links';
import { DateBanner, DateControl } from '@/components/team/date-control';
import { FormerMembersList } from '@/components/team/former-members-list';
import { PeopleList } from '@/components/team/people-list';
import { PositionsList } from '@/components/team/positions-list';
import { Button } from '@/components/ui/button';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { TEAM_VIEWS, parseTeamSearchParams, teamHref, type TeamViewName } from '@/lib/team-params';
import { loadTeamView } from '@/server/staffing';
import { houseContext } from './page-context';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

const VIEW_LABELS: Record<TeamViewName, string> = { people: 'Persones', positions: 'Llocs', former: 'Membres anteriors' };

export default async function TeamPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today } = await houseContext(params);
  const query = await searchParams;
  const { view, date } = parseTeamSearchParams(query, today);
  const { done, repeat } = parseDone(query);
  const team = await loadTeamView(house.id, date);

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
      {done && <DoneNote done={done} repeat={repeat} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Vistes de l'equip"
          items={TEAM_VIEWS.map((v) => ({ href: teamHref(slug, v, date, today), label: VIEW_LABELS[v], current: v === view }))}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 md:h-10">
            <Link href={`/${slug}/team/positions`}>Llocs de treball</Link>
          </Button>
          <Button asChild className="h-11 md:h-10">
            <Link href={`/${slug}/team/new`}>
              <UserPlus aria-hidden="true" />
              Afegir persona
            </Link>
          </Button>
        </div>
      </div>
      {view !== 'former' && <DateControl view={view} date={date} />}
      {view !== 'former' && date !== today && <DateBanner date={date} todayHref={teamHref(slug, view, today, today)} />}
      {view === 'people' && <PeopleList houseSlug={slug} houseName={house.name} rows={team.people} isToday={date === today} />}
      {view === 'positions' && <PositionsList houseSlug={slug} houseName={house.name} rows={team.positions} />}
      {view === 'former' && <FormerMembersList houseSlug={slug} houseName={house.name} rows={team.former} />}
    </main>
  );
}
