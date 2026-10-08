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
