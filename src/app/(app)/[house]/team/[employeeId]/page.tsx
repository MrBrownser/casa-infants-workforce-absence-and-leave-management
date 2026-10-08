import type { Metadata } from 'next';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { DoneNote } from '@/components/forms/done-note';
import { HousePageHeader } from '@/components/house-page-header';
import { EmployeeHistoryView } from '@/components/team/employee-history';
import { Button } from '@/components/ui/button';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { employeeActionState } from '@/lib/employee-actions';
import { employeeContext } from '../page-context';

export const metadata: Metadata = {
  title: "Historial · Casa d'Infants",
};

export default async function EmployeePage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string; employeeId: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { done, repeat } = parseDone(await searchParams);
  const { ongoingHere, openAssignmentHere, hasOngoingMembership } = employeeActionState(history, house.id);
  const base = `/${slug}/team/${history.employee.id}`;
  const actions = [
    { href: `${base}/edit-name`, label: 'Editar nom', show: true },
    { href: `${base}/assign`, label: openAssignmentHere ? 'Canviar de lloc' : 'Assignar lloc', show: ongoingHere !== null },
    { href: `${base}/assignment/end`, label: 'Finalitzar lloc', show: openAssignmentHere !== null },
    { href: `${base}/membership/end`, label: 'Finalitzar pertinença', show: ongoingHere !== null },
    { href: `${base}/transfer`, label: 'Traslladar', show: ongoingHere !== null },
    { href: `${base}/membership/new`, label: 'Afegir període', show: !hasOngoingMembership },
  ].filter((action) => action.show);

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team`}>Equip</BackLink>
      <HousePageHeader houseName={house.name} title={history.employee.fullName} />
      {done && <DoneNote done={done} repeat={repeat} />}
      <nav aria-label="Accions" className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.href} asChild variant="outline" className="h-11 md:h-10">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </nav>
      <EmployeeHistoryView history={history} today={today} />
    </main>
  );
}
