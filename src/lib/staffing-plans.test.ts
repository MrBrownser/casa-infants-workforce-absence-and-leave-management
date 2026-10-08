import { describe, expect, it } from 'vitest';
import type { Membership } from './house-membership';
import { planEndAssignment, planEndMembership, planHandover, planHouseTransfer, planNewMembership, type Assignment, type Position } from './staffing';

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

const CA = 'house-ca';
const erA: Position = { id: 'erA', houseId: CA, roleCode: 'ER', label: 'ER A' };

describe('planNewMembership', () => {
  it('opens a membership and an assignment over the same interval (AC-001)', () => {
    const plan = planNewMembership({
      employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null, position: er1,
      employeeMemberships: [], employeeAssignments: [], positionAssignments: [],
    });
    expect(plan).toEqual({
      closes: [],
      opens: [
        { kind: 'membership', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null },
        { kind: 'assignment', employeeId: 'ana', positionId: 'er1', houseId: PF, startsOn: '2026-01-01', endsOn: null },
      ],
    });
  });

  it('rejects an occupied initial position (AC-002)', () => {
    expect(() =>
      planNewMembership({
        employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null, position: er1,
        employeeMemberships: [], employeeAssignments: [], positionAssignments: [a('aM', 'marta', 'er1', '2025-09-01')],
      }),
    ).toThrow(/position-occupied/);
  });

  it('rejects a position of another House', () => {
    expect(() =>
      planNewMembership({
        employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null, position: erA,
        employeeMemberships: [], employeeAssignments: [], positionAssignments: [],
      }),
    ).toThrow(/not-found/);
  });

  it('accepts a return after a gap and rejects an overlap (AC-024)', () => {
    const past = [m('m1', 'pau', '2025-01-01', '2025-12-31')];
    expect(
      planNewMembership({
        employeeId: 'pau', houseId: PF, startsOn: '2026-03-01', endsOn: null, position: null,
        employeeMemberships: past, employeeAssignments: [], positionAssignments: [],
      }).opens,
    ).toHaveLength(1);
    expect(() =>
      planNewMembership({
        employeeId: 'pau', houseId: PF, startsOn: '2025-12-31', endsOn: null, position: null,
        employeeMemberships: past, employeeAssignments: [], positionAssignments: [],
      }),
    ).toThrow(/membership-overlap/);
  });

  it('rejects an end before the start', () => {
    expect(() =>
      planNewMembership({
        employeeId: 'ana', houseId: PF, startsOn: '2026-03-01', endsOn: '2026-02-01', position: null,
        employeeMemberships: [], employeeAssignments: [], positionAssignments: [],
      }),
    ).toThrow(/invalid-dates/);
  });
});

describe('planEndMembership', () => {
  const laia = m('mL', 'laia', '2025-09-01');

  it('closes the crossing assignment with the membership (AC-016)', () => {
    const plan = planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2025-09-01')] });
    expect(plan.closes).toEqual([
      { kind: 'assignment', id: 'aL', employeeId: 'laia', houseId: PF, positionId: 'er1', endsOn: '2026-08-31' },
      { kind: 'membership', id: 'mL', employeeId: 'laia', houseId: PF, positionId: null, endsOn: '2026-08-31' },
    ]);
  });

  it('leaves an assignment that already ends before the date', () => {
    const plan = planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2025-09-01', '2026-01-31')] });
    expect(plan.closes.map((c) => c.id)).toEqual(['mL']);
  });

  it('closes an assignment that starts on the end date', () => {
    const plan = planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2026-08-31')] });
    expect(plan.closes[0]).toMatchObject({ id: 'aL', endsOn: '2026-08-31' });
  });

  it('is blocked by an assignment that starts after the end', () => {
    expect(() =>
      planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2026-09-15')] }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects a membership that already ended or an end before its start', () => {
    expect(() => planEndMembership({ membership: m('x', 'laia', '2025-09-01', '2026-01-01'), endsOn: '2026-08-31', assignments: [] })).toThrow(/not-ongoing/);
    expect(() => planEndMembership({ membership: laia, endsOn: '2025-08-31', assignments: [] })).toThrow(/invalid-dates/);
  });
});

describe('planHouseTransfer', () => {
  const source = m('mA', 'ana', '2026-01-01');
  const anaEr1 = a('aA', 'ana', 'er1', '2026-01-01');

  it('closes source membership and assignment on D-1 and opens the destination (AC-009)', () => {
    const plan = planHouseTransfer({
      source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: erA,
      employeeMemberships: [source], employeeAssignments: [anaEr1], destinationPositionAssignments: [],
    });
    expect(plan).toEqual({
      closes: [
        { kind: 'assignment', id: 'aA', employeeId: 'ana', houseId: PF, positionId: 'er1', endsOn: '2026-06-30' },
        { kind: 'membership', id: 'mA', employeeId: 'ana', houseId: PF, positionId: null, endsOn: '2026-06-30' },
      ],
      opens: [
        { kind: 'membership', employeeId: 'ana', houseId: CA, startsOn: '2026-07-01', endsOn: null },
        { kind: 'assignment', employeeId: 'ana', positionId: 'erA', houseId: CA, startsOn: '2026-07-01', endsOn: null },
      ],
    });
  });

  it('transfers without a destination position (AC-011)', () => {
    const plan = planHouseTransfer({
      source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: null,
      employeeMemberships: [source], employeeAssignments: [], destinationPositionAssignments: [],
    });
    expect(plan.opens).toEqual([{ kind: 'membership', employeeId: 'ana', houseId: CA, startsOn: '2026-07-01', endsOn: null }]);
  });

  it('rejects an occupied destination, same House, early date and a non-ongoing source (AC-010)', () => {
    const base = {
      source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: erA,
      employeeMemberships: [source], employeeAssignments: [], destinationPositionAssignments: [] as Assignment[],
    };
    expect(() => planHouseTransfer({ ...base, destinationPositionAssignments: [{ ...a('x', 'pau', 'erA', '2025-01-01'), houseId: CA }] })).toThrow(/position-occupied/);
    expect(() => planHouseTransfer({ ...base, toHouseId: PF, destinationPosition: null })).toThrow(/same-house/);
    expect(() => planHouseTransfer({ ...base, startsOn: '2026-01-01' })).toThrow(/starts-too-early/);
    expect(() => planHouseTransfer({ ...base, source: { ...source, endsOn: '2026-06-30' } })).toThrow(/not-ongoing/);
  });

  it('rejects a future source assignment instead of cancelling it (AC-013)', () => {
    expect(() =>
      planHouseTransfer({
        source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: null,
        employeeMemberships: [source], employeeAssignments: [a('aF', 'ana', 'er2', '2026-07-15')], destinationPositionAssignments: [],
      }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects a destination that overlaps another planned membership', () => {
    const later = { ...m('mL', 'ana', '2027-01-01'), houseId: CA };
    expect(() =>
      planHouseTransfer({
        source: { ...source, endsOn: null }, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: null,
        employeeMemberships: [source, later], employeeAssignments: [], destinationPositionAssignments: [],
      }),
    ).toThrow(/membership-overlap/);
  });

  it('rejects a destination position from the source House', () => {
    expect(() =>
      planHouseTransfer({
        source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: er2,
        employeeMemberships: [source], employeeAssignments: [], destinationPositionAssignments: [],
      }),
    ).toThrow(/not-found/);
  });
});
