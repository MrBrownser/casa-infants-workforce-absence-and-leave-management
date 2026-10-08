import type { Metadata } from 'next';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { DoneNote } from '@/components/forms/done-note';
import { FormCard } from '@/components/forms/form-card';
import { RelabelPositionForm } from '@/components/forms/position-forms';
import { HousePageHeader } from '@/components/house-page-header';
import { PositionHistory } from '@/components/team/position-history';
import { Button } from '@/components/ui/button';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { isActiveOn } from '@/lib/house-membership';
import { findRole } from '@/lib/roles';
import { relabelPositionAction } from '../../actions';
import { positionContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Lloc de treball · Casa d'Infants",
};

export default async function PositionPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string; positionId: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today, detail } = await positionContext(params);
  const { done, repeat } = parseDone(await searchParams);
  const occupied = detail.history.some((row) => isActiveOn(row, today));
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/positions`}>Llocs de treball</BackLink>
      <HousePageHeader houseName={house.name} title={detail.position.label} />
      <p className="-mt-4 text-[0.9375rem] text-muted-foreground">{findRole(detail.position.roleCode)?.label}</p>
      {done && <DoneNote done={done} repeat={repeat} />}
      <div>
        <Button asChild className="h-11 md:h-10">
          <Link href={`/${slug}/team/positions/${detail.position.id}/assign`}>{occupied ? 'Substitueix' : 'Assigna ocupant'}</Link>
        </Button>
      </div>
      <FormCard title="Ocupants">
        <PositionHistory houseSlug={slug} rows={detail.history} today={today} />
      </FormCard>
      <FormCard title="Nom del lloc">
        <RelabelPositionForm action={relabelPositionAction.bind(null, slug)} positionId={detail.position.id} label={detail.position.label} />
      </FormCard>
    </main>
  );
}
