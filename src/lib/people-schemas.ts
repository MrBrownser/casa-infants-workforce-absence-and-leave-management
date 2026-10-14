// One schema per form, used by react-hook-form on the client and re-parsed by
// the Server Function (design D9). Inputs are the raw form strings; outputs are
// domain values. Messages are Catalan UI copy.
import { z } from 'zod';
import { parseDateDdMmYyyy } from './dates';
import { parseDuration } from './duration';
import { decodeSeatRef } from './posts';

const personId = z.uuid('Persona desconeguda.');

const fullName = z.string().trim().min(1, 'Escriu el nom complet.').max(120, 'El nom és massa llarg.');

const seat = z.string().transform((value, ctx) => {
  const ref = decodeSeatRef(value);
  if (!ref) {
    ctx.addIssue({ code: 'custom', message: 'Tria un lloc vacant.' });
    return z.NEVER;
  }
  return ref;
});

const optionalDate = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateDdMmYyyy(value);
    if (!date) {
      ctx.addIssue({ code: 'custom', message: 'Escriu la data com dd/mm/aaaa.' });
      return z.NEVER;
    }
    return date;
  });

const days = (what: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, `Escriu ${what} amb un nombre de 0 a 99.`)
    .transform(Number);

export const addPersonSchema = z.object({ fullName, startedOn: optionalDate, seat });

export const renamePersonSchema = z.object({ personId, fullName });

/** Move an active person, or reactivate an inactive one, into a vacant seat. */
export const placePersonSchema = z.object({ personId, seat });

export const personIdSchema = z.object({ personId });

export const balancesSchema = z
  .object({
    personId,
    year: z.number().int().min(2000).max(2100),
    vacationDays: days('els dies de vacances'),
    carriedDays: days('els dies AA'),
    surplusSign: z.enum(['+', '-']),
    surplus: z.string().trim().refine((value) => parseDuration(value) !== null, 'Escriu les hores com H:MM, per exemple 3:45.'),
  })
  .transform(({ surplusSign, surplus, ...rest }) => {
    const minutes = parseDuration(surplus) ?? 0;
    return { ...rest, surplusMinutes: surplusSign === '-' && minutes !== 0 ? -minutes : minutes };
  });

export function isPersonId(value: string): boolean {
  return personId.safeParse(value).success;
}
