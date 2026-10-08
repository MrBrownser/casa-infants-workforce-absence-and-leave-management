import { describe, expect, it } from 'vitest';
import type { Membership } from './house-membership';
import { planEndAssignment, planHandover, type Assignment, type Position } from './staffing';

const PF = 'house-pf';
const er1: Position = { id: 'er1', houseId: PF, roleCode: 'ER', label: 'ER 1' };
const er2: Position = { id: 'er2', houseId: PF, roleCode: 'ER', label: 'ER 2' };
const m = (id: string, employeeId: string, startsOn: string, endsOn: string | null = null): Membership => ({
  id, employeeId, houseId: PF, startsOn, endsOn,
});
const a = (id: string, employeeId: string, positionId: string, startsOn: string, endsOn: string | null = null): Assignment => ({
  id, employeeId, positionId, houseId: PF, startsOn, endsOn,
});

describe('planHandover', () => {
  const memberships = [m('mA', 'ana', '2026-01-01'), m('mM', 'marta', '2025-09-01')];

  it('replaces the occupant on the same position (AC-004)', () => {
    const marta = a('aM', 'marta', 'er1', '2025-09-01');
    const plan = planHandover({
      position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
      positionAssignments: [marta], incomingAssignments: [], incomingMemberships: memberships,
    });
    expect(plan).toEqual({
      closes: [{ kind: 'assignment', id: 'aM', employeeId: 'marta', houseId: PF, positionId: 'er1', endsOn: '2026-06-30' }],
      opens: [{ kind: 'assignment', employeeId: 'ana', positionId: 'er1', houseId: PF, startsOn: '2026-07-01', endsOn: null }],
    });
  });

  it('assigns a vacant position', () => {
    const plan = planHandover({
      position: er2, incomingEmployeeId: 'ana', startsOn: '2026-03-01', endsOn: '2026-05-31',
      positionAssignments: [], incomingAssignments: [], incomingMemberships: memberships,
    });
    expect(plan.closes).toEqual([]);
    expect(plan.opens).toHaveLength(1);
  });

  it('moves an employee within the House and leaves membership alone', () => {
    const ana = a('aA', 'ana', 'er1', '2026-01-01');
    const plan = planHandover({
      position: er2, incomingEmployeeId: 'ana', startsOn: '2026-04-01', endsOn: null,
      positionAssignments: [], incomingAssignments: [ana], incomingMemberships: memberships,
    });
    expect(plan.closes).toEqual([{ kind: 'assignment', id: 'aA', employeeId: 'ana', houseId: PF, positionId: 'er1', endsOn: '2026-03-31' }]);
    expect(plan.closes.some((c) => c.kind === 'membership')).toBe(false);
  });

  it('rejects a handover blocked by a future assignment', () => {
    const future = a('aF', 'marta', 'er1', '2026-09-01');
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
        positionAssignments: [future], incomingAssignments: [], incomingMemberships: memberships,
      }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects an outgoing assignment that starts on D', () => {
    const sameDay = a('aS', 'marta', 'er1', '2026-07-01');
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
        positionAssignments: [sameDay], incomingAssignments: [], incomingMemberships: memberships,
      }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects assigning someone to the position they already hold', () => {
    const ana = a('aA', 'ana', 'er1', '2026-01-01');
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
        positionAssignments: [ana], incomingAssignments: [ana], incomingMemberships: memberships,
      }),
    ).toThrow(/employee-has-position/);
  });

  it('rejects an assignment beyond the membership (AC-007)', () => {
    const finite = [m('mA', 'ana', '2026-01-01', '2026-06-30')];
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-06-01', endsOn: null,
        positionAssignments: [], incomingAssignments: [], incomingMemberships: finite,
      }),
    ).toThrow(/outside-membership/);
  });

  it('rejects an end before the start', () => {
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: '2026-06-01',
        positionAssignments: [], incomingAssignments: [], incomingMemberships: memberships,
      }),
    ).toThrow(/invalid-dates/);
  });
});

describe('planEndAssignment', () => {
  it('closes an ongoing assignment', () => {
    expect(planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01'), '2026-08-31').closes).toEqual([
      { kind: 'assignment', id: 'a1', employeeId: 'ana', houseId: PF, positionId: 'er1', endsOn: '2026-08-31' },
    ]);
  });

  it('allows a one-day assignment', () => {
    expect(planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01'), '2026-05-01').closes[0].endsOn).toBe('2026-05-01');
  });

  it('rejects an end before the start', () => {
    expect(() => planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01'), '2026-04-30')).toThrow(/invalid-dates/);
  });

  it('rejects an assignment that already ended', () => {
    expect(() => planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01', '2026-06-30'), '2026-07-31')).toThrow(/not-ongoing/);
  });
});
