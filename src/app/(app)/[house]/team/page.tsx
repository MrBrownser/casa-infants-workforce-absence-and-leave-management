import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

export default async function TeamPage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
    </main>
  );
}
