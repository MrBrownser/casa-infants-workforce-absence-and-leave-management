import { describe, expect, it } from 'vitest';
import type { StaffingErrorReason } from './staffing-error';
import { describePlan, errorMessage } from './staffing-messages';

const ALL: StaffingErrorReason[] = [
  'invalid-dates', 'not-ongoing', 'same-house', 'starts-too-early', 'membership-overlap', 'employee-has-position',
  'position-occupied', 'outside-membership', 'future-assignment-blocks', 'label-taken', 'stale', 'not-found', 'operation-conflict',
];

describe('errorMessage', () => {
  it('has Catalan copy for every reason', () => {
    for (const reason of ALL) expect(errorMessage(reason)).toMatch(/\.$/);
    expect(errorMessage('stale')).toBe('Les dades han canviat mentrestant. Torna a carregar la pàgina.');
  });
});

describe('describePlan', () => {
  it('lists closes, then opens, with people, positions, Houses and dates', () => {
    const lines = describePlan(
      {
        closes: [
          { kind: 'assignment', id: 'a1', employeeId: 'e1', houseId: 'pf', positionId: 'p1', endsOn: '2026-06-30' },
          { kind: 'membership', id: 'm1', employeeId: 'e1', houseId: 'pf', positionId: null, endsOn: '2026-06-30' },
        ],
        opens: [
          { kind: 'membership', employeeId: 'e1', houseId: 'ca', startsOn: '2026-07-01', endsOn: null },
          { kind: 'assignment', employeeId: 'e1', positionId: 'p2', houseId: 'ca', startsOn: '2026-07-01', endsOn: '2026-12-31' },
        ],
      },
      { employees: { e1: 'Ana Puig' }, positions: { p1: 'ER 1', p2: 'ER A' }, houses: { pf: 'Paulo Freire', ca: 'Carme Aymerich' } },
    );
    expect(lines).toEqual([
      'Ana Puig: lloc ER 1 a Paulo Freire acaba el 30 de juny del 2026.',
      'Ana Puig: pertinença a Paulo Freire acaba el 30 de juny del 2026.',
      'Ana Puig: pertinença a Carme Aymerich comença el 1 de juliol del 2026.',
      'Ana Puig: lloc ER A a Carme Aymerich comença el 1 de juliol del 2026 i acaba el 31 de desembre del 2026.',
    ]);
  });
});
