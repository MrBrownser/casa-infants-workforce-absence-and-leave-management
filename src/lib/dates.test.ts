import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateToIsoDate,
  daysBetween,
  formatDateCa,
  formatDateDdMmYyyy,
  isIsoDate,
  isoDateToDate,
  maskDate,
  parseDateDdMmYyyy,
  todayInMadrid,
  weekIndex,
  weekdayOf,
} from './dates';

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

describe('weekdayOf', () => {
  it('counts Monday as 0 and Sunday as 6', () => {
    expect(weekdayOf('2026-10-12')).toBe(0);
    expect(weekdayOf('2026-10-13')).toBe(1);
    expect(weekdayOf('2026-10-18')).toBe(6);
  });
});

describe('daysBetween', () => {
  it('counts calendar days, negative backwards', () => {
    expect(daysBetween('2026-07-01', '2027-01-01')).toBe(184);
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });
});

describe('weekIndex', () => {
  it('is the same from Monday to Sunday and grows by one each week', () => {
    expect(weekIndex('2026-10-12')).toBe(weekIndex('2026-10-18'));
    expect(weekIndex('2026-10-19')).toBe(weekIndex('2026-10-12') + 1);
  });

  it('keeps counting across a 53-week ISO year', () => {
    // 2026-12-28 is ISO week 53 and 2027-01-04 ISO week 1: both odd, yet consecutive.
    expect(weekIndex('2027-01-04') - weekIndex('2026-12-28')).toBe(1);
  });
});

describe('dd/mm/aaaa', () => {
  it('parses real dates only', () => {
    expect(parseDateDdMmYyyy('01/07/2026')).toBe('2026-07-01');
    expect(parseDateDdMmYyyy(' 29/02/2028 ')).toBe('2028-02-29');
    for (const text of ['31/02/2026', '1/7/2026', '2026-07-01', '', 'abc']) expect(parseDateDdMmYyyy(text)).toBeNull();
  });

  it('formats an IsoDate', () => {
    expect(formatDateDdMmYyyy('2026-07-01')).toBe('01/07/2026');
  });

  it('masks typing into dd/mm/aaaa', () => {
    expect(maskDate('01')).toBe('01');
    expect(maskDate('010')).toBe('01/0');
    expect(maskDate('01072026')).toBe('01/07/2026');
    expect(maskDate('01/07/2026')).toBe('01/07/2026');
    expect(maskDate('01/07/20269')).toBe('01/07/2026');
    expect(maskDate('ab')).toBe('');
  });
});
