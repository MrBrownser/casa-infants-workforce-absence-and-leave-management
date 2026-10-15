'use server';

import { revalidatePath } from 'next/cache';
import type { ActionFailure, ActionResult } from '@/lib/action-result';
import { addApSchema, apIdSchema, restoreApSchema, type ApSnapshot } from '@/lib/ap-schemas';
import { requireDirector } from '@/lib/auth';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import { prisma } from '@/lib/prisma';
import { belongsTo } from '@/lib/team';
import * as aps from '@/server/aps-store';
import { findPerson } from '@/server/people-store';

// AP writes (design D7). Server Functions are reachable by direct POST, so each
// one checks the director, validates the House from the route, re-parses its
// input with the form's own schema and checks the person belongs here.

const INVALID = "No s'ha pogut desar: revisa les dades.";
const NOT_HERE = "Aquesta persona no és d'aquesta casa.";
const GONE = 'Aquest AP ja no existeix.';

const fail = (message: string): ActionFailure => ({ ok: false, message });

/** The person, if they belong to `house` or to a shared post. Former members can still be corrected. */
async function belongsHere(house: HouseSlug, personId: string): Promise<boolean> {
  const person = await findPerson(prisma, personId);
  return person !== null && belongsTo(person, house);
}

/**
 * Runs a write; a broken rule becomes its Catalan message. A write that returns
 * a failure is passed through without revalidating. Both Houses show shared people.
 */
async function write<T>(fn: () => Promise<{ ok: true; data: T } | ActionFailure>): Promise<{ ok: true; data: T } | ActionFailure> {
  try {
    const result = await fn();
    if (result.ok) revalidatePath('/[house]/saldos', 'page');
    return result;
  } catch (error) {
    if (error instanceof aps.ApRuleError) return fail(error.message);
    throw error;
  }
}

export async function addApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = addApSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
  if (!(await belongsHere(houseSlug, parsed.data.personId))) return fail(NOT_HERE);
  return write(async () => ({ ok: true, data: { id: await aps.createAp(prisma, { ...parsed.data, house: houseSlug }) } }));
}

export async function deleteApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ removed: ApSnapshot }>> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = apIdSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
  const ap = await aps.findAp(prisma, parsed.data.apId);
  if (!ap) return fail(GONE);
  // The person decides, not the House where the AP was recorded (design D7).
  if (!(await belongsHere(houseSlug, ap.personId))) return fail(NOT_HERE);
  return write(async () => {
    // False when a concurrent delete got there first: no undo snapshot then.
    if (!(await aps.deleteAp(prisma, ap.id))) return fail(GONE);
    const { personId, kind, year, date, minutes, house } = ap;
    return { ok: true, data: { removed: { personId, kind, year, date, minutes, house } } };
  });
}

/** "Desfés" after a delete: the same AP again, with its original House, after checking the rules again (design D6). */
export async function restoreApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = restoreApSchema.safeParse(input);
  if (!parsed.success) return fail(INVALID);
  if (!(await belongsHere(houseSlug, parsed.data.personId))) return fail(NOT_HERE);
  return write(async () => ({ ok: true, data: { id: await aps.createAp(prisma, parsed.data) } }));
}
