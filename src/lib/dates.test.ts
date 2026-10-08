import { describe, expect, it } from 'vitest';
import { addDays, dateToIsoDate, formatDateCa, formatPeriodCa, isIsoDate, isoDateToDate, todayInMadrid } from './dates';

describe('todayInMadrid', () => {
  it('flips at Madrid midnight in summer (UTC+2)', () => {
    expect(todayInMadrid(new Date('2026-06-30T21:59:59Z'))).toBe('2026-06-30');
    expect(todayInMadrid(new Date('2026-06-30T22:00:00Z'))).toBe('2026-07-01');
    expect(todayInMadrid(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
  });

  it('flips at Madrid midnight in winter (UTC+1)', () => {
    expect(todayInMadrid(new Date('2026-01-14T22:59:59Z'))).toBe('2026-01-14');
    expect(todayInMadrid(new Date('2026-01-14T23:00:00Z'))).toBe('2026-01-15');
  });
});

describe('addDays', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-07-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-7-1')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('Date conversion', () => {
  it('round-trips through UTC midnight', () => {
    const date = isoDateToDate('2026-07-01');
    expect(date.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(dateToIsoDate(date)).toBe('2026-07-01');
  });
});

describe('formatDateCa', () => {
  it('formats in Catalan', () => {
    expect(formatDateCa('2026-07-01')).toBe('1 de juliol del 2026');
  });
});

describe('formatPeriodCa', () => {
  it('writes closed and open periods in Catalan', () => {
    expect(formatPeriodCa({ startsOn: '2026-01-01', endsOn: '2026-06-30' })).toBe('Del 1 de gener del 2026 al 30 de juny del 2026');
    expect(formatPeriodCa({ startsOn: '2026-07-01', endsOn: null })).toBe('Des del 1 de juliol del 2026');
  });
});
