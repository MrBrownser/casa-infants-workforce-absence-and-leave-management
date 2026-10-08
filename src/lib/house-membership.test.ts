// src/lib/house-membership.test.ts
import { describe, expect, it } from 'vitest';
import { StaffingError } from './staffing-error';
import {
  findOverlap,
  houseOf,
  isActiveOn,
  membersOn,
  planTransfer,
  type Membership,
} from './house-membership';

const PF = 'house-pf';
const CA = 'house-ca';

function membership(overrides: Partial<Membership> & Pick<Membership, 'id' | 'employeeId'>): Membership {
  return { houseId: PF, startsOn: '2026-01-01', endsOn: null, ...overrides };
}

// Ana: Paulo Freire until 30 June, Carme Aymerich from 1 July (spec scenario 5).
const anaPf = membership({ id: 'm1', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: '2026-06-30' });
const anaCa = membership({ id: 'm2', employeeId: 'ana', houseId: CA, startsOn: '2026-07-01' });
const marta = membership({ id: 'm3', employeeId: 'marta', houseId: CA, startsOn: '2025-09-01' });
const future = membership({ id: 'm4', employeeId: 'pol', houseId: PF, startsOn: '2026-11-01' });
const all = [anaPf, anaCa, marta, future];

describe('isActiveOn', () => {
  it('includes both bounds', () => {
    expect(isActiveOn(anaPf, '2026-01-01')).toBe(true);
    expect(isActiveOn(anaPf, '2026-06-30')).toBe(true);
    expect(isActiveOn(anaPf, '2026-07-01')).toBe(false);
    expect(isActiveOn(anaPf, '2025-12-31')).toBe(false);
  });

  it('treats a missing end as ongoing', () => {
    expect(isActiveOn(anaCa, '2099-01-01')).toBe(true);
  });
});

describe('membersOn', () => {
  it('lists only current members of the given House (scenario 4)', () => {
    expect(membersOn(all, PF, '2026-03-15').map((m) => m.employeeId)).toEqual(['ana']);
    expect(membersOn(all, CA, '2026-03-15').map((m) => m.employeeId)).toEqual(['marta']);
  });

  it('drops a transferred employee from the old House (EC-002)', () => {
    expect(membersOn(all, PF, '2026-09-15').map((m) => m.employeeId)).toEqual([]);
    expect(membersOn(all, CA, '2026-09-15').map((m) => m.employeeId)).toEqual(['ana', 'marta']);
  });

  it('does not list a membership that starts in the future', () => {
    expect(membersOn(all, PF, '2026-10-04').map((m) => m.employeeId)).toEqual([]);
    expect(membersOn(all, PF, '2026-11-01').map((m) => m.employeeId)).toEqual(['pol']);
  });
});

describe('houseOf', () => {
  it('answers for past and later dates (scenario 5)', () => {
    expect(houseOf(all, 'ana', '2026-03-15')).toBe(PF);
    expect(houseOf(all, 'ana', '2026-09-15')).toBe(CA);
    expect(houseOf(all, 'ana', '2025-06-01')).toBeNull();
  });
});

describe('findOverlap', () => {
  it('detects an overlap in another House', () => {
    const candidate = { employeeId: 'ana', startsOn: '2026-06-15', endsOn: null };
    expect(findOverlap([anaPf], candidate)).toBe(anaPf);
  });

  it('detects an overlap in the same House', () => {
    const candidate = { employeeId: 'marta', startsOn: '2026-01-01', endsOn: '2026-02-01' };
    expect(findOverlap([marta], candidate)).toBe(marta);
  });

  it('allows adjacent periods', () => {
    const candidate = { employeeId: 'ana', startsOn: '2026-07-01', endsOn: null };
    expect(findOverlap([anaPf], candidate)).toBeUndefined();
  });

  it('ignores other employees', () => {
    const candidate = { employeeId: 'ana', startsOn: '2026-01-01', endsOn: null };
    expect(findOverlap([marta], candidate)).toBeUndefined();
  });
});

describe('planTransfer', () => {
  const current = membership({ id: 'm1', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01' });

  it('closes the day before and opens in the new House (scenario 8)', () => {
    expect(planTransfer(current, CA, '2026-07-01')).toEqual({
      close: { id: 'm1', endsOn: '2026-06-30' },
      open: { employeeId: 'ana', houseId: CA, startsOn: '2026-07-01' },
    });
  });

  it('never touches the existing start date or House', () => {
    planTransfer(current, CA, '2026-07-01');
    expect(current).toEqual(membership({ id: 'm1', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01' }));
  });

  it('rejects a transfer to the same House', () => {
    expect(() => planTransfer(current, PF, '2026-07-01')).toThrow(StaffingError);
    try {
      planTransfer(current, PF, '2026-07-01');
    } catch (error) {
      expect((error as StaffingError).reason).toBe('same-house');
    }
  });

  it('rejects a start on or before the current start', () => {
    expect(() => planTransfer(current, CA, '2026-01-01')).toThrow(/starts-too-early/);
    expect(() => planTransfer(current, CA, '2025-12-01')).toThrow(/starts-too-early/);
  });

  it('rejects a membership that already has an end date', () => {
    expect(() => planTransfer(anaPf, CA, '2026-08-01')).toThrow(/not-ongoing/);
  });
});
