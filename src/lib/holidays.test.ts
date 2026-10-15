// src/lib/holidays.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HOLIDAYS, holidayOn } from './holidays';

describe('holidays', () => {
  it('lists the 14 public holidays of 2026 (Catalonia plus Barcelona, docs/domain.md §9)', () => {
    expect(Object.keys(HOLIDAYS[2026])).toHaveLength(14);
    expect(Object.keys(HOLIDAYS[2026]).every((date) => date.startsWith('2026-'))).toBe(true);
  });

  it('names a holiday', () => {
    expect(holidayOn('2026-12-25')).toBe('Nadal');
    expect(holidayOn('2026-09-24')).toBe('La Mercè');
  });

  it('returns null on a working day', () => {
    expect(holidayOn('2026-12-23')).toBeNull();
  });

  it('leaves out the holidays that fall on a Sunday in 2026 and are not moved', () => {
    expect(holidayOn('2026-11-01')).toBeNull();
    expect(holidayOn('2026-12-06')).toBeNull();
  });

  it('returns null for a year without a list (2027 is not official yet)', () => {
    expect(holidayOn('2027-01-01')).toBeNull();
  });
});
