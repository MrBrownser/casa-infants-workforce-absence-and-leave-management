// src/lib/balances.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { apDateWindow, checkNewAp, personBalances, remainingFor, type ApKind } from './balances';

const opening = { vacationDays: 31, carriedDays: 3, surplusMinutes: 120 };
const ap = (kind: ApKind, minutes: number) => ({ kind, minutes });
const h = (hours: number) => hours * 60;
const many = (n: number, kind: ApKind, minutes: number) => Array.from({ length: n }, () => ap(kind, minutes));

describe('personBalances', () => {
  it('adds the AA days to the vacation total', () => {
    expect(personBalances(opening, [])).toMatchObject({ vacationDays: 31, carriedDays: 3, vacationTotal: 34 });
  });

  it('sums the AP no recuperables and what is left', () => {
    const b = personBalances(opening, [ap('non_recoverable', h(4)), ap('non_recoverable', h(8)), ap('recoverable', h(1))]);
    expect(b.nonRecoverable).toEqual({ usedMinutes: h(12), leftMinutes: h(12), count: 2, maxCount: 5, capMinutes: h(24) });
  });

  it('deducts the AP recuperables from the opening surplus, which may go negative', () => {
    const b = personBalances(opening, [ap('recoverable', h(6))]);
    expect(b.recoverable).toEqual({ usedMinutes: h(6), leftMinutes: h(18), count: 1, maxCount: 3, capMinutes: h(24) });
    expect(b.openingSurplusMinutes).toBe(120);
    expect(b.surplusMinutes).toBe(-240);
  });

  it('never shows negative time left, even with stored data over the limit', () => {
    expect(personBalances(opening, [ap('non_recoverable', h(13)), ap('non_recoverable', h(13))]).nonRecoverable.leftMinutes).toBe(0);
  });
});

describe('remainingFor', () => {
  it('offers the hours left, capped at one request', () => {
    expect(remainingFor(personBalances(opening, [ap('recoverable', h(8))]), 'recoverable')).toEqual({ minutes: h(16), last: false });
    expect(remainingFor(personBalances(opening, []), 'non_recoverable')).toEqual({ minutes: h(24), last: false });
  });

  it('marks the last allowed request', () => {
    // 4 requests, 18 h used: the fifth starts at 6 h.
    expect(remainingFor(personBalances(opening, many(4, 'non_recoverable', 270)), 'non_recoverable')).toEqual({ minutes: h(6), last: true });
  });

  it('returns null when nothing can be requested', () => {
    expect(remainingFor(personBalances(opening, many(2, 'non_recoverable', h(12))), 'non_recoverable')).toBeNull();
    expect(remainingFor(personBalances(opening, many(3, 'recoverable', h(1))), 'recoverable')).toBeNull();
  });
});

describe('apDateWindow', () => {
  it('runs from 1 January to 31 January of the next year (FPOL32 §1)', () => {
    expect(apDateWindow(2026)).toEqual({ first: '2026-01-01', last: '2027-01-31' });
  });
});

describe('checkNewAp', () => {
  const none = personBalances(opening, []);
  const base = { kind: 'non_recoverable' as ApKind, year: 2026, date: '2026-03-10', minutes: h(4) };

  it.each(['2026-01-01', '2027-01-31'])('accepts %s for 2026', (date) => {
    expect(checkNewAp(none, { ...base, date }).errors).toEqual([]);
  });

  it.each(['2025-12-31', '2027-02-01'])('rejects %s for 2026', (date) => {
    expect(checkNewAp(none, { ...base, date }).errors).toEqual(['La data ha de ser entre el 01/01/2026 i el 31/01/2027.']);
  });

  it('accepts a fifth AP no recuperable and rejects a sixth', () => {
    expect(checkNewAp(personBalances(opening, many(4, 'non_recoverable', h(1))), base).errors).toEqual([]);
    expect(checkNewAp(personBalances(opening, many(5, 'non_recoverable', h(1))), base).errors).toEqual([
      "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.",
    ]);
  });

  it('accepts a third AP recuperable and rejects a fourth', () => {
    const recoverable = { ...base, kind: 'recoverable' as ApKind, minutes: h(1) };
    expect(checkNewAp(personBalances(opening, many(2, 'recoverable', h(1))), recoverable).errors).toEqual([]);
    expect(checkNewAp(personBalances(opening, many(3, 'recoverable', h(1))), recoverable).errors).toEqual([
      "Ja ha fet servir els 3 dies que permet aquest tipus d'AP.",
    ]);
  });

  it('accepts exactly the hours left and rejects one minute more', () => {
    const twenty = personBalances(opening, [ap('non_recoverable', h(20))]);
    expect(checkNewAp(twenty, { ...base, minutes: h(4) }).errors).toEqual([]);
    expect(checkNewAp(twenty, { ...base, minutes: h(4) + 1 }).errors).toEqual(['Supera el màxim de 24 h: només li queden 4 h.']);
  });

  it('names what is left when the yearly hours would be exceeded', () => {
    const b = personBalances(opening, [ap('recoverable', h(22))]);
    expect(checkNewAp(b, { ...base, kind: 'recoverable', minutes: 150 }).errors).toEqual(['Supera el màxim de 24 h: només li queden 2 h.']);
  });

  it.each([0, 1441])('rejects a request of %i minutes', (minutes) => {
    expect(checkNewAp(none, { ...base, minutes }).errors).toEqual(['Escriu les hores entre 0:01 i 24:00.']);
  });

  it('accepts 24:00 in one request (a night plus the team meeting fits)', () => {
    expect(checkNewAp(none, { ...base, minutes: h(24) }).errors).toEqual([]);
  });

  it('previews the AP no recuperables left', () => {
    const b = personBalances(opening, many(3, 'non_recoverable', h(4)));
    expect(checkNewAp(b, { ...base, minutes: h(6) }).preview).toBe("Li quedaran 6 h d'AP no recuperables (dia 4 de 5).");
  });

  it('never blocks an AP recuperable that takes the surplus below zero', () => {
    const result = checkNewAp(none, { ...base, kind: 'recoverable', minutes: h(6) });
    expect(result.errors).toEqual([]);
    expect(result.notices).toEqual(["L'excedent passarà de +2 h a −4 h: haurà de retornar 4 h. Es pot apuntar igualment."]);
    expect(result.preview).toBeNull();
  });

  it('previews the surplus when it stays positive', () => {
    expect(checkNewAp(none, { ...base, kind: 'recoverable', minutes: h(1) }).preview).toBe("L'excedent passarà de +2 h a +1 h.");
  });

  it('warns on a public holiday but allows it', () => {
    const result = checkNewAp(none, { ...base, date: '2026-12-25' });
    expect(result.errors).toEqual([]);
    expect(result.notices).toEqual(['És festiu (Nadal): segons la instrucció no es poden demanar AP en festius.']);
  });

  it('checks nothing it does not have yet', () => {
    expect(checkNewAp(none, { ...base, date: null, minutes: null })).toEqual({ errors: [], notices: [], preview: null });
  });
});
