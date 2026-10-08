import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { FormCard } from '@/components/forms/form-card';
import { HandoverForm } from '@/components/forms/handover-form';
import { HousePageHeader } from '@/components/house-page-header';
import { isActiveOn } from '@/lib/house-membership';
import { loadMemberOptions } from '@/server/staffing';
import { handoverAction } from '../../../actions';
import { positionContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Assigna ocupant · Casa d'Infants",
};

export default async function AssignOccupantPage({ params }: Readonly<{ params: Promise<{ house: string; positionId: string }> }>) {
  const { slug, house, today, detail } = await positionContext(params);
  const members = await loadMemberOptions(house.id, today);
  const current = detail.history.find((row) => isActiveOn(row, today));
  const intro = current
    ? `Ara ocupa ${detail.position.label}: ${current.fullName}. Deixarà el lloc el dia abans que entri la persona nova.`
    : `${detail.position.label} està vacant.`;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/positions/${detail.position.id}`}>{detail.position.label}</BackLink>
      <HousePageHeader houseName={house.name} title={current ? 'Substitueix' : 'Assigna ocupant'} />
      <FormCard>
        <HandoverForm
          action={handoverAction.bind(null, slug)}
          from="position"
          fixed={{ positionId: detail.position.id }}
          members={members}
          intro={intro}
          today={today}
        />
      </FormCard>
    </main>
  );
}
