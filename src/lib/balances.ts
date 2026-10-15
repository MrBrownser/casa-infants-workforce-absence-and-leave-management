// src/lib/balances.ts
// AP balances of one person and year (SPEC-004, design D4). Pure functions
// shared by the Saldos page, the form's live preview and the server, so the
// screen and the database never disagree. Rules live in src/lib/rules.ts.
import { formatDateDdMmYyyy, type IsoDate } from './dates';
import { formatDuration } from './duration';
import { holidayOn } from './holidays';
import type { HouseSlug } from './houses';
import { AP_RULES, type OpeningBalances } from './rules';

export const AP_KINDS = ['non_recoverable', 'recoverable'] as const;
export type ApKind = (typeof AP_KINDS)[number];

export const AP_KIND_LABELS: Record<ApKind, string> = {
  non_recoverable: 'AP no recuperable',
  recoverable: 'AP recuperable',
};

/** One request: a night shift plus the next team meeting fits in 24 h. */
export const MAX_REQUEST_MINUTES = 24 * 60;

/** An AP as the app sees it. `house` is where it was recorded (design D2). */
export type ApRecord = {
  id: string;
  personId: string;
  house: HouseSlug;
  kind: ApKind;
  year: number;
  date: IsoDate;
  minutes: number;
};

export type KindBalance = { usedMinutes: number; leftMinutes: number; count: number; maxCount: number; capMinutes: number };

export type PersonBalances = {
  vacationDays: number;
  carriedDays: number;
  /** Vacation days plus AA. "To plan" equals this until SPEC-006 records periods. */
  vacationTotal: number;
  nonRecoverable: KindBalance;
  recoverable: KindBalance;
  openingSurplusMinutes: number;
  /** Opening surplus minus the AP recuperables; negative means the person owes hours. */
  surplusMinutes: number;
};

const LIMITS: Record<ApKind, { minutes: number; maxDays: number }> = {
  non_recoverable: AP_RULES.nonRecoverable,
  recoverable: AP_RULES.recoverable,
};

function balanceOf(aps: readonly { kind: ApKind; minutes: number }[], kind: ApKind): KindBalance {
  const own = aps.filter((ap) => ap.kind === kind);
  const usedMinutes = own.reduce((sum, ap) => sum + ap.minutes, 0);
  const { minutes: capMinutes, maxDays: maxCount } = LIMITS[kind];
  return { usedMinutes, leftMinutes: Math.max(0, capMinutes - usedMinutes), count: own.length, maxCount, capMinutes };
}

/** Every AP of the year counts, future-dated ones too: only approved APs are recorded. */
export function personBalances(opening: OpeningBalances, aps: readonly { kind: ApKind; minutes: number }[]): PersonBalances {
  const nonRecoverable = balanceOf(aps, 'non_recoverable');
  const recoverable = balanceOf(aps, 'recoverable');
  return {
    vacationDays: opening.vacationDays,
    carriedDays: opening.carriedDays,
    vacationTotal: opening.vacationDays + opening.carriedDays,
    nonRecoverable,
    recoverable,
    openingSurplusMinutes: opening.surplusMinutes,
    surplusMinutes: opening.surplusMinutes - recoverable.usedMinutes,
  };
}

export function kindBalance(balances: PersonBalances, kind: ApKind): KindBalance {
  return kind === 'non_recoverable' ? balances.nonRecoverable : balances.recoverable;
}

/** Time the next request of `kind` can take, and whether it is the last one allowed; null when none is. */
export function remainingFor(balances: PersonBalances, kind: ApKind): { minutes: number; last: boolean } | null {
  const k = kindBalance(balances, kind);
  if (k.count >= k.maxCount || k.leftMinutes === 0) return null;
  return { minutes: Math.min(k.leftMinutes, MAX_REQUEST_MINUTES), last: k.count === k.maxCount - 1 };
}

/** APs of the previous year can be taken until 31 January (FASI instruction FPOL32 §1). */
export function apDateWindow(year: number): { first: IsoDate; last: IsoDate } {
  return { first: `${year}-01-01`, last: `${year + 1}-01-31` };
}

export type NewApCheck = { kind: ApKind; year: number; date: IsoDate | null; minutes: number | null };
export type ApCheck = { errors: string[]; notices: string[]; preview: string | null };

/**
 * Errors block the save; notices do not (a holiday, an AP recuperable taking
 * the surplus below zero). Fields still empty (null) are not checked.
 */
export function checkNewAp(balances: PersonBalances, ap: NewApCheck): ApCheck {
  const errors: string[] = [];
  const notices: string[] = [];
  let preview: string | null = null;
  const k = kindBalance(balances, ap.kind);

  if (k.count >= k.maxCount) errors.push(`Ja ha fet servir els ${k.maxCount} dies que permet aquest tipus d'AP.`);

  if (ap.date !== null) {
    const { first, last } = apDateWindow(ap.year);
    if (ap.date < first || ap.date > last) {
      errors.push(`La data ha de ser entre el ${formatDateDdMmYyyy(first)} i el ${formatDateDdMmYyyy(last)}.`);
    } else {
      const holiday = holidayOn(ap.date);
      if (holiday) notices.push(`És festiu (${holiday}): segons la instrucció no es poden demanar AP en festius.`);
    }
  }

  if (ap.minutes !== null) {
    if (ap.minutes < 1 || ap.minutes > MAX_REQUEST_MINUTES) {
      errors.push('Escriu les hores entre 0:01 i 24:00.');
    } else if (k.usedMinutes + ap.minutes > k.capMinutes) {
      errors.push(`Supera el màxim de ${formatDuration(k.capMinutes)}: només li queden ${formatDuration(k.leftMinutes)}.`);
    }
  }

  if (errors.length === 0 && ap.minutes !== null) {
    if (ap.kind === 'non_recoverable') {
      preview = `Li quedaran ${formatDuration(k.leftMinutes - ap.minutes)} d'AP no recuperables (dia ${k.count + 1} de ${k.maxCount}).`;
    } else {
      const before = formatDuration(balances.surplusMinutes, { signed: true });
      const afterMinutes = balances.surplusMinutes - ap.minutes;
      const after = formatDuration(afterMinutes, { signed: true });
      if (afterMinutes < 0) {
        notices.push(`L'excedent passarà de ${before} a ${after}: haurà de retornar ${formatDuration(-afterMinutes)}. Es pot apuntar igualment.`);
      } else {
        preview = `L'excedent passarà de ${before} a ${after}.`;
      }
    }
  }

  return { errors, notices, preview };
}
