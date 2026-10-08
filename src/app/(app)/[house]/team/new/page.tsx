import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { AddMembershipForm } from '@/components/forms/add-membership-form';
import { CreatePersonForm } from '@/components/forms/create-person-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { SegmentedLinks } from '@/components/segmented-links';
import { firstParam, type SearchParams } from '@/lib/action-state';
import { loadEmployeeOptions, loadPositionRows } from '@/server/staffing';
import { addMembershipAction, createPersonAction } from '../actions';
import { houseContext } from '../page-context';

export const metadata: Metadata = {
  title: "Afegir persona · Casa d'Infants",
};

export default async function NewPersonPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today } = await houseContext(params);
  const existing = firstParam(await searchParams, 'mode') === 'existing';
  const [positions, employees] = await Promise.all([
    loadPositionRows(house.id, today),
    existing ? loadEmployeeOptions(house.id) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team`}>Equip</BackLink>
      <HousePageHeader houseName={house.name} title="Afegir persona" />
      <SegmentedLinks
        label="Tipus de persona"
        items={[
          { href: `/${slug}/team/new`, label: 'Persona nova', current: !existing },
          { href: `/${slug}/team/new?mode=existing`, label: 'Persona existent', current: existing },
        ]}
      />
      <FormCard>
        {existing ? (
          <AddMembershipForm
            action={addMembershipAction.bind(null, slug)}
            houseName={house.name}
            today={today}
            positions={positions}
            employees={employees}
          />
        ) : (
          <CreatePersonForm action={createPersonAction.bind(null, slug)} houseName={house.name} today={today} positions={positions} />
        )}
      </FormCard>
    </main>
  );
}
