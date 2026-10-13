// The posts of each House and the posts shared by both Houses (SPEC-003,
// design D2 and D3). Posts are fixed: only the people who cover them change.
// Changing a post or a schedule is a code change; keep docs/domain.md §2 and
// §3 in sync.
import { addDays, weekIndex, weekdayOf, type IsoDate } from './dates';
import { HOUSES, isHouseSlug, type HouseSlug } from './houses';

export const ROLE_LABELS = {
  PDG: 'Pedagoga',
  PSI: 'Psicòloga',
  ER: 'Educadora referent',
  TFM: 'Treballadora familiar de matins',
  TFT: 'Treballadora familiar de tardes',
  ET: 'Educadora de tardes',
  ECS: 'Educadora de cap de setmana',
  EN: 'Educadora de nit',
  CT: 'Corretorn',
} as const;

export type RoleCode = keyof typeof ROLE_LABELS;

/** `HH:MM` to `HH:MM`. A range that ends earlier than it starts crosses midnight. */
export type TimeRange = { readonly from: string; readonly to: string };

/** Ranges for Monday (index 0) to Sunday (index 6), the same every week. */
export type WeeklySchedule = readonly (readonly TimeRange[])[];

/** On a public holiday: weekday posts rest, the ECS works its weekend day, the night works as usual. */
export type HolidayRule = 'off' | 'weekend' | 'as-usual';

export type Post = {
  readonly key: string;
  readonly roleCode: RoleCode;
  readonly seats: 1 | 2;
  /** null: no fixed schedule (the CT covers absences). */
  readonly schedule: WeeklySchedule | null;
  readonly onHolidays: HolidayRule;
};

const r = (from: string, to: string): TimeRange => ({ from, to });
const NONE: readonly TimeRange[] = [];
const weekdays = (range: TimeRange): WeeklySchedule => [[range], [range], [range], [range], [range], NONE, NONE];

// PROVISIONAL: invented, plausible times (design D3) until the director
// confirms the real ones. Night and weekend day times come from the
// spreadsheet's FESTIUS tab.
const SCHEDULES = {
  tfm: weekdays(r('07:30', '15:00')),
  pdg: weekdays(r('09:00', '15:00')),
  psi: [[r('09:00', '15:00')], [r('14:00', '20:00')], [r('09:00', '15:00')], [r('14:00', '20:00')], [r('09:00', '15:00')], NONE, NONE],
  er: [[r('09:00', '17:00')], [r('13:00', '21:00')], [r('09:00', '17:00')], [r('13:00', '21:00')], [r('08:00', '15:00')], NONE, NONE],
  et: weekdays(r('14:00', '22:00')),
  tft: weekdays(r('15:00', '22:00')),
  ecs: [NONE, NONE, NONE, NONE, NONE, [r('10:30', '22:15')], [r('10:30', '22:15')]],
  en: [
    [r('22:00', '08:00')],
    [r('22:00', '08:00')],
    [r('22:00', '08:00')],
    [r('22:00', '08:00')],
    [r('22:00', '10:30')],
    [r('22:00', '10:30')],
    [r('22:00', '08:00')],
  ],
} satisfies Record<string, WeeklySchedule>;

const HOUSE_POSTS: readonly Post[] = [
  { key: 'er', roleCode: 'ER', seats: 1, schedule: SCHEDULES.er, onHolidays: 'off' },
  { key: 'tfm', roleCode: 'TFM', seats: 1, schedule: SCHEDULES.tfm, onHolidays: 'off' },
  { key: 'tft', roleCode: 'TFT', seats: 1, schedule: SCHEDULES.tft, onHolidays: 'off' },
  { key: 'et', roleCode: 'ET', seats: 1, schedule: SCHEDULES.et, onHolidays: 'off' },
  { key: 'ecs', roleCode: 'ECS', seats: 1, schedule: SCHEDULES.ecs, onHolidays: 'weekend' },
  { key: 'en', roleCode: 'EN', seats: 2, schedule: SCHEDULES.en, onHolidays: 'as-usual' },
  { key: 'ct', roleCode: 'CT', seats: 1, schedule: null, onHolidays: 'off' },
];

// Both Houses have the same posts today; the map lets them differ later.
const POSTS_BY_HOUSE: Record<HouseSlug, readonly Post[]> = {
  'paulo-freire': HOUSE_POSTS,
  'carme-aymerich': HOUSE_POSTS,
};

// The Pedagoga and the Psicòloga work for both Houses: their people have no House.
const SHARED_POSTS: readonly Post[] = [
  { key: 'pdg', roleCode: 'PDG', seats: 1, schedule: SCHEDULES.pdg, onHolidays: 'off' },
  { key: 'psi', roleCode: 'PSI', seats: 1, schedule: SCHEDULES.psi, onHolidays: 'off' },
];

export function postsOf(house: HouseSlug): readonly Post[] {
  return POSTS_BY_HOUSE[house];
}

export function sharedPosts(): readonly Post[] {
  return SHARED_POSTS;
}

/** A post of a House (`house` set) or a shared post (`house` null). */
export function findPost(house: HouseSlug | null, postKey: string): Post | undefined {
  return (house ? postsOf(house) : SHARED_POSTS).find((post) => post.key === postKey);
}

/** One seat of a post. `house` is null for the shared posts. */
export type SeatRef = { readonly house: HouseSlug | null; readonly postKey: string; readonly seat: number };

export function isValidSeat(ref: SeatRef): boolean {
  const post = findPost(ref.house, ref.postKey);
  return !!post && Number.isInteger(ref.seat) && ref.seat >= 1 && ref.seat <= post.seats;
}

// Seats travel through forms as one string: `paulo-freire:en:2`, `shared:pdg:1`.
export function encodeSeatRef(ref: SeatRef): string {
  return `${ref.house ?? 'shared'}:${ref.postKey}:${ref.seat}`;
}

export function decodeSeatRef(value: string): SeatRef | null {
  const [house, postKey, seat, ...rest] = value.split(':');
  if (rest.length > 0 || !postKey || !seat || !/^[1-9]$/.test(seat)) return null;
  if (house !== 'shared' && !isHouseSlug(house)) return null;
  const ref: SeatRef = { house: house === 'shared' ? null : house, postKey, seat: Number(seat) };
  return isValidSeat(ref) ? ref : null;
}

/** Every seat: the shared posts first, then each House in inventory order. */
export function allSeats(): SeatRef[] {
  const seatsOf = (house: HouseSlug | null, posts: readonly Post[]): SeatRef[] =>
    posts.flatMap((post) => Array.from({ length: post.seats }, (_, i) => ({ house, postKey: post.key, seat: i + 1 })));
  return [...seatsOf(null, SHARED_POSTS), ...HOUSES.flatMap((house) => seatsOf(house.slug, postsOf(house.slug)))];
}

// ── Schedules ────────────────────────────────────────────────────────────────

export const NO_FIXED_SCHEDULE = 'Sense horari fix';

const DAY_ABBR = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'] as const;

function formatDays(days: readonly number[]): string {
  const runs: number[][] = [];
  for (const day of days) {
    const last = runs.at(-1);
    if (last && last.at(-1) === day - 1) last.push(day);
    else runs.push([day]);
  }
  const parts = runs.map((run) => (run.length === 1 ? DAY_ABBR[run[0]] : `${DAY_ABBR[run[0]]}–${DAY_ABBR[run.at(-1)!]}`));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} i ${parts.at(-1)}`;
}

/** Compact weekly summary: `dl–dv 07:30–15:00`, `dl i dc 09:00–17:00 · dt i dj 13:00–21:00 · dv 08:00–15:00`. */
export function scheduleSummary(schedule: WeeklySchedule | null): string {
  if (!schedule) return NO_FIXED_SCHEDULE;
  const groups = new Map<string, number[]>();
  schedule.forEach((ranges, day) => {
    if (ranges.length === 0) return;
    const key = ranges.map((range) => `${range.from}–${range.to}`).join(' i ');
    groups.set(key, [...(groups.get(key) ?? []), day]);
  });
  return [...groups].map(([ranges, days]) => `${formatDays(days)} ${ranges}`).join(' · ');
}

/** The ranges a post works on `date`, or none. */
export function rangesOn(post: Post, date: IsoDate, holiday = false): readonly TimeRange[] {
  if (!post.schedule) return NONE;
  const day = weekdayOf(date);
  if (!holiday || post.onHolidays === 'as-usual') return post.schedule[day];
  if (post.onHolidays === 'weekend') return post.schedule[5];
  return NONE;
}

const isEven = (n: number) => ((n % 2) + 2) % 2 === 0;

/** The night seat on duty the week of `date`: the two seats alternate every week. */
export function nightSeatOnDuty(date: IsoDate): 1 | 2 {
  return isEven(weekIndex(date)) ? 1 : 2;
}

/**
 * PROVISIONAL (design D3, to confirm with the director): shared posts work
 * Monday to Wednesday in one House and Thursday and Friday in the other,
 * swapping Houses every week. null on weekends.
 */
export function sharedPostHouseOn(date: IsoDate): HouseSlug | null {
  const day = weekdayOf(date);
  if (day > 4) return null;
  const [first, second]: HouseSlug[] = isEven(weekIndex(date))
    ? ['paulo-freire', 'carme-aymerich']
    : ['carme-aymerich', 'paulo-freire'];
  return day <= 2 ? first : second;
}

/** Where the shared posts work the week of `date`, for the Equip page. */
export function sharedWeekSplit(date: IsoDate): { days: string; house: HouseSlug }[] {
  const monday = addDays(date, -weekdayOf(date));
  return [
    { days: 'dl–dc', house: sharedPostHouseOn(monday)! },
    { days: 'dj–dv', house: sharedPostHouseOn(addDays(monday, 3))! },
  ];
}
