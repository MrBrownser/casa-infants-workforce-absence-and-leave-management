import 'server-only';
import { requireDirector } from '@/lib/auth';
import type { HouseSlug } from '@/lib/houses';
import { prisma } from '@/lib/prisma';
import { buildSaldosView, type SaldosView } from '@/lib/saldos';
import { listApsOf, listOpeningBalancesOf } from './aps-store';
import { listPeopleOf } from './people-store';

/** The Saldos page of a House and year (design D8). Checks the director itself: pages and layouts render in parallel. */
export async function getSaldos(house: HouseSlug, year: number): Promise<SaldosView> {
  await requireDirector();
  const people = await listPeopleOf(prisma, house);
  const ids = people.map((person) => person.id);
  const [openings, aps] = await Promise.all([listOpeningBalancesOf(prisma, ids, year), listApsOf(prisma, ids, year)]);
  return buildSaldosView({ house, year, people, openings, aps });
}
