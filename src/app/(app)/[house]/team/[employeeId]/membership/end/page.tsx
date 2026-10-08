import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { EndMembershipForm } from '@/components/forms/end-membership-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { endMembershipAction } from '../../../actions';
import { employeeContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Finalitzar pertinença · Casa d'Infants",
};

export default async function EndMembershipPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { ongoingHere } = employeeActionState(history, house.id);
  if (!ongoingHere) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Finalitzar pertinença" />
      <FormCard>
        <EndMembershipForm action={endMembershipAction.bind(null, slug)} membership={ongoingHere} houseName={house.name} today={today} />
      </FormCard>
    </main>
  );
}
