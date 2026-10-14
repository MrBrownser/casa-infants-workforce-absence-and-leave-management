import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { PersonSheet } from '@/components/team/person-sheet';
import { TeamBoard } from '@/components/team/team-board';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getPersonDetails, getTeam, getVacantSeats } from '@/server/people';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

function parseYear(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

// `?person=<id>&year=<yyyy>` opens a person's details and balances in a sheet.
export default async function TeamPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ house: string }>;
  searchParams: Promise<{ person?: string | string[]; year?: string | string[] }>;
}>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  const { person: personId, year: yearParam } = await searchParams;
  const today = todayInMadrid();
  const year = parseYear(yearParam) ?? Number(today.slice(0, 4));

  const [team, details] = await Promise.all([
    getTeam(house.slug),
    typeof personId === 'string' ? getPersonDetails(house.slug, personId, year) : Promise.resolve(null),
  ]);
  const vacantSeats = details ? await getVacantSeats() : [];

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
      <TeamBoard houseSlug={house.slug} houseName={house.name} team={team} today={today} />
      {details && <PersonSheet houseSlug={house.slug} details={details} vacantSeats={vacantSeats} today={today} />}
    </main>
  );
}
