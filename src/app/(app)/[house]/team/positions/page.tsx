import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { DoneNote } from '@/components/forms/done-note';
import { FormCard } from '@/components/forms/form-card';
import { CreatePositionForm } from '@/components/forms/position-forms';
import { HousePageHeader } from '@/components/house-page-header';
import { PositionsList } from '@/components/team/positions-list';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { loadPositionRows } from '@/server/staffing';
import { createPositionAction } from '../actions';
import { houseContext } from '../page-context';

export const metadata: Metadata = {
  title: "Llocs de treball · Casa d'Infants",
};

export default async function PositionsPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today } = await houseContext(params);
  const { done, repeat } = parseDone(await searchParams);
  const rows = await loadPositionRows(house.id, today);
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team`}>Equip</BackLink>
      <HousePageHeader houseName={house.name} title="Llocs de treball" />
      {done && <DoneNote done={done} repeat={repeat} />}
      <PositionsList houseSlug={slug} houseName={house.name} rows={rows} />
      <FormCard title="Nou lloc">
        <CreatePositionForm action={createPositionAction.bind(null, slug)} />
      </FormCard>
    </main>
  );
}
