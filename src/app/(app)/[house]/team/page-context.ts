import 'server-only';
import { notFound } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getHouseBySlug } from '@/server/houses';

// Shared start of every team page: the director check comes first (pages and
// layouts render in parallel), then the House from the URL, then the record.

export async function houseContext(params: Promise<{ house: string }>) {
  await requireDirector();
  const { house: slug } = await params;
  const known = findHouseBySlug(slug);
  if (!known) notFound();
  const house = await getHouseBySlug(slug);
  if (!house) notFound();
  return { slug: known.slug, house, today: todayInMadrid() };
}
