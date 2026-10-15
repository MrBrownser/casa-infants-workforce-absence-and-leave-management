// src/lib/saldos.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ApRecord } from './balances';
import { apDateLabel, buildSaldosView, initials, matchesName, saldosHref, vacationLabel } from './saldos';
import type { PersonRecord } from './team';

const person = (id: string, fullName: string, house: PersonRecord['house'], postKey: string, active = true): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active,
});

const roger = person('roger', 'Roger Beltrán Camps', 'paulo-freire', 'et');
const david = person('david', 'David Valls Medina', 'paulo-freire', 'en');
const meritxell = person('meritxell', 'Meritxell Torres Vila', null, 'pdg');
const laia = person('laia', 'Laia Vidal Mas', 'carme-aymerich', 'er');
const nuria = person('nuria', 'Núria Roca Ferrer', 'paulo-freire', 'tfm', false);
const pol = person('pol', 'Pol Jiménez Alcover', 'paulo-freire', 'ct', false);

const ap = (personId: string, date: string, minutes: number, kind: ApRecord['kind'] = 'non_recoverable'): ApRecord => ({
  id: `${personId}-${date}`,
  personId,
  house: 'paulo-freire',
  kind,
  year: 2026,
  date,
  minutes,
});

const openings = new Map([
  ['roger', { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }],
  ['david', { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 }],
]);
const aps = [ap('david', '2026-03-19', 660), ap('david', '2026-03-18', 660), ap('nuria', '2026-02-06', 480), ap('laia', '2026-03-02', 240)];
const view = () => buildSaldosView({ house: 'paulo-freire', year: 2026, people: [roger, david, meritxell, laia, nuria, pol], openings, aps });

describe('buildSaldosView', () => {
  it('lists the active people of the House and the shared posts, sorted by name, never the other House', () => {
    expect(view().rows.map((r) => r.person.fullName)).toEqual(['David Valls Medina', 'Meritxell Torres Vila', 'Roger Beltrán Camps']);
  });

  it('labels each person with their post', () => {
    expect(view().rows.map((r) => r.postLabel)).toEqual(['Educadora de nit', 'Pedagoga', 'Educadora de tardes']);
  });

  it('computes balances from stored openings, or defaults, and the year APs sorted by date', () => {
    const [davidRow, meritxellRow] = view().rows;
    expect(davidRow.aps.map((a) => a.date)).toEqual(['2026-03-18', '2026-03-19']);
    expect(davidRow.balances.nonRecoverable.usedMinutes).toBe(1320);
    expect(davidRow.balances.surplusMinutes).toBe(-555);
    expect(meritxellRow.balances).toMatchObject({ vacationTotal: 31, surplusMinutes: 0 });
  });

  it('keeps former members apart, only when they have data that year', () => {
    expect(view().former.map((r) => r.person.fullName)).toEqual(['Núria Roca Ferrer']);
  });

  it('totals the active people only', () => {
    expect(view().totals).toEqual({ apnrUsedMinutes: 1320, apnrCapMinutes: 3 * 1440, owePeople: 2, oweMinutes: 795 });
  });
});

describe('labels', () => {
  it('matches names ignoring accents and case', () => {
    expect(matchesName('Roger Beltrán Camps', 'BELTRAN')).toBe(true);
    expect(matchesName('Núria Roca Ferrer', 'nuria')).toBe(true);
    expect(matchesName('Núria Roca Ferrer', 'NÚRIA')).toBe(true);
    expect(matchesName('Núria Roca Ferrer', '  ')).toBe(true);
    expect(matchesName('Núria Roca Ferrer', 'zzz')).toBe(false);
  });

  it('builds initials from the first two words', () => {
    expect(initials('Roger Beltrán Camps')).toBe('RB');
    expect(initials('Àlex')).toBe('À');
  });

  it('shows the vacation total with the AA days', () => {
    expect(vacationLabel(view().rows[2].balances)).toBe('33 dies (2 AA)');
    expect(vacationLabel(view().rows[0].balances)).toBe('31 dies');
  });

  it('labels a January date of the next year only on the earlier year', () => {
    expect(apDateLabel('2026-04-08', 2026)).toEqual({ text: 'dc. 08/04/2026', note: null });
    expect(apDateLabel('2027-01-15', 2026)).toEqual({ text: 'dv. 15/01/2027', note: 'gener 2027' });
    expect(apDateLabel('2027-01-15', 2027)).toEqual({ text: 'dv. 15/01/2027', note: null });
  });

  it('builds Saldos links with the year and an optional person', () => {
    expect(saldosHref('paulo-freire', 2026)).toBe('/paulo-freire/saldos?year=2026');
    expect(saldosHref('paulo-freire', 2026, 'roger')).toBe('/paulo-freire/saldos?year=2026&person=roger');
  });
});
