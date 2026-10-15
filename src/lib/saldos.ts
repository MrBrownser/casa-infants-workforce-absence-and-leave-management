// src/lib/saldos.ts
// The Saldos page as plain data (design D8), shared by the server read and the
// client components.
import { personBalances, type ApRecord, type PersonBalances } from './balances';
import { formatDateDdMmYyyy, weekdayOf, type IsoDate } from './dates';
import type { HouseSlug } from './houses';
import { ROLE_LABELS, findPost } from './posts';
import { AP_RULES, defaultOpeningBalances, type OpeningBalances } from './rules';
import { belongsTo, type PersonRecord } from './team';

export type SaldoRow = { person: PersonRecord; postLabel: string; balances: PersonBalances; aps: readonly ApRecord[] };
export type SaldosTotals = { apnrUsedMinutes: number; apnrCapMinutes: number; owePeople: number; oweMinutes: number };
export type SaldosView = { year: number; rows: SaldoRow[]; former: SaldoRow[]; totals: SaldosTotals };

const byName = (a: PersonRecord, b: PersonRecord) => a.fullName.localeCompare(b.fullName, 'ca');
const byDate = (a: ApRecord, b: ApRecord) => a.date.localeCompare(b.date);

function postLabelOf(person: PersonRecord): string {
  const post = findPost(person.house, person.postKey);
  return post ? ROLE_LABELS[post.roleCode] : person.postKey;
}

function totalsOf(rows: readonly SaldoRow[]): SaldosTotals {
  let apnrUsedMinutes = 0;
  let owePeople = 0;
  let oweMinutes = 0;
  for (const { balances } of rows) {
    apnrUsedMinutes += balances.nonRecoverable.usedMinutes;
    if (balances.surplusMinutes < 0) {
      owePeople += 1;
      oweMinutes -= balances.surplusMinutes;
    }
  }
  return { apnrUsedMinutes, apnrCapMinutes: rows.length * AP_RULES.nonRecoverable.minutes, owePeople, oweMinutes };
}

/**
 * Active people of the House and of the shared posts; inactive people of the
 * House only when they have APs or stored balances that year ("Antics
 * membres"). Totals count active people only.
 */
export function buildSaldosView(input: {
  house: HouseSlug;
  year: number;
  people: readonly PersonRecord[];
  openings: ReadonlyMap<string, OpeningBalances>;
  aps: readonly ApRecord[];
}): SaldosView {
  const rows: SaldoRow[] = [];
  const former: SaldoRow[] = [];
  const people = input.people.filter((p) => belongsTo(p, input.house)).sort(byName);
  for (const person of people) {
    const stored = input.openings.get(person.id);
    const aps = input.aps.filter((ap) => ap.personId === person.id).sort(byDate);
    const opening = stored ?? defaultOpeningBalances(input.year, person.startedOn);
    const row: SaldoRow = { person, postLabel: postLabelOf(person), balances: personBalances(opening, aps), aps };
    if (person.active) rows.push(row);
    else if (stored || aps.length > 0) former.push(row);
  }
  return { year: input.year, rows, former, totals: totalsOf(rows) };
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Search ignoring accents and case: "nuria", "NÚRIA" and "Núria" all find Núria. */
export function matchesName(fullName: string, query: string): boolean {
  const q = fold(query.trim());
  return q === '' || fold(fullName).includes(q);
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** "34 dies (3 AA)": the total includes the AA days, as in the prototype. */
export function vacationLabel(balances: PersonBalances): string {
  return `${balances.vacationTotal} dies${balances.carriedDays ? ` (${balances.carriedDays} AA)` : ''}`;
}

const WEEKDAYS = ['dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.', 'dg.'] as const;

/** "dc. 08/04/2026"; a January date of the next year gets a note ("gener 2027"). */
export function apDateLabel(date: IsoDate, year: number): { text: string; note: string | null } {
  const text = `${WEEKDAYS[weekdayOf(date)]} ${formatDateDdMmYyyy(date)}`;
  return { text, note: date > `${year}-12-31` ? `gener ${year + 1}` : null };
}

export function saldosHref(house: HouseSlug, year: number, personId?: string): string {
  return `/${house}/saldos?year=${year}${personId ? `&person=${personId}` : ''}`;
}
