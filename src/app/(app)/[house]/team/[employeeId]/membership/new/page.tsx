import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { AddMembershipForm } from '@/components/forms/add-membership-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { loadPositionRows } from '@/server/staffing';
import { addMembershipAction } from '../../../actions';
import { employeeContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Afegir període · Casa d'Infants",
};

export default async function NewMembershipPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const positions = await loadPositionRows(house.id, today);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Afegir període" />
      <FormCard>
        <AddMembershipForm
          action={addMembershipAction.bind(null, slug)}
          houseName={house.name}
          today={today}
          positions={positions}
          employee={{ id: history.employee.id, fullName: history.employee.fullName }}
        />
      </FormCard>
    </main>
  );
}
