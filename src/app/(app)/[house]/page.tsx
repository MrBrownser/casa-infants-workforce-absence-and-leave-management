import { notFound, redirect } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';
import { firstAvailableSection, sectionHref } from '@/lib/sections';

// The House home has no screen of its own: it opens the first available section (Saldos).
export default async function HouseHomePage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();
  redirect(sectionHref(house.slug, firstAvailableSection().segment));
}
