import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { FormCard } from '@/components/forms/form-card';
import { HandoverForm } from '@/components/forms/handover-form';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { loadPositionRows } from '@/server/staffing';
import { handoverAction } from '../../actions';
import { employeeContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Assignar lloc · Casa d'Infants",
};

export default async function AssignPositionPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { openAssignmentHere } = employeeActionState(history, house.id);
  const positions = await loadPositionRows(house.id, today);
  const title = openAssignmentHere ? 'Canviar de lloc' : 'Assignar lloc';
  const intro = openAssignmentHere
    ? `${history.employee.fullName} ocupa ara ${openAssignmentHere.positionLabel}. El lloc actual acaba el dia abans del nou.`
    : `${history.employee.fullName} no té cap lloc ara a ${house.name}.`;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title={title} />
      <FormCard>
        <HandoverForm
          action={handoverAction.bind(null, slug)}
          from="employee"
          fixed={{ employeeId: history.employee.id }}
          positions={positions}
          intro={intro}
          today={today}
        />
      </FormCard>
    </main>
  );
}
