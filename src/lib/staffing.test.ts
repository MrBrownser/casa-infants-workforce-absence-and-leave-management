// src/lib/staffing.test.ts
import { describe, expect, it } from 'vitest';
import type { Membership } from './house-membership';
import {
  assertValidPeriod,
  ctOccupantsOn,
  findAssignmentConflict,
  findContainingMembership,
  formerMembers,
  occupancyOn,
  periodContains,
  periodsOverlap,
  teamOn,
  type Assignment,
  type Position,
} from './staffing';

const PF = 'house-pf';
const CA = 'house-ca';

const m = (id: string, employeeId: string, houseId: string, startsOn: string, endsOn: string | null = null): Membership => ({
  id, employeeId, houseId, startsOn, endsOn,
});
const a = (id: string, employeeId: string, positionId: string, houseId: string, startsOn: string, endsOn: string | null = null): Assignment => ({
  id, employeeId, positionId, houseId, startsOn, endsOn,
});
const p = (id: string, houseId: string, roleCode: Position['roleCode'], label: string): Position => ({ id, houseId, roleCode, label });

const er1 = p('er1', PF, 'ER', 'ER 1');
const ct1 = p('ct1', PF, 'CT', 'CT 1');
const ct2 = p('ct2', PF, 'CT', 'CT 2');
const ctA = p('ctA', CA, 'CT', 'CT A');

describe('periods', () => {
  it('overlap with inclusive bounds and open ends', () => {
    expect(periodsOverlap({ startsOn: '2026-01-01', endsOn: '2026-06-30' }, { startsOn: '2026-06-30', endsOn: null })).toBe(true);
    expect(periodsOverlap({ startsOn: '2026-01-01', endsOn: '2026-06-30' }, { startsOn: '2026-07-01', endsOn: null })).toBe(false);
    expect(periodsOverlap({ startsOn: '2026-01-01', endsOn: null }, { startsOn: '2030-01-01', endsOn: '2030-01-02' })).toBe(true);
  });

  it('contain only when the whole inner period fits', () => {
    expect(periodContains({ startsOn: '2026-01-01', endsOn: null }, { startsOn: '2026-02-01', endsOn: null })).toBe(true);
    expect(periodContains({ startsOn: '2026-01-01', endsOn: '2026-06-30' }, { startsOn: '2026-02-01', endsOn: null })).toBe(false);
    expect(periodContains({ startsOn: '2026-02-01', endsOn: null }, { startsOn: '2026-01-01', endsOn: '2026-03-01' })).toBe(false);
  });

  it('rejects an end before the start', () => {
    expect(() => assertValidPeriod({ startsOn: '2026-05-01', endsOn: '2026-04-30' })).toThrow(/invalid-dates/);
    expect(() => assertValidPeriod({ startsOn: '2026-05-01', endsOn: '2026-05-01' })).not.toThrow();
  });
});

describe('occupancyOn', () => {
  it('shows a future occupant only from its start (AC-008)', () => {
    const assignments = [a('a1', 'marta', 'er1', PF, '2026-09-01')];
    expect(occupancyOn([er1], assignments, '2026-08-15')[0].assignment).toBeNull();
    expect(occupancyOn([er1], assignments, '2026-09-01')[0].assignment?.employeeId).toBe('marta');
  });

  it('keeps one position across successive occupants (AC-004)', () => {
    const assignments = [a('a1', 'marta', 'er1', PF, '2026-01-01', '2026-06-30'), a('a2', 'ana', 'er1', PF, '2026-07-01')];
    expect(occupancyOn([er1], assignments, '2026-06-30')[0].assignment?.employeeId).toBe('marta');
    expect(occupancyOn([er1], assignments, '2026-07-01')[0].assignment?.employeeId).toBe('ana');
  });
});

describe('teamOn', () => {
  const memberships = [
    m('m1', 'ana', PF, '2026-01-01', '2026-06-30'),
    m('m2', 'ana', CA, '2026-07-01'),
    m('m3', 'nuria', PF, '2025-09-01'),
  ];
  const assignments = [a('a1', 'ana', 'er1', PF, '2026-01-01', '2026-06-30')];

  it('lists members with their position or none', () => {
    const rows = teamOn(memberships, assignments, PF, '2026-03-01');
    expect(rows.map((r) => [r.membership.employeeId, r.assignment?.positionId ?? null])).toEqual([
      ['ana', 'er1'],
      ['nuria', null],
    ]);
  });

  it('follows the dated records before and after a transfer (AC-014)', () => {
    expect(teamOn(memberships, assignments, PF, '2026-06-30').map((r) => r.membership.employeeId)).toEqual(['ana', 'nuria']);
    expect(teamOn(memberships, assignments, PF, '2026-07-01').map((r) => r.membership.employeeId)).toEqual(['nuria']);
    expect(teamOn(memberships, assignments, CA, '2026-07-01').map((r) => r.membership.employeeId)).toEqual(['ana']);
  });

  it('shows a returning employee once (AC-024)', () => {
    const returning = [m('r1', 'pau', PF, '2025-01-01', '2025-06-30'), m('r2', 'pau', PF, '2026-03-01')];
    expect(teamOn(returning, [], PF, '2026-04-01')).toHaveLength(1);
  });

  it('ignores an assignment in another House on the same date', () => {
    const other = [a('x', 'nuria', 'ctA', CA, '2026-01-01')];
    expect(teamOn(memberships, other, PF, '2026-03-01').find((r) => r.membership.employeeId === 'nuria')?.assignment).toBeNull();
  });
});

describe('formerMembers', () => {
  it('lists people with a completed period who are not members today', () => {
    const memberships = [
      m('m1', 'ana', PF, '2025-01-01', '2025-06-30'),
      m('m2', 'ana', PF, '2026-01-01', '2026-06-30'),
      m('m3', 'nuria', PF, '2025-09-01'),
      m('m4', 'pau', PF, '2025-01-01', '2025-12-31'),
      m('m5', 'pau', PF, '2026-03-01'),
      m('m6', 'joan', PF, '2027-01-01', '2027-02-01'),
    ];
    expect(formerMembers(memberships, PF, '2026-08-01').map((x) => [x.employeeId, x.id])).toEqual([['ana', 'm2']]);
  });
});

describe('ctOccupantsOn', () => {
  it('keeps vacant CT positions and stays inside the House (FR-007)', () => {
    const assignments = [a('a1', 'jordi', 'ct1', PF, '2025-09-01', '2026-06-30'), a('a2', 'pau', 'ctA', CA, '2025-09-01')];
    const pf = ctOccupantsOn([er1, ct1, ct2, ctA], assignments, PF, '2026-06-30');
    expect(pf.map((o) => [o.position.id, o.assignment?.employeeId ?? null])).toEqual([
      ['ct1', 'jordi'],
      ['ct2', null],
    ]);
    expect(ctOccupantsOn([ct1, ct2], assignments, PF, '2026-07-01').every((o) => o.assignment === null)).toBe(true);
  });
});

describe('findAssignmentConflict', () => {
  const existing = [a('a1', 'marta', 'er1', PF, '2026-01-01', '2026-06-30')];

  it('reports an occupied position (AC-005)', () => {
    expect(findAssignmentConflict(existing, { employeeId: 'ana', positionId: 'er1', startsOn: '2026-06-30', endsOn: null })?.reason).toBe('position-occupied');
  });

  it('allows the adjacent day', () => {
    expect(findAssignmentConflict(existing, { employeeId: 'ana', positionId: 'er1', startsOn: '2026-07-01', endsOn: null })).toBeNull();
  });

  it('reports a second position for the same employee', () => {
    expect(findAssignmentConflict(existing, { employeeId: 'marta', positionId: 'er2', startsOn: '2026-03-01', endsOn: null })?.reason).toBe('employee-has-position');
  });
});

describe('findContainingMembership', () => {
  const memberships = [m('m1', 'ana', PF, '2026-01-01', '2026-06-30')];

  it('finds the single membership that covers the interval', () => {
    expect(findContainingMembership(memberships, { employeeId: 'ana', houseId: PF, startsOn: '2026-02-01', endsOn: '2026-06-30' })?.id).toBe('m1');
  });

  it('rejects an open assignment on a finite membership and another House (AC-007)', () => {
    expect(findContainingMembership(memberships, { employeeId: 'ana', houseId: PF, startsOn: '2026-06-01', endsOn: null })).toBeUndefined();
    expect(findContainingMembership(memberships, { employeeId: 'ana', houseId: CA, startsOn: '2026-02-01', endsOn: '2026-03-01' })).toBeUndefined();
  });
});
