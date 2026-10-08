import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { FormCard } from '@/components/forms/form-card';
import { TransferForm } from '@/components/forms/transfer-form';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { HOUSES } from '@/lib/houses';
import { getHouseBySlug } from '@/server/houses';
import { loadPositionRows } from '@/server/staffing';
import { transferAction } from '../../actions';
import { employeeContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Traslladar · Casa d'Infants",
};

export default async function TransferPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { ongoingHere } = employeeActionState(history, house.id);
  if (!ongoingHere) notFound();
  const other = HOUSES.find((h) => h.slug !== slug);
  const destination = other ? await getHouseBySlug(other.slug) : null;
  if (!other || !destination) notFound();
  const destinationPositions = await loadPositionRows(destination.id, today);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title={`Traslladar ${history.employee.fullName}`} />
      <FormCard>
        <TransferForm
          action={transferAction.bind(null, slug)}
          employeeId={history.employee.id}
          fromHouseName={house.name}
          toHouse={{ slug: other.slug, name: other.name }}
          destinationPositions={destinationPositions}
          today={today}
        />
      </FormCard>
    </main>
  );
}
