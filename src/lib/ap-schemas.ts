// src/lib/ap-schemas.ts
// One schema per AP form, used by react-hook-form on the client and re-parsed
// by the Server Functions (design D7). Inputs are the raw form strings; outputs
// are domain values. Messages are Catalan UI copy.
import { z } from 'zod';
import { AP_KINDS, MAX_REQUEST_MINUTES } from './balances';
import { isIsoDate, parseDateDdMmYyyy, type IsoDate } from './dates';
import { parseDuration } from './duration';
import { isHouseSlug, type HouseSlug } from './houses';

export const HOURS_MESSAGE = 'Escriu les hores com H:MM, entre 0:01 i 24:00.';
export const DATE_MESSAGE = 'Escriu la data com dd/mm/aaaa.';

const personId = z.uuid('Tria una persona.');
const kind = z.enum(AP_KINDS, "Tria el tipus d'AP.");
const year = z.number().int().min(2000).max(2100);

const date = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const parsed = parseDateDdMmYyyy(value);
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: DATE_MESSAGE });
      return z.NEVER;
    }
    return parsed;
  });

const hours = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const minutes = parseDuration(value);
    if (minutes === null || minutes < 1 || minutes > MAX_REQUEST_MINUTES) {
      ctx.addIssue({ code: 'custom', message: HOURS_MESSAGE });
      return z.NEVER;
    }
    return minutes;
  });

export const addApSchema = z
  .object({ personId, kind, year, date, hours })
  .transform(({ hours: minutes, ...rest }) => ({ ...rest, minutes }));

export const apIdSchema = z.object({ apId: z.uuid('Aquest AP ja no existeix.') });

/** A deleted AP, sent back by "Desfés" (design D6). The server checks the rules again. */
export const restoreApSchema = z.object({
  personId,
  kind,
  year,
  date: z.custom<IsoDate>((value) => typeof value === 'string' && isIsoDate(value)),
  minutes: z.number().int().min(1).max(MAX_REQUEST_MINUTES),
  house: z.custom<HouseSlug>((value) => isHouseSlug(value)),
});

export type ApSnapshot = z.output<typeof restoreApSchema>;
