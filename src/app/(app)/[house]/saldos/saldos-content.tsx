import { notFound } from 'next/navigation';
import { SaldosBoard } from '@/components/saldos/saldos-board';
import { requireDirector } from '@/lib/auth';
import { parseYearParam, todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getSaldos } from '@/server/saldos';

/** `?year=<yyyy>` picks the year (default: this year in Madrid); `?person=<id>` opens a person's details. */
export async function SaldosContent({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ house: string }>;
  searchParams: Promise<{ year?: string | string[]; person?: string | string[] }>;
}>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  const { year: yearParam, person } = await searchParams;
  const currentYear = Number(todayInMadrid().slice(0, 4));
  const year = parseYearParam(yearParam) ?? currentYear;
  const view = await getSaldos(house.slug, year);

  return (
    <SaldosBoard
      houseSlug={house.slug}
      houseName={house.name}
      currentYear={currentYear}
      view={view}
      personId={typeof person === 'string' ? person : null}
    />
  );
}
