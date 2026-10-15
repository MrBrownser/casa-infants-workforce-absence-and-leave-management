// src/lib/holidays.ts
// Public holidays of Catalonia plus Barcelona's local ones (docs/domain.md §9):
// the days off of the official calendars, so a holiday that falls on a Sunday
// and is not moved (Tots Sants and Constitució in 2026) is left out. One list
// per year: add the next
// year when the Generalitat and Barcelona publish their calendars. A year with
// no list simply has no holidays here, so no notice is shown.
import type { IsoDate } from './dates';

export const HOLIDAYS: Readonly<Record<number, Readonly<Record<IsoDate, string>>>> = {
  2026: {
    '2026-01-01': "Cap d'Any",
    '2026-01-06': 'Reis',
    '2026-04-03': 'Divendres Sant',
    '2026-04-06': 'Dilluns de Pasqua',
    '2026-05-01': 'Festa del Treball',
    '2026-05-25': 'Segona Pasqua',
    '2026-06-24': 'Sant Joan',
    '2026-08-15': "L'Assumpció",
    '2026-09-11': 'Diada',
    '2026-09-24': 'La Mercè',
    '2026-10-12': "Festa Nacional d'Espanya",
    '2026-12-08': 'La Puríssima',
    '2026-12-25': 'Nadal',
    '2026-12-26': 'Sant Esteve',
  },
};

/** The holiday's name, or null on a working day or a year without a list. */
export function holidayOn(date: IsoDate): string | null {
  return HOLIDAYS[Number(date.slice(0, 4))]?.[date] ?? null;
}
