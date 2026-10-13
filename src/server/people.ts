import 'server-only';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { isPersonId } from '@/lib/people-schemas';
import { prisma } from '@/lib/prisma';
import { defaultOpeningBalances } from '@/lib/rules';
import { belongsTo, buildTeamView, vacantSeats, type PersonDetails, type SeatOption, type TeamView } from '@/lib/team';
import { findOpeningBalances, findPerson, listActivePeople, listPeopleOf } from './people-store';

// Reads for the Equip page. Every function checks the director itself: pages
// and layouts render in parallel.

export async function getTeam(house: HouseSlug): Promise<TeamView> {
  await requireDirector();
  return buildTeamView(house, await listPeopleOf(prisma, house), todayInMadrid());
}

export async function getVacantSeats(): Promise<SeatOption[]> {
  await requireDirector();
  return vacantSeats(await listActivePeople(prisma));
}

/** A person of `house` (or of a shared post) with their opening balances of `year`, or null. */
export async function getPersonDetails(house: HouseSlug, personId: string, year: number): Promise<PersonDetails | null> {
  await requireDirector();
  if (!isPersonId(personId)) return null;
  const person = await findPerson(prisma, personId);
  if (!person || !belongsTo(person, house)) return null;
  const stored = await findOpeningBalances(prisma, person.id, year);
  return { person, year, balances: stored ?? defaultOpeningBalances(year, person.startedOn), stored: stored !== null };
}
