// AP and vacation rules (docs/domain.md §4 and §7). Changing a rule is a code change.
import { daysBetween, type IsoDate } from './dates';

export const AP_RULES = {
  /** AP no recuperable: just consumes the allowance. */
  nonRecoverable: { minutes: 24 * 60, maxDays: 5 },
  /** AP recuperable: deducted from the calendar surplus. */
  recoverable: { minutes: 24 * 60, maxDays: 3 },
} as const;

export const VACATION_RULES = { daysPerYear: 31, minPeriodDays: 7, maxPeriods: 4 } as const;

/** Per person and year (design D6). The surplus may be negative. */
export type OpeningBalances = { vacationDays: number; carriedDays: number; surplusMinutes: number };

/**
 * 31 days, or prorated when the person started during `year`:
 * round(31 × days from the start to 31/12 / days in the year), 16 for 1 July.
 */
export function defaultVacationDays(year: number, startedOn: IsoDate | null): number {
  const first = `${year}-01-01`;
  const next = `${year + 1}-01-01`;
  if (!startedOn || startedOn <= first) return VACATION_RULES.daysPerYear;
  if (startedOn >= next) return 0;
  return Math.round((VACATION_RULES.daysPerYear * daysBetween(startedOn, next)) / daysBetween(first, next));
}

export function defaultOpeningBalances(year: number, startedOn: IsoDate | null): OpeningBalances {
  return { vacationDays: defaultVacationDays(year, startedOn), carriedDays: 0, surplusMinutes: 0 };
}
