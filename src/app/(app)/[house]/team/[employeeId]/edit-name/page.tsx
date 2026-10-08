import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { EditNameForm } from '@/components/forms/edit-name-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { editNameAction } from '../../actions';
import { employeeContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Editar nom · Casa d'Infants",
};

export default async function EditNamePage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, history } = await employeeContext(params);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Editar nom" />
      <FormCard>
        <EditNameForm
          action={editNameAction.bind(null, slug)}
          employeeId={history.employee.id}
          fullName={history.employee.fullName}
          updatedAt={history.employee.updatedAt}
        />
      </FormCard>
    </main>
  );
}
