import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';

export const metadata: Metadata = {
  title: "Inici · Casa d'Infants",
};

export default async function HouseHomePage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Inici" />
      <p className="max-w-xl text-[0.9375rem] leading-[1.65] text-muted-foreground">
        Encara no hi ha res. Aviat hi trobaràs la gestió de vacances i absències de {house.name}.
      </p>
    </main>
  );
}
