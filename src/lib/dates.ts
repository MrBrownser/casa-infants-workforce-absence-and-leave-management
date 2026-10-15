/** A calendar date as `YYYY-MM-DD`: no time, no time zone. Compares correctly as a string. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// en-CA formats as YYYY-MM-DD.
const madridDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date for the Houses, which are in Catalonia. Never use the server's UTC date. */
export function todayInMadrid(now: Date = new Date()): IsoDate {
  return madridDate.format(now);
}

export function isoDateToDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function dateToIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const result = isoDateToDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return dateToIsoDate(result);
}

const catalanDate = new Intl.DateTimeFormat('ca', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDateCa(date: IsoDate): string {
  return catalanDate.format(isoDateToDate(date));
}

/** Monday = 0 … Sunday = 6, as on the director's rota. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function weekdayOf(date: IsoDate): Weekday {
  return ((isoDateToDate(date).getUTCDay() + 6) % 7) as Weekday;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((isoDateToDate(to).getTime() - isoDateToDate(from).getTime()) / DAY_MS);
}

// A fixed Monday anchors week alternation (night seats, shared posts). ISO week
// numbers would break it: 2026 has 53 weeks, so weeks 53 and 1 are both odd.
const WEEK_ANCHOR: IsoDate = '2024-01-01';

/** Weeks (Monday to Sunday) since the anchor; consecutive weeks differ by one. */
export function weekIndex(date: IsoDate): number {
  return Math.floor(daysBetween(WEEK_ANCHOR, date) / 7);
}

const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** `dd/mm/aaaa` (docs/domain.md §10) to an IsoDate, or null when it is not a real date. */
export function parseDateDdMmYyyy(text: string): IsoDate | null {
  const match = DD_MM_YYYY.exec(text.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isIsoDate(iso) ? iso : null;
}

export function formatDateDdMmYyyy(date: IsoDate): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** Rebuilds the field from its digits while typing: `01072026` becomes `01/07/2026`. */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

/** A `?year=` value: four digits from 2000 to 2100, or null so the page falls back to the current year. */
export function parseYearParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}
