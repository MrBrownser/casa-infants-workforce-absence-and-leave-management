import { describe, expect, it } from 'vitest';
import { AP_RULES, VACATION_RULES, defaultOpeningBalances, defaultVacationDays } from './rules';

describe('rules', () => {
  it('holds the AP and vacation constants', () => {
    expect(AP_RULES.nonRecoverable).toEqual({ minutes: 24 * 60, maxDays: 5 });
    expect(AP_RULES.recoverable).toEqual({ minutes: 24 * 60, maxDays: 3 });
    expect(VACATION_RULES).toEqual({ daysPerYear: 31, minPeriodDays: 7, maxPeriods: 4 });
  });
});

describe('defaultVacationDays', () => {
  it('gives 31 days for a full year', () => {
    expect(defaultVacationDays(2026, null)).toBe(31);
    expect(defaultVacationDays(2026, '2020-03-01')).toBe(31);
    expect(defaultVacationDays(2026, '2026-01-01')).toBe(31);
  });

  it('prorates by the start date and rounds to whole days', () => {
    expect(defaultVacationDays(2026, '2026-07-01')).toBe(16);
    expect(defaultVacationDays(2028, '2028-07-01')).toBe(16); // leap year: 31 × 184 / 366
    expect(defaultVacationDays(2026, '2026-12-31')).toBe(0);
  });

  it('gives 0 when the person starts after the year', () => {
    expect(defaultVacationDays(2026, '2027-02-01')).toBe(0);
  });
});

describe('defaultOpeningBalances', () => {
  it('has no AA days and no surplus', () => {
    expect(defaultOpeningBalances(2026, '2026-07-01')).toEqual({ vacationDays: 16, carriedDays: 0, surplusMinutes: 0 });
  });
});
