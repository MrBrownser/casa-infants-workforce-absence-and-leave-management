import 'server-only';
import { notFound } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getHouseBySlug } from '@/server/houses';
import { loadEmployeeHistory } from '@/server/staffing';

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

// An unknown or non-UUID employee, or one with no membership in this House, is a 404.
export async function employeeContext(params: Promise<{ house: string; employeeId: string }>) {
  const context = await houseContext(params);
  const { employeeId } = await params;
  const history = await loadEmployeeHistory(context.house.id, employeeId);
  if (!history) notFound();
  return { ...context, history };
}
