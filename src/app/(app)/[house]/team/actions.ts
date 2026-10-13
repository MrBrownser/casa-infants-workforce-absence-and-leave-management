'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireDirector } from '@/lib/auth';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import {
  addPersonSchema,
  balancesSchema,
  personIdSchema,
  placePersonSchema,
  renamePersonSchema,
} from '@/lib/people-schemas';
import { prisma } from '@/lib/prisma';
import { belongsTo, type PersonRecord } from '@/lib/team';
import * as store from '@/server/people-store';

// Equip writes (design D9). Server Functions are reachable by direct POST, so
// each one checks the director, validates the House from the route and
// re-parses its input with the form's own schema.

const INVALID = "No s'ha pogut desar: revisa les dades.";
const NOT_HERE = "Aquesta persona no és d'aquesta casa.";
const WRONG_HOUSE = "Aquest lloc no és d'aquesta casa.";

const fail = (message: string): ActionResult => ({ ok: false, message });

async function run<S extends z.ZodType>(
  houseSlug: string,
  schema: S,
  input: unknown,
  write: (house: HouseSlug, data: z.output<S>) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
  try {
    const result = await write(houseSlug, parsed.data);
    if (result) return result;
  } catch (error) {
    if (error instanceof store.SeatTakenError) {
      return fail(error.occupant ? `Aquest lloc ja l'ocupa ${error.occupant}.` : 'Aquest lloc ja està ocupat.');
    }
    throw error;
  }
  // Both Houses: shared people and moves show on both Equip pages.
  revalidatePath('/[house]/team', 'page');
  return { ok: true };
}

/** The person, if they belong to `house` or to a shared post. */
async function personIn(house: HouseSlug, personId: string): Promise<PersonRecord | null> {
  const person = await store.findPerson(prisma, personId);
  return person && belongsTo(person, house) ? person : null;
}

export async function addPersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, addPersonSchema, input, async (house, data) => {
    if (data.seat.house !== null && data.seat.house !== house) return fail(WRONG_HOUSE);
    await store.addPerson(prisma, data);
  });
}

export async function renamePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, renamePersonSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    await store.renamePerson(prisma, person.id, data.fullName);
  });
}

/** To a vacant seat of this House, the other House or a shared post. Never swaps people. */
export async function movePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, placePersonSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    if (!person.active) return fail('Aquesta persona és a antics membres: reincorpora-la primer.');
    await store.placePerson(prisma, person.id, data.seat);
  });
}

export async function deactivatePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, personIdSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    if (!person.active) return fail('Aquesta persona ja és a antics membres.');
    await store.deactivatePerson(prisma, person.id);
  });
}

export async function reactivatePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, placePersonSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    if (person.active) return fail('Aquesta persona ja cobreix un lloc.');
    await store.placePerson(prisma, person.id, data.seat);
  });
}

export async function saveBalancesAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, balancesSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    const { vacationDays, carriedDays, surplusMinutes } = data;
    await store.saveOpeningBalances(prisma, person.id, data.year, { vacationDays, carriedDays, surplusMinutes });
  });
}
