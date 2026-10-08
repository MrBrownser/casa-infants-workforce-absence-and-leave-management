import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { EndAssignmentForm } from '@/components/forms/end-assignment-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { endAssignmentAction } from '../../../actions';
import { employeeContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Finalitzar lloc · Casa d'Infants",
};

export default async function EndAssignmentPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { openAssignmentHere } = employeeActionState(history, house.id);
  if (!openAssignmentHere) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Finalitzar lloc" />
      <FormCard>
        <EndAssignmentForm action={endAssignmentAction.bind(null, slug)} assignment={openAssignmentHere} today={today} />
      </FormCard>
    </main>
  );
}
