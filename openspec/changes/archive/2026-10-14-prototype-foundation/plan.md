# Prototype Foundation (SPEC-003) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status:** all tasks implemented and committed; `tasks.md` is the change's progress tracker, and `db-check.md` holds the database and browser check evidence (Task 14 was done in the product owner's local session).

**Goal:** Replace dated House membership with a "who covers each post" model (posts and weekly schedules in code, `Person` and `PersonYear` in the database), set the final navigation (Saldos, Vacances, El mes, Equip) and rebuild the Equip page so the director can manage the people of each House.

**Architecture:** The domain (posts, schedules, AP and vacation rules, durations) is pure TypeScript in `src/lib/`, fully unit tested. Persistence is a thin Prisma store (`src/server/people-store.ts`, no auth, reused by the seed) behind director-gated reads (`src/server/people.ts`) and Server Functions (`src/app/(app)/[house]/team/actions.ts`). The Equip page is a Server Component that renders a pure "team view" built from the people rows; person details open as a sheet driven by `?person=<id>&year=<yyyy>`, and forms are small client components (react-hook-form + the same zod schemas the Server Functions re-parse).

**Tech Stack:** Next.js 16 App Router (Server Functions, `revalidatePath`), React 19, TypeScript, Tailwind v4, Prisma 7 + `@prisma/adapter-pg`, Postgres 16 (local throwaway for checks, Supabase EU for dev), Clerk, react-hook-form 7 + zod 4 + `@hookform/resolvers` 5, Vitest 4 + Testing Library, lucide-react.

**Spec:** `openspec/changes/prototype-foundation/` — `proposal.md`, `design.md` (decisions D1 to D12), `specs/people-and-posts/spec.md`, `specs/house-context/spec.md`, `specs/house-membership/spec.md`, `tasks.md`. Domain reference: `docs/domain.md`. Read `AGENTS.md` and `DESIGN.md` before any UI work.

## Global Constraints

- UI copy in **Catalan**; code, identifiers, comments, commit messages and docs in **English**. No em-dashes in code comments, commit messages or logs (an en-dash `–` inside Catalan UI strings such as `dl–dv 07:30–15:00` is fine).
- **No new dependencies** (proposal → Impact). There is no dialog library: the sheet is our own component.
- Conventional commits; npm; Node 24 (the cloud container has Node 22, which is fine for tests and builds).
- `requireDirector()` is called by **every** page, every server data function and every Server Function itself, never only by a layout (`AGENTS.md`).
- Next 16: `params` and `searchParams` are Promises; auth lives in `src/proxy.ts`; read `node_modules/next/dist/docs/` before using an API you have not used in this repo.
- A module with `'use client'` exports **client references** to Server Components: constants or functions a Server Component calls must live in a plain module (this is why `SECTIONS` moves to `src/lib/sections.ts`).
- Design (`DESIGN.md`): Fraunces only for `h1`/`h2` at 20px or more, Figtree otherwise; `tabular-nums` for dates, day counts and durations; honey (`accent`) only for "waiting for the director's decision" (not used in this change); errors always icon + text; `rounded-2xl` panels and sheets, `rounded-xl` cards, `rounded-lg` buttons and inputs; cards use `shadow-clay`; 150–200ms transitions; no sidebar.
- Dates shown and typed as `dd/mm/aaaa`; "today" is `todayInMadrid()`. Durations typed as `H:MM`, stored as integer minutes, shown as `3 h 45 min` (signed for the surplus: `+12 h`, `−9 h 15 min` with U+2212).
- GDPR: a person stores only full name, House (null for a shared post), post key, seat, optional start date, active flag, timestamps. Seeds use **fictional** people only. No delete button.
- Database bounds (DB CHECK and zod agree): `seat` 1..2, `year` 2000..2100, `vacation_days` and `carried_days` 0..99, `surplus_minutes` −60000..60000, `full_name` not blank.
- The Supabase **dev** database is reset only by the product owner (design D10). Agents verify migrations on a **throwaway local Postgres** (see "Local Postgres" below), never on Supabase.

## Review Focus

1. **Night and shared-post alternation across a 53-week year.** 2026 has 53 ISO weeks, so "alternate by ISO week number" would put the same night seat on duty in ISO week 53 of 2026 and ISO week 1 of 2027. A person expects strict alternation every week. → The plan anchors alternation to a fixed Monday (`weekIndex`) and Task 1 tests `2026-12-28` vs `2027-01-04`.
2. **Two writes racing for the same vacant seat.** The pre-check passes for both; the partial unique index rejects the second. The director expects the Catalan "seat taken by X" message, not a 500. → Task 4 tests the `P2002` path (Prisma 7 + pg adapter raise `PrismaClientKnownRequestError` with code `P2002` for these partial indexes; verified in planning).
3. **Tampered form posts** (person of the other House, shared seat from either House, seat `paulo-freire:er:2`, a non-UUID person id). The director expects nothing to change. → Task 9 tests each through the Server Functions; Task 8 tests `getPersonDetails` with a non-UUID and an other-House id.
4. **Duration and date typing.** `9:75`, letters, `0:00` with "−" (must store `0`, not `-0`), `5530` typed without a colon (must become `55:30`, not get stuck at `5:53`), `31/02/2026`. → Tasks 2, 7 and 10 test these.
5. **Inactive people and stale post keys.** An inactive person keeps their last seat while someone else takes it (seed does exactly this); an active person whose `post_key` no longer exists in code must still be visible so the director can move them. → Task 8 tests "former" and "unplaced" in the team view; Task 5 seeds inactive people on occupied seats.

## Local Postgres (agents, cloud container)

Postgres 16 binaries exist at `/usr/lib/postgresql/16/bin`. `initdb` refuses root, so the cluster belongs to the `postgres` user and lives outside the session scratchpad (which `postgres` cannot read):

```bash
export PGLOCAL=/var/tmp/casa-pg
mkdir -p $PGLOCAL && chown postgres:postgres $PGLOCAL
[ -d $PGLOCAL/data ] || runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb -D $PGLOCAL/data -U postgres --auth=trust -E UTF8
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D $PGLOCAL/data -o "-p 54329 -k $PGLOCAL -c listen_addresses=localhost" -l $PGLOCAL/log start
psql -h localhost -p 54329 -U postgres -c 'DROP DATABASE IF EXISTS casa' -c 'CREATE DATABASE casa'
export DIRECT_URL=postgresql://postgres@localhost:54329/casa DATABASE_URL=postgresql://postgres@localhost:54329/casa
```

`prisma.config.ts` loads `.env.local` with dotenv, which never overrides variables already set, so the exports win. Stop it at the end with `runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D $PGLOCAL/data stop`. On a developer machine use any disposable Postgres instead.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/dates.ts` (modify) | + `Weekday`, `weekdayOf`, `daysBetween`, `weekIndex`; + `parseDateDdMmYyyy`, `formatDateDdMmYyyy`, `maskDate` |
| `src/lib/posts.ts` (create) | Role labels, House posts, shared posts, weekly schedules, seat refs, schedule summary, night and shared-post alternation |
| `src/lib/rules.ts` (create) | AP and vacation constants, default opening balances |
| `src/lib/duration.ts` (create) | `H:MM` parse, mask, format |
| `src/lib/sections.ts` (create) | House sections and their availability |
| `src/lib/team.ts` (create) | `PersonRecord`, team view builder, vacant seats, seat and person labels |
| `src/lib/people-schemas.ts` (create) | zod schemas shared by forms and Server Functions |
| `src/lib/action-result.ts` (create) | `ActionResult` type |
| `prisma/schema.prisma` (rewrite) | `House`, `Person`, `PersonYear` |
| `prisma/migrations/<ts>_init/` (create; delete `20261005092628_house_context/`) | One initial migration with hand-written partial indexes and CHECKs |
| `src/lib/houses-migration.test.ts` (rewrite) | Keeps the migration and `HOUSES` in sync |
| `src/server/people-store.ts` (create) | Prisma writes and reads, seat checks, `SeatTakenError` |
| `prisma/seed.ts` (rewrite) | Fictional people through the store |
| `src/server/people.ts` (create) | Director-gated reads for the Equip page |
| `src/server/houses.ts` (modify) | Only `getHouseBySlug` remains |
| `src/app/(app)/[house]/team/actions.ts` (create) | Server Functions |
| `src/app/(app)/[house]/page.tsx` (rewrite) | Redirect to the first available section |
| `src/app/(app)/[house]/team/page.tsx` (rewrite) | Equip page |
| `src/components/section-nav.tsx` (modify) | Sections with "aviat" |
| `src/components/ui/input.tsx`, `src/components/field.tsx`, `src/components/sheet.tsx`, `src/components/duration-input.tsx`, `src/components/date-input.tsx` (create) | Form and sheet primitives |
| `src/components/team/*.tsx` (create) | Team board, post card, add-person button, person sheet, forms |
| Deleted | `src/lib/house-membership.ts(+test)`, `src/server/membership-store.ts(+test)`, `src/components/team-list.tsx(+test)` |
| Docs | `docs/domain.md`, `AGENTS.md`, `README.md`, `openspec/config.yaml`, `docs/prototypes/director-feedback.md` |

Task to `tasks.md` mapping: T1 → 1.1, 1.2 · T2 → 1.3, 1.4 · T3 → 2.1, 2.2, 3.1 · T4 → 5.2 (store) · T5 → 2.3, 2.4 · T6 → 3.2, 4.1, 4.2 · T7 → 5.1 · T8 → 5.2 (reads) · T9 → 5.3 · T10 → 6.1 · T11 → 6.2 · T12 → 6.3 · T13 → 6.4 · T14 → 6.5 · T15 → 7.1, 7.2, 7.3. Tick the `tasks.md` boxes as each plan task is committed.

---

### Task 1: Posts, schedules and week alternation

**Files:**
- Modify: `src/lib/dates.ts`, `src/lib/dates.test.ts`
- Create: `src/lib/posts.ts`, `src/lib/posts.test.ts`

**Interfaces:**
- Consumes: `IsoDate`, `isoDateToDate`, `addDays` (`src/lib/dates.ts`); `HOUSES`, `HouseSlug`, `isHouseSlug` (`src/lib/houses.ts`).
- Produces (dates): `type Weekday = 0|1|2|3|4|5|6` (Monday 0), `weekdayOf(date: IsoDate): Weekday`, `daysBetween(from: IsoDate, to: IsoDate): number`, `weekIndex(date: IsoDate): number`.
- Produces (posts): `ROLE_LABELS`, `type RoleCode`, `type TimeRange = { from: string; to: string }`, `type WeeklySchedule`, `type HolidayRule = 'off' | 'weekend' | 'as-usual'`, `type Post = { key; roleCode; seats: 1 | 2; schedule: WeeklySchedule | null; onHolidays: HolidayRule }`, `postsOf(house: HouseSlug): readonly Post[]`, `sharedPosts(): readonly Post[]`, `findPost(house: HouseSlug | null, postKey: string): Post | undefined`, `type SeatRef = { house: HouseSlug | null; postKey: string; seat: number }`, `isValidSeat(ref: SeatRef): boolean`, `encodeSeatRef(ref: SeatRef): string`, `decodeSeatRef(value: string): SeatRef | null`, `allSeats(): SeatRef[]`, `NO_FIXED_SCHEDULE`, `scheduleSummary(schedule: WeeklySchedule | null): string`, `rangesOn(post: Post, date: IsoDate, holiday?: boolean): readonly TimeRange[]`, `nightSeatOnDuty(date: IsoDate): 1 | 2`, `sharedPostHouseOn(date: IsoDate): HouseSlug | null`, `sharedWeekSplit(date: IsoDate): { days: string; house: HouseSlug }[]`.

- [x] **Step 1: Write the failing date tests**

Add `daysBetween, weekIndex, weekdayOf` to the import in `src/lib/dates.test.ts` and append:

```ts
describe('weekdayOf', () => {
  it('counts Monday as 0 and Sunday as 6', () => {
    expect(weekdayOf('2026-10-12')).toBe(0);
    expect(weekdayOf('2026-10-13')).toBe(1);
    expect(weekdayOf('2026-10-18')).toBe(6);
  });
});

describe('daysBetween', () => {
  it('counts calendar days, negative backwards', () => {
    expect(daysBetween('2026-07-01', '2027-01-01')).toBe(184);
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });
});

describe('weekIndex', () => {
  it('is the same from Monday to Sunday and grows by one each week', () => {
    expect(weekIndex('2026-10-12')).toBe(weekIndex('2026-10-18'));
    expect(weekIndex('2026-10-19')).toBe(weekIndex('2026-10-12') + 1);
  });

  it('keeps counting across a 53-week ISO year', () => {
    // 2026-12-28 is ISO week 53 and 2027-01-04 ISO week 1: both odd, yet consecutive.
    expect(weekIndex('2027-01-04') - weekIndex('2026-12-28')).toBe(1);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL, `weekdayOf is not a function` (or a TS import error).

- [x] **Step 3: Implement the date helpers**

Append to `src/lib/dates.ts`:

```ts
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
```

- [x] **Step 4: Run the date tests**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS.

- [x] **Step 5: Write the failing posts tests**

Create `src/lib/posts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HOUSES } from './houses';
import {
  NO_FIXED_SCHEDULE,
  ROLE_LABELS,
  allSeats,
  decodeSeatRef,
  encodeSeatRef,
  findPost,
  isValidSeat,
  nightSeatOnDuty,
  postsOf,
  rangesOn,
  scheduleSummary,
  sharedPostHouseOn,
  sharedPosts,
  sharedWeekSplit,
} from './posts';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

describe('House posts', () => {
  it.each(HOUSES.map((h) => h.slug))('%s has ER, TFM, TFT, ET, ECS, EN and CT in this order', (slug) => {
    const posts = postsOf(slug);
    expect(posts.map((p) => p.roleCode)).toEqual(['ER', 'TFM', 'TFT', 'ET', 'ECS', 'EN', 'CT']);
    expect(new Set(posts.map((p) => p.key)).size).toBe(posts.length);
  });

  it('gives two seats only to the night post', () => {
    const multi = postsOf('paulo-freire').filter((p) => p.seats > 1);
    expect(multi.map((p) => [p.key, p.seats])).toEqual([['en', 2]]);
  });

  it('never exceeds the seat CHECK of the database (1..2)', () => {
    for (const post of [...sharedPosts(), ...postsOf('paulo-freire'), ...postsOf('carme-aymerich')]) {
      expect(post.seats).toBeGreaterThanOrEqual(1);
      expect(post.seats).toBeLessThanOrEqual(2);
    }
  });
});

describe('shared posts', () => {
  it('are the Pedagoga and the Psicòloga, one seat each', () => {
    expect(sharedPosts().map((p) => [p.key, p.roleCode, p.seats])).toEqual([
      ['pdg', 'PDG', 1],
      ['psi', 'PSI', 1],
    ]);
  });

  it('belong to no House', () => {
    expect(findPost(null, 'pdg')?.roleCode).toBe('PDG');
    expect(findPost('paulo-freire', 'pdg')).toBeUndefined();
    expect(findPost(null, 'er')).toBeUndefined();
  });
});

describe('role labels', () => {
  it('uses the director’s words', () => {
    expect(ROLE_LABELS.ET).toBe('Educadora de tardes');
    expect(ROLE_LABELS.CT).toBe('Corretorn');
    expect(ROLE_LABELS.PSI).toBe('Psicòloga');
  });
});

describe('schedules', () => {
  const all = [...sharedPosts(), ...postsOf('paulo-freire')];

  it('has seven days of valid HH:MM ranges for every post with a schedule', () => {
    for (const post of all.filter((p) => p.schedule)) {
      expect(post.schedule).toHaveLength(7);
      for (const day of post.schedule!) {
        for (const range of day) {
          expect(range.from).toMatch(HHMM);
          expect(range.to).toMatch(HHMM);
          expect(range.from).not.toBe(range.to);
        }
      }
    }
  });

  it('gives the CT no fixed schedule', () => {
    expect(findPost('paulo-freire', 'ct')?.schedule).toBeNull();
    expect(scheduleSummary(null)).toBe(NO_FIXED_SCHEDULE);
    expect(NO_FIXED_SCHEDULE).toBe('Sense horari fix');
  });

  it('summarises each post compactly', () => {
    const summary = (key: string) => scheduleSummary(findPost('paulo-freire', key)!.schedule);
    expect(summary('tfm')).toBe('dl–dv 07:30–15:00');
    expect(summary('er')).toBe('dl i dc 09:00–17:00 · dt i dj 13:00–21:00 · dv 08:00–15:00');
    expect(summary('ecs')).toBe('ds–dg 10:30–22:15');
    expect(summary('en')).toBe('dl–dj i dg 22:00–08:00 · dv–ds 22:00–10:30');
    expect(scheduleSummary(findPost(null, 'psi')!.schedule)).toBe('dl, dc i dv 09:00–15:00 · dt i dj 14:00–20:00');
  });
});

describe('rangesOn', () => {
  const post = (key: string) => findPost('paulo-freire', key)!;

  it('returns the weekday ranges on a normal day', () => {
    expect(rangesOn(post('tfm'), '2026-10-12')).toEqual([{ from: '07:30', to: '15:00' }]);
    expect(rangesOn(post('tfm'), '2026-10-17')).toEqual([]);
  });

  it('rests weekday posts on public holidays', () => {
    expect(rangesOn(post('tfm'), '2026-10-12', true)).toEqual([]);
    expect(rangesOn(findPost(null, 'pdg')!, '2026-10-12', true)).toEqual([]);
  });

  it('puts the ECS on a weekday holiday and keeps the night as usual', () => {
    expect(rangesOn(post('ecs'), '2026-10-12', true)).toEqual([{ from: '10:30', to: '22:15' }]);
    expect(rangesOn(post('en'), '2026-10-12', true)).toEqual(rangesOn(post('en'), '2026-10-12'));
  });

  it('never gives the CT ranges', () => {
    expect(rangesOn(post('ct'), '2026-10-12')).toEqual([]);
  });
});

describe('night alternation', () => {
  it('keeps one seat all week and switches the next week', () => {
    expect(nightSeatOnDuty('2026-10-12')).toBe(nightSeatOnDuty('2026-10-18'));
    expect(nightSeatOnDuty('2026-10-19')).not.toBe(nightSeatOnDuty('2026-10-12'));
  });

  it('alternates across the 53-week year 2026', () => {
    expect(nightSeatOnDuty('2027-01-04')).not.toBe(nightSeatOnDuty('2026-12-28'));
  });
});

describe('shared posts by weekday', () => {
  it('works Monday to Wednesday in one House and Thursday and Friday in the other', () => {
    expect(sharedPostHouseOn('2026-10-12')).toBe(sharedPostHouseOn('2026-10-14'));
    expect(sharedPostHouseOn('2026-10-15')).not.toBe(sharedPostHouseOn('2026-10-12'));
    expect(sharedPostHouseOn('2026-10-17')).toBeNull();
  });

  it('swaps the Houses every week', () => {
    expect(sharedPostHouseOn('2026-10-19')).not.toBe(sharedPostHouseOn('2026-10-12'));
    expect(sharedWeekSplit('2026-10-14')).toEqual([
      { days: 'dl–dc', house: sharedPostHouseOn('2026-10-12') },
      { days: 'dj–dv', house: sharedPostHouseOn('2026-10-15') },
    ]);
  });
});

describe('seat refs', () => {
  it('validates House and shared seats', () => {
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'en', seat: 2 })).toBe(true);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'en', seat: 3 })).toBe(false);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'er', seat: 2 })).toBe(false);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'er', seat: 1.5 })).toBe(false);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'xx', seat: 1 })).toBe(false);
    expect(isValidSeat({ house: null, postKey: 'pdg', seat: 1 })).toBe(true);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'pdg', seat: 1 })).toBe(false);
    expect(isValidSeat({ house: null, postKey: 'er', seat: 1 })).toBe(false);
  });

  it('round-trips through a form string', () => {
    for (const ref of allSeats()) expect(decodeSeatRef(encodeSeatRef(ref))).toEqual(ref);
    expect(encodeSeatRef({ house: null, postKey: 'pdg', seat: 1 })).toBe('shared:pdg:1');
  });

  it('rejects tampered strings', () => {
    for (const value of ['shared:er:1', 'x:er:1', 'paulo-freire:er', 'paulo-freire:er:1:x', 'paulo-freire:er:2', 'paulo-freire:er:01', '']) {
      expect(decodeSeatRef(value)).toBeNull();
    }
  });

  it('lists every seat: 2 shared plus 8 per House', () => {
    expect(allSeats()).toHaveLength(18);
  });
});
```

- [x] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/lib/posts.test.ts`
Expected: FAIL, cannot resolve `./posts`.

- [x] **Step 7: Implement `src/lib/posts.ts`**

```ts
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
```

- [x] **Step 8: Run the tests**

Run: `npx vitest run src/lib/posts.test.ts src/lib/dates.test.ts && npm run typecheck`
Expected: PASS, no type errors (the old membership code is untouched until Task 3).

- [x] **Step 9: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/posts.ts src/lib/posts.test.ts
git commit -m "feat(posts): define House and shared posts with weekly schedules"
```

---

### Task 2: Rules, durations and dd/mm/aaaa dates

**Files:**
- Create: `src/lib/rules.ts`, `src/lib/rules.test.ts`, `src/lib/duration.ts`, `src/lib/duration.test.ts`
- Modify: `src/lib/dates.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: `IsoDate`, `isIsoDate`, `daysBetween` (dates).
- Produces: `AP_RULES`, `VACATION_RULES`, `type OpeningBalances = { vacationDays: number; carriedDays: number; surplusMinutes: number }`, `defaultVacationDays(year: number, startedOn: IsoDate | null): number`, `defaultOpeningBalances(year: number, startedOn: IsoDate | null): OpeningBalances`; `parseDuration(text: string): number | null`, `toDurationText(minutes: number): string`, `formatDuration(minutes: number, options?: { signed?: boolean }): string`, `maskDuration(raw: string): string`; `parseDateDdMmYyyy(text: string): IsoDate | null`, `formatDateDdMmYyyy(date: IsoDate): string`, `maskDate(raw: string): string`.

- [x] **Step 1: Write the failing tests**

Create `src/lib/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AP_RULES, VACATION_RULES, defaultOpeningBalances, defaultVacationDays } from './rules';

describe('rules', () => {
  it('holds the AP and vacation constants', () => {
    expect(AP_RULES.nonRecoverable).toEqual({ minutes: 24 * 60, maxDays: 5 });
    expect(AP_RULES.recoverable).toEqual({ minutes: 24 * 60, maxDays: 3 });
    expect(VACATION_RULES).toEqual({ daysPerYear: 31, minPeriodDays: 7, maxPeriods: 4 });
  });
});

describe('defaultVacationDays', () => {
  it('gives 31 days for a full year', () => {
    expect(defaultVacationDays(2026, null)).toBe(31);
    expect(defaultVacationDays(2026, '2020-03-01')).toBe(31);
    expect(defaultVacationDays(2026, '2026-01-01')).toBe(31);
  });

  it('prorates by the start date and rounds to whole days', () => {
    expect(defaultVacationDays(2026, '2026-07-01')).toBe(16);
    expect(defaultVacationDays(2028, '2028-07-01')).toBe(16); // leap year: 31 × 184 / 366
    expect(defaultVacationDays(2026, '2026-12-31')).toBe(0);
  });

  it('gives 0 when the person starts after the year', () => {
    expect(defaultVacationDays(2026, '2027-02-01')).toBe(0);
  });
});

describe('defaultOpeningBalances', () => {
  it('has no AA days and no surplus', () => {
    expect(defaultOpeningBalances(2026, '2026-07-01')).toEqual({ vacationDays: 16, carriedDays: 0, surplusMinutes: 0 });
  });
});
```

Create `src/lib/duration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDuration, maskDuration, parseDuration, toDurationText } from './duration';

describe('parseDuration', () => {
  it('reads H:MM as minutes, hours beyond 24 allowed', () => {
    expect(parseDuration('3:45')).toBe(225);
    expect(parseDuration('0:30')).toBe(30);
    expect(parseDuration('55:30')).toBe(3330);
    expect(parseDuration(' 12:00 ')).toBe(720);
  });

  it('rejects anything else', () => {
    for (const text of ['9:75', 'abc', '', '3', '3:5', '3,75', '-1:00', '1000:00']) expect(parseDuration(text)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('writes hours and minutes', () => {
    expect(formatDuration(225)).toBe('3 h 45 min');
    expect(formatDuration(180)).toBe('3 h');
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(0)).toBe('0 h');
  });

  it('signs a surplus with + or the minus sign', () => {
    expect(formatDuration(720, { signed: true })).toBe('+12 h');
    expect(formatDuration(-555, { signed: true })).toBe('−9 h 15 min');
    expect(formatDuration(0, { signed: true })).toBe('+0 h');
  });
});

describe('toDurationText', () => {
  it('fills an input, without the sign', () => {
    expect(toDurationText(-555)).toBe('9:15');
    expect(toDurationText(0)).toBe('0:00');
    expect(toDurationText(3330)).toBe('55:30');
  });
});

describe('maskDuration', () => {
  it('inserts the colon before the last two digits', () => {
    expect(maskDuration('9')).toBe('9');
    expect(maskDuration('94')).toBe('94');
    expect(maskDuration('945')).toBe('9:45');
    expect(maskDuration('5:530')).toBe('55:30');
    expect(maskDuration('99959')).toBe('999:59');
  });

  it('drops letters and extra digits', () => {
    expect(maskDuration('ab')).toBe('');
    expect(maskDuration('9a4b5')).toBe('9:45');
    expect(maskDuration('123456')).toBe('123:45');
  });
});
```

Add `formatDateDdMmYyyy, maskDate, parseDateDdMmYyyy` to the import in `src/lib/dates.test.ts` and append:

```ts
describe('dd/mm/aaaa', () => {
  it('parses real dates only', () => {
    expect(parseDateDdMmYyyy('01/07/2026')).toBe('2026-07-01');
    expect(parseDateDdMmYyyy(' 29/02/2028 ')).toBe('2028-02-29');
    for (const text of ['31/02/2026', '1/7/2026', '2026-07-01', '', 'abc']) expect(parseDateDdMmYyyy(text)).toBeNull();
  });

  it('formats an IsoDate', () => {
    expect(formatDateDdMmYyyy('2026-07-01')).toBe('01/07/2026');
  });

  it('masks typing into dd/mm/aaaa', () => {
    expect(maskDate('01')).toBe('01');
    expect(maskDate('010')).toBe('01/0');
    expect(maskDate('01072026')).toBe('01/07/2026');
    expect(maskDate('01/07/2026')).toBe('01/07/2026');
    expect(maskDate('01/07/20269')).toBe('01/07/2026');
    expect(maskDate('ab')).toBe('');
  });
});
```

- [x] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/rules.test.ts src/lib/duration.test.ts src/lib/dates.test.ts`
Expected: FAIL, unresolved modules and missing exports.

- [x] **Step 3: Implement**

Append to `src/lib/dates.ts`:

```ts
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
```

Create `src/lib/duration.ts`:

```ts
// Durations are integer minutes. The UI reads and writes one standard format,
// `H:MM` (hours may exceed 24), and shows `3 h 45 min` (design D7).
const DURATION = /^(\d{1,3}):([0-5]\d)$/;
const MINUS = '−';

export function parseDuration(text: string): number | null {
  const match = DURATION.exec(text.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes as `H:MM` for an input, without the sign: 555 becomes `9:15`. */
export function toDurationText(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** `3 h 45 min`, `3 h`, `45 min`; with `signed`, `+12 h` or `−9 h 15 min`. */
export function formatDuration(minutes: number, { signed = false }: { signed?: boolean } = {}): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const body = hours && rest ? `${hours} h ${rest} min` : rest ? `${rest} min` : `${hours} h`;
  if (minutes < 0) return `${MINUS}${body}`;
  return signed ? `+${body}` : body;
}

/** Rebuilds the field from its digits while typing: the colon goes before the last two (`945` is `9:45`). */
export function maskDuration(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 5);
  return digits.length >= 3 ? `${digits.slice(0, -2)}:${digits.slice(-2)}` : digits;
}
```

Create `src/lib/rules.ts`:

```ts
// AP and vacation rules (docs/domain.md §4 and §7). Changing a rule is a code change.
import { daysBetween, type IsoDate } from './dates';

export const AP_RULES = {
  /** AP no recuperable: just consumes the allowance. */
  nonRecoverable: { minutes: 24 * 60, maxDays: 5 },
  /** AP recuperable: deducted from the calendar surplus. */
  recoverable: { minutes: 24 * 60, maxDays: 3 },
} as const;

export const VACATION_RULES = { daysPerYear: 31, minPeriodDays: 7, maxPeriods: 4 } as const;

/** Per person and year (design D6). The surplus may be negative. */
export type OpeningBalances = { vacationDays: number; carriedDays: number; surplusMinutes: number };

/**
 * 31 days, or prorated when the person started during `year`:
 * round(31 × days from the start to 31/12 / days in the year), 16 for 1 July.
 */
export function defaultVacationDays(year: number, startedOn: IsoDate | null): number {
  const first = `${year}-01-01`;
  const next = `${year + 1}-01-01`;
  if (!startedOn || startedOn <= first) return VACATION_RULES.daysPerYear;
  if (startedOn >= next) return 0;
  return Math.round((VACATION_RULES.daysPerYear * daysBetween(startedOn, next)) / daysBetween(first, next));
}

export function defaultOpeningBalances(year: number, startedOn: IsoDate | null): OpeningBalances {
  return { vacationDays: defaultVacationDays(year, startedOn), carriedDays: 0, surplusMinutes: 0 };
}
```

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/lib/rules.test.ts src/lib/duration.test.ts src/lib/dates.test.ts && npm run typecheck`
Expected: PASS. (`2026-12-31`: 31 × 1 / 365 rounds to 0, as the test says.)

- [x] **Step 5: Commit**

```bash
git add src/lib/rules.ts src/lib/rules.test.ts src/lib/duration.ts src/lib/duration.test.ts src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat(rules): add AP and vacation rules, durations and dd/mm/aaaa dates"
```

---

### Task 3: Replace the data model and remove dated membership

**Files:**
- Rewrite: `prisma/schema.prisma`, `src/lib/houses-migration.test.ts`, `src/server/houses.ts`, `src/server/houses.test.ts`, `src/app/(app)/[house]/team/page.tsx` (interim)
- Create: `prisma/migrations/<timestamp>_init/migration.sql`
- Delete: `prisma/migrations/20261005092628_house_context/`, `prisma/seed.ts` (recreated in Task 5), `src/lib/house-membership.ts`, `src/lib/house-membership.test.ts`, `src/server/membership-store.ts`, `src/server/membership-store.test.ts`, `src/components/team-list.tsx`, `src/components/team-list.test.tsx`

**Interfaces:**
- Produces: Prisma models `House { id, slug, name, people }`, `Person { id, fullName, houseId?, postKey, seat, startedOn?, active, createdAt, updatedAt, house?, years }`, `PersonYear { id, personId, year, vacationDays, carriedDays, surplusMinutes, person }` with compound unique `personId_year`. Tables `houses`, `people`, `person_years`. Indexes `people_active_house_seat_key`, `people_active_shared_seat_key`.
- `src/server/houses.ts` keeps only `getHouseBySlug(slug: string)`.

- [x] **Step 1: Rewrite the migration test (failing)**

Replace `src/lib/houses-migration.test.ts`:

```ts
// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOUSES } from './houses';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function initMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_init'));
  if (!folder) throw new Error('init migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('init migration', () => {
  const sql = initMigration();

  it('inserts exactly the Houses listed in HOUSES', () => {
    const inserted = [...sql.matchAll(/\('([a-z-]+)', '([^']+)'\)/g)].map(([, slug, name]) => ({ slug, name }));
    expect(inserted).toEqual(HOUSES.map(({ slug, name }) => ({ slug, name })));
  });

  it('keeps one active person per seat, for House and shared posts', () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "people_active_house_seat_key" ON "people" ("house_id", "post_key", "seat") WHERE "active" AND "house_id" IS NOT NULL;',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "people_active_shared_seat_key" ON "people" ("post_key", "seat") WHERE "active" AND "house_id" IS NULL;',
    );
  });

  it('keeps the hand-written CHECKs', () => {
    for (const name of [
      'people_full_name_check',
      'people_seat_check',
      'person_years_year_check',
      'person_years_vacation_days_check',
      'person_years_carried_days_check',
      'person_years_surplus_minutes_check',
    ]) {
      expect(sql).toContain(`"${name}"`);
    }
  });
});
```

Run: `npx vitest run src/lib/houses-migration.test.ts`
Expected: FAIL, `init migration not found`.

- [x] **Step 2: Rewrite `prisma/schema.prisma`**

```prisma
// Prisma schema. The connection URL is configured in `prisma.config.ts`
// (Prisma 7 reads it there for CLI commands); the runtime client passes the
// pooled URL explicitly in `src/lib/prisma.ts`.

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ── Data model ───────────────────────────────────────────────────────────────

/// One of the two Cases d'Infants. Rows are inserted by the init migration;
/// keep them in sync with HOUSES in src/lib/houses.ts.
model House {
  id     String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug   String   @unique
  name   String
  people Person[]

  @@map("houses")
}

/// Who covers one seat of one post (design D4). Minimal on purpose (GDPR).
/// houseId is null for the posts shared by both Houses (PDG, PSI). postKey and
/// seat are checked by the app against src/lib/posts.ts. The init migration
/// adds what Prisma cannot express: two partial unique indexes (one active
/// person per seat, for House posts and for shared posts) and CHECKs.
model Person {
  id        String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  fullName  String       @map("full_name")
  houseId   String?      @map("house_id") @db.Uuid
  postKey   String       @map("post_key")
  seat      Int          @default(1)
  startedOn DateTime?    @map("started_on") @db.Date
  active    Boolean      @default(true)
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")
  house     House?       @relation(fields: [houseId], references: [id], onDelete: Restrict)
  years     PersonYear[]

  @@index([houseId])
  @@map("people")
}

/// Opening balances of a person for one calendar year (design D6). They belong
/// to the person, never to a House.
model PersonYear {
  id             String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  personId       String @map("person_id") @db.Uuid
  year           Int
  vacationDays   Int    @map("vacation_days")
  carriedDays    Int    @map("carried_days")
  surplusMinutes Int    @map("surplus_minutes")
  person         Person @relation(fields: [personId], references: [id], onDelete: Cascade)

  @@unique([personId, year])
  @@map("person_years")
}
```

- [x] **Step 3: Delete the membership code, the old migration and the old seed**

```bash
git rm -r prisma/migrations/20261005092628_house_context prisma/seed.ts \
  src/lib/house-membership.ts src/lib/house-membership.test.ts \
  src/server/membership-store.ts src/server/membership-store.test.ts \
  src/components/team-list.tsx src/components/team-list.test.tsx
```

Replace `src/server/houses.ts`:

```ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Every function checks the director itself: pages and layouts render in
// parallel, so a check in a parent layout does not protect these queries.

export async function getHouseBySlug(slug: string) {
  await requireDirector();
  return prisma.house.findUnique({ where: { slug } });
}
```

Replace `src/server/houses.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getHouseBySlug } from './houses';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { house: { findUnique: vi.fn() } } }));

beforeEach(() => vi.clearAllMocks());

describe('getHouseBySlug', () => {
  it('stops before any query for a non-director', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(getHouseBySlug('paulo-freire')).rejects.toThrow('NEXT_REDIRECT');
    expect(prisma.house.findUnique).not.toHaveBeenCalled();
  });

  it('looks a House up by slug for the director', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    vi.mocked(prisma.house.findUnique).mockResolvedValue({ id: 'pf', slug: 'paulo-freire', name: 'Paulo Freire' } as never);
    await expect(getHouseBySlug('paulo-freire')).resolves.toEqual({ id: 'pf', slug: 'paulo-freire', name: 'Paulo Freire' });
    expect(prisma.house.findUnique).toHaveBeenCalledWith({ where: { slug: 'paulo-freire' } });
  });
});
```

Interim `src/app/(app)/[house]/team/page.tsx` (rebuilt in Task 11):

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

export default async function TeamPage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
    </main>
  );
}
```

- [x] **Step 4: Generate the init migration against the local Postgres**

Start the local Postgres (see "Local Postgres"), then:

```bash
npx prisma migrate dev --create-only --name init
```

Expected: `prisma/migrations/<timestamp>_init/migration.sql` with `CREATE TABLE "houses"`, `"people"`, `"person_years"`, the `houses_slug_key`, `people_house_id_idx` and `person_years_person_id_year_key` indexes and the two foreign keys.

- [x] **Step 5: Append the hand-written SQL to that migration**

Append to the end of the generated `migration.sql`:

```sql
-- Hand-written: Prisma cannot express these. Do not remove.

-- One active person per seat (design D4): per House for the House posts...
CREATE UNIQUE INDEX "people_active_house_seat_key" ON "people" ("house_id", "post_key", "seat") WHERE "active" AND "house_id" IS NOT NULL;
-- ...and per seat for the shared posts, whose people have no House.
CREATE UNIQUE INDEX "people_active_shared_seat_key" ON "people" ("post_key", "seat") WHERE "active" AND "house_id" IS NULL;

ALTER TABLE "people" ADD CONSTRAINT "people_full_name_check" CHECK (btrim("full_name") <> '');
ALTER TABLE "people" ADD CONSTRAINT "people_seat_check" CHECK ("seat" BETWEEN 1 AND 2);

ALTER TABLE "person_years" ADD CONSTRAINT "person_years_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_vacation_days_check" CHECK ("vacation_days" BETWEEN 0 AND 99);
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_carried_days_check" CHECK ("carried_days" BETWEEN 0 AND 99);
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_surplus_minutes_check" CHECK ("surplus_minutes" BETWEEN -60000 AND 60000);

-- The two Houses. Keep in sync with HOUSES in src/lib/houses.ts.
INSERT INTO "houses" ("slug", "name") VALUES
  ('paulo-freire', 'Paulo Freire'),
  ('carme-aymerich', 'Carme Aymerich');
```

- [x] **Step 6: Apply it to a fresh database and check Prisma sees no drift**

```bash
psql -h localhost -p 54329 -U postgres -c 'DROP DATABASE casa' -c 'CREATE DATABASE casa'
npx prisma migrate deploy
npx prisma migrate dev --create-only --name drift_check
cat prisma/migrations/*_drift_check/migration.sql
rm -r prisma/migrations/*_drift_check
```

Expected: deploy applies `..._init`; `drift_check` contains only `-- This is an empty migration.` (Prisma ignores the partial indexes and CHECKs, as verified while planning). If it is not empty, fix the schema until it is.

- [x] **Step 7: Regenerate the client and run everything**

Run: `npm run db:generate && npm run typecheck && npm test`
Expected: PASS, and `git grep -nE "Employee|HouseMembership|house-membership|membership-store|TeamList" -- src prisma` prints nothing.

- [x] **Step 8: Commit**

```bash
git add -A prisma src
git commit -m "feat(db)!: replace dated membership with people and opening balances"
```

---

### Task 4: People store

**Files:**
- Create: `src/lib/team.ts` (types only in this task), `src/server/people-store.ts`, `src/server/people-store.test.ts`

**Interfaces:**
- Consumes: `SeatRef`, `isValidSeat` (posts); `OpeningBalances` (rules); `IsoDate`, `isoDateToDate`, `dateToIsoDate` (dates); `HouseSlug`, `isHouseSlug` (houses); Prisma `PrismaClient`, `Prisma`.
- Produces in `src/lib/team.ts`: `type PersonRecord = { id: string; fullName: string; house: HouseSlug | null; postKey: string; seat: number; startedOn: IsoDate | null; active: boolean }`.
- Produces in `src/server/people-store.ts`: `class SeatTakenError extends Error { occupant: string | null }`, `class InvalidSeatError extends Error`, `listPeopleOf(db, house: HouseSlug): Promise<PersonRecord[]>`, `listActivePeople(db): Promise<PersonRecord[]>`, `findPerson(db, id: string): Promise<PersonRecord | null>`, `addPerson(db, input: { fullName: string; startedOn: IsoDate | null; seat: SeatRef }): Promise<string>` (new id), `renamePerson(db, id: string, fullName: string): Promise<void>`, `placePerson(db, id: string, seat: SeatRef): Promise<void>` (move or reactivate: sets the seat and `active = true`), `deactivatePerson(db, id: string): Promise<void>`, `findOpeningBalances(db, personId: string, year: number): Promise<OpeningBalances | null>`, `saveOpeningBalances(db, personId: string, year: number, balances: OpeningBalances): Promise<void>`. `db` is `PrismaClient`.

- [x] **Step 1: Write the failing store tests**

Create `src/server/people-store.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import {
  InvalidSeatError,
  SeatTakenError,
  addPerson,
  deactivatePerson,
  listPeopleOf,
  placePerson,
  saveOpeningBalances,
} from './people-store';

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';

function fakeDb(occupants: (string | null)[] = [null]) {
  const findFirst = vi.fn();
  for (const name of occupants) findFirst.mockResolvedValueOnce(name ? { fullName: name } : null);
  findFirst.mockResolvedValue(null);
  return {
    house: { findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => ({ id: `id-${where.slug}` })) },
    person: {
      findFirst,
      create: vi.fn(async () => ({ id: ID })),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    personYear: { upsert: vi.fn(async () => ({})), findUnique: vi.fn(async () => null) },
  };
}
const asDb = (db: ReturnType<typeof fakeDb>) => db as unknown as PrismaClient;
const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('addPerson', () => {
  it('adds a person to a vacant House seat', async () => {
    const db = fakeDb();
    await expect(
      addPerson(asDb(db), { fullName: 'Carla Ribas Solé', startedOn: '2025-09-01', seat: { house: 'paulo-freire', postKey: 'er', seat: 1 } }),
    ).resolves.toBe(ID);
    expect(db.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true, houseId: 'id-paulo-freire', postKey: 'er', seat: 1 } }),
    );
    expect(db.person.create).toHaveBeenCalledWith({
      data: { fullName: 'Carla Ribas Solé', houseId: 'id-paulo-freire', postKey: 'er', seat: 1, startedOn: new Date('2025-09-01T00:00:00Z'), active: true },
      select: { id: true },
    });
  });

  it('adds a person to a shared seat with no House', async () => {
    const db = fakeDb();
    await addPerson(asDb(db), { fullName: 'Meritxell Torres Vila', startedOn: null, seat: { house: null, postKey: 'pdg', seat: 1 } });
    expect(db.house.findUnique).not.toHaveBeenCalled();
    expect(db.person.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ houseId: null, startedOn: null }) }));
  });

  it('rejects an occupied seat naming the occupant', async () => {
    const db = fakeDb(['Carla Ribas Solé']);
    const error = await addPerson(asDb(db), { fullName: 'Nova', startedOn: null, seat: { house: 'paulo-freire', postKey: 'er', seat: 1 } }).catch((e) => e);
    expect(error).toBeInstanceOf(SeatTakenError);
    expect(error.occupant).toBe('Carla Ribas Solé');
    expect(db.person.create).not.toHaveBeenCalled();
  });

  it('turns a unique violation (two requests at once) into SeatTakenError', async () => {
    const db = fakeDb([null, 'Laia Vidal Mas']);
    db.person.create.mockRejectedValueOnce(uniqueViolation());
    const error = await addPerson(asDb(db), { fullName: 'Nova', startedOn: null, seat: { house: 'carme-aymerich', postKey: 'er', seat: 1 } }).catch((e) => e);
    expect(error).toBeInstanceOf(SeatTakenError);
    expect(error.occupant).toBe('Laia Vidal Mas');
  });

  it('rejects an unknown seat before any query', async () => {
    const db = fakeDb();
    await expect(
      addPerson(asDb(db), { fullName: 'Nova', startedOn: null, seat: { house: 'paulo-freire', postKey: 'er', seat: 2 } }),
    ).rejects.toBeInstanceOf(InvalidSeatError);
    expect(db.person.findFirst).not.toHaveBeenCalled();
  });
});

describe('placePerson', () => {
  it('moves or reactivates into a vacant seat, ignoring the person’s own row', async () => {
    const db = fakeDb();
    await placePerson(asDb(db), ID, { house: 'carme-aymerich', postKey: 'et', seat: 1 });
    expect(db.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true, houseId: 'id-carme-aymerich', postKey: 'et', seat: 1, NOT: { id: ID } } }),
    );
    expect(db.person.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { houseId: 'id-carme-aymerich', postKey: 'et', seat: 1, active: true },
    });
  });
});

describe('deactivatePerson', () => {
  it('keeps the last seat for reference', async () => {
    const db = fakeDb();
    await deactivatePerson(asDb(db), ID);
    expect(db.person.update).toHaveBeenCalledWith({ where: { id: ID }, data: { active: false } });
  });
});

describe('saveOpeningBalances', () => {
  it('creates or replaces the row of that year', async () => {
    const db = fakeDb();
    const balances = { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 };
    await saveOpeningBalances(asDb(db), ID, 2026, balances);
    expect(db.personYear.upsert).toHaveBeenCalledWith({
      where: { personId_year: { personId: ID, year: 2026 } },
      create: { personId: ID, year: 2026, ...balances },
      update: balances,
    });
  });
});

describe('listPeopleOf', () => {
  it('reads the House and the shared posts and maps rows to records', async () => {
    const db = fakeDb();
    db.person.findMany.mockResolvedValueOnce([
      { id: ID, fullName: 'Pol Jiménez Alcover', postKey: 'ct', seat: 1, startedOn: new Date('2025-09-01T00:00:00Z'), active: true, house: { slug: 'paulo-freire' } },
      { id: 'b', fullName: 'Meritxell Torres Vila', postKey: 'pdg', seat: 1, startedOn: null, active: true, house: null },
    ] as never);
    // Sorted by name (Catalan collation).
    await expect(listPeopleOf(asDb(db), 'paulo-freire')).resolves.toEqual([
      { id: 'b', fullName: 'Meritxell Torres Vila', house: null, postKey: 'pdg', seat: 1, startedOn: null, active: true },
      { id: ID, fullName: 'Pol Jiménez Alcover', house: 'paulo-freire', postKey: 'ct', seat: 1, startedOn: '2025-09-01', active: true },
    ]);
    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ house: { slug: 'paulo-freire' } }, { houseId: null }] } }),
    );
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/people-store.test.ts`
Expected: FAIL, cannot resolve `./people-store`.

- [x] **Step 3: Implement**

Create `src/lib/team.ts` (grows in Task 8):

```ts
// The people of the Equip page as plain data, shared by the server and the
// client components.
import type { IsoDate } from './dates';
import type { HouseSlug } from './houses';

export type PersonRecord = {
  id: string;
  fullName: string;
  /** null for a shared post (PDG, PSI). */
  house: HouseSlug | null;
  postKey: string;
  seat: number;
  startedOn: IsoDate | null;
  active: boolean;
};
```

Create `src/server/people-store.ts`:

```ts
// People persistence with the Prisma client passed in. No auth and no
// `server-only` here so the dev seed can use it; app code goes through
// src/server/people.ts and the Server Functions, which check the director first.
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { dateToIsoDate, isoDateToDate, type IsoDate } from '@/lib/dates';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import { isValidSeat, type SeatRef } from '@/lib/posts';
import type { OpeningBalances } from '@/lib/rules';
import type { PersonRecord } from '@/lib/team';

export class SeatTakenError extends Error {
  constructor(readonly occupant: string | null) {
    super(`Seat taken by ${occupant ?? 'someone else'}`);
    this.name = 'SeatTakenError';
  }
}

export class InvalidSeatError extends Error {
  constructor(ref: SeatRef) {
    super(`Unknown seat ${ref.house ?? 'shared'}:${ref.postKey}:${ref.seat}`);
    this.name = 'InvalidSeatError';
  }
}

const personSelect = {
  id: true,
  fullName: true,
  postKey: true,
  seat: true,
  startedOn: true,
  active: true,
  house: { select: { slug: true } },
} satisfies Prisma.PersonSelect;

type PersonRow = Prisma.PersonGetPayload<{ select: typeof personSelect }>;

function toRecord(row: PersonRow): PersonRecord {
  const slug = row.house?.slug ?? null;
  if (slug !== null && !isHouseSlug(slug)) throw new Error(`Unknown House ${slug}: keep HOUSES and the houses table in sync.`);
  return {
    id: row.id,
    fullName: row.fullName,
    house: slug,
    postKey: row.postKey,
    seat: row.seat,
    startedOn: row.startedOn ? dateToIsoDate(row.startedOn) : null,
    active: row.active,
  };
}

const byName = (a: PersonRecord, b: PersonRecord) => a.fullName.localeCompare(b.fullName, 'ca');

/** People of a House plus the people of the shared posts, active and inactive. */
export async function listPeopleOf(db: PrismaClient, house: HouseSlug): Promise<PersonRecord[]> {
  const rows = await db.person.findMany({ where: { OR: [{ house: { slug: house } }, { houseId: null }] }, select: personSelect });
  return rows.map(toRecord).sort(byName);
}

export async function listActivePeople(db: PrismaClient): Promise<PersonRecord[]> {
  const rows = await db.person.findMany({ where: { active: true }, select: personSelect });
  return rows.map(toRecord).sort(byName);
}

export async function findPerson(db: PrismaClient, id: string): Promise<PersonRecord | null> {
  const row = await db.person.findUnique({ where: { id }, select: personSelect });
  return row ? toRecord(row) : null;
}

async function houseIdOf(db: PrismaClient, house: HouseSlug | null): Promise<string | null> {
  if (!house) return null;
  const row = await db.house.findUnique({ where: { slug: house }, select: { id: true } });
  if (!row) throw new Error(`House ${house} is missing: run the migrations first.`);
  return row.id;
}

async function occupantOf(db: PrismaClient, houseId: string | null, ref: SeatRef, exceptId?: string): Promise<string | null> {
  const occupant = await db.person.findFirst({
    where: { active: true, houseId, postKey: ref.postKey, seat: ref.seat, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { fullName: true },
  });
  return occupant?.fullName ?? null;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Checks the seat is free, then writes. The partial unique indexes catch two
 * writes racing for the same seat; both paths end in SeatTakenError.
 */
async function writeToSeat<T>(db: PrismaClient, ref: SeatRef, exceptId: string | undefined, write: (houseId: string | null) => Promise<T>): Promise<T> {
  if (!isValidSeat(ref)) throw new InvalidSeatError(ref);
  const houseId = await houseIdOf(db, ref.house);
  const occupant = await occupantOf(db, houseId, ref, exceptId);
  if (occupant) throw new SeatTakenError(occupant);
  try {
    return await write(houseId);
  } catch (error) {
    if (isUniqueViolation(error)) throw new SeatTakenError(await occupantOf(db, houseId, ref, exceptId));
    throw error;
  }
}

export async function addPerson(
  db: PrismaClient,
  input: { fullName: string; startedOn: IsoDate | null; seat: SeatRef },
): Promise<string> {
  const { seat } = input;
  const created = await writeToSeat(db, seat, undefined, (houseId) =>
    db.person.create({
      data: {
        fullName: input.fullName,
        houseId,
        postKey: seat.postKey,
        seat: seat.seat,
        startedOn: input.startedOn ? isoDateToDate(input.startedOn) : null,
        active: true,
      },
      select: { id: true },
    }),
  );
  return created.id;
}

export async function renamePerson(db: PrismaClient, id: string, fullName: string): Promise<void> {
  await db.person.update({ where: { id }, data: { fullName } });
}

/** Moves an active person, or reactivates an inactive one, into a vacant seat. Balances stay with the person. */
export async function placePerson(db: PrismaClient, id: string, seat: SeatRef): Promise<void> {
  await writeToSeat(db, seat, id, (houseId) =>
    db.person.update({ where: { id }, data: { houseId, postKey: seat.postKey, seat: seat.seat, active: true } }),
  );
}

/** Frees the seat; the person keeps their data, balances and last seat for reference. */
export async function deactivatePerson(db: PrismaClient, id: string): Promise<void> {
  await db.person.update({ where: { id }, data: { active: false } });
}

export async function findOpeningBalances(db: PrismaClient, personId: string, year: number): Promise<OpeningBalances | null> {
  return db.personYear.findUnique({
    where: { personId_year: { personId, year } },
    select: { vacationDays: true, carriedDays: true, surplusMinutes: true },
  });
}

export async function saveOpeningBalances(db: PrismaClient, personId: string, year: number, balances: OpeningBalances): Promise<void> {
  await db.personYear.upsert({
    where: { personId_year: { personId, year } },
    create: { personId, year, ...balances },
    update: balances,
  });
}
```

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/server/people-store.test.ts && npm run typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/team.ts src/server/people-store.ts src/server/people-store.test.ts
git commit -m "feat(people): add the people store with seat checks"
```

---

### Task 5: Seed and database check

**Files:**
- Create: `prisma/seed.ts`, `openspec/changes/prototype-foundation/db-check.md`

**Interfaces:**
- Consumes: `addPerson`, `deactivatePerson`, `saveOpeningBalances` (Task 4), `OpeningBalances`, `HouseSlug`, `IsoDate`.

- [x] **Step 1: Write `prisma/seed.ts`**

```ts
// Dev seed with FICTIONAL people only (GDPR: never seed real staff). The names
// come from the list the product owner validated for SPEC-002; PDG and PSI are
// shared by both Houses. Writes through the people store, so every row passes
// the app's seat rules. Safe to re-run: it does nothing when people exist.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { IsoDate } from '../src/lib/dates';
import type { HouseSlug } from '../src/lib/houses';
import type { OpeningBalances } from '../src/lib/rules';
import { addPerson, deactivatePerson, saveOpeningBalances } from '../src/server/people-store';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const SEED_START: IsoDate = '2025-09-01';

type SeedPerson = {
  fullName: string;
  house: HouseSlug | null;
  postKey: string;
  seat?: number;
  startedOn?: IsoDate;
  active?: boolean;
  balances2026?: OpeningBalances;
};

const PEOPLE: readonly SeedPerson[] = [
  // Shared by both Houses.
  { fullName: 'Meritxell Torres Vila', house: null, postKey: 'pdg' },
  { fullName: 'Sílvia Miró Esteve', house: null, postKey: 'psi' },
  { fullName: 'Clara Soler Pujol', house: null, postKey: 'pdg', active: false },
  // Paulo Freire.
  { fullName: 'Carla Ribas Solé', house: 'paulo-freire', postKey: 'er' },
  { fullName: 'Montse Molina Prat', house: 'paulo-freire', postKey: 'tfm' },
  { fullName: 'Noèlia Fernández Grau', house: 'paulo-freire', postKey: 'tft' },
  { fullName: 'Roger Beltrán Camps', house: 'paulo-freire', postKey: 'et', balances2026: { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 } },
  { fullName: 'Mireia Santos Rovira', house: 'paulo-freire', postKey: 'ecs', balances2026: { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 } },
  { fullName: 'David Valls Medina', house: 'paulo-freire', postKey: 'en', seat: 1, balances2026: { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 } },
  { fullName: 'Cristina Pascual Duran', house: 'paulo-freire', postKey: 'en', seat: 2 },
  { fullName: 'Pol Jiménez Alcover', house: 'paulo-freire', postKey: 'ct' },
  { fullName: 'Núria Roca Ferrer', house: 'paulo-freire', postKey: 'tfm', active: false },
  // Carme Aymerich: the CT is vacant.
  { fullName: 'Laia Vidal Mas', house: 'carme-aymerich', postKey: 'er' },
  { fullName: 'Rosa Navarro Costa', house: 'carme-aymerich', postKey: 'tfm' },
  { fullName: 'Aina Martín Serra', house: 'carme-aymerich', postKey: 'tft', startedOn: '2026-07-01' },
  { fullName: 'Júlia Romero Bosch', house: 'carme-aymerich', postKey: 'et' },
  { fullName: 'Berta Puig Casas', house: 'carme-aymerich', postKey: 'ecs' },
  { fullName: 'Marc Sánchez Riera', house: 'carme-aymerich', postKey: 'en', seat: 1 },
  { fullName: 'Irene López Font', house: 'carme-aymerich', postKey: 'en', seat: 2 },
  { fullName: 'Àlex García Martí', house: 'carme-aymerich', postKey: 'ct', active: false },
];

async function main() {
  if ((await db.person.count()) > 0) {
    console.log('Seed skipped: people already exist.');
    return;
  }

  // Inactive people first: they leave the seat free for whoever covers it now.
  const ordered = [...PEOPLE].sort((a, b) => Number(a.active ?? true) - Number(b.active ?? true));
  for (const person of ordered) {
    const id = await addPerson(db, {
      fullName: person.fullName,
      startedOn: person.startedOn ?? SEED_START,
      seat: { house: person.house, postKey: person.postKey, seat: person.seat ?? 1 },
    });
    if (person.active === false) await deactivatePerson(db, id);
    if (person.balances2026) await saveOpeningBalances(db, id, 2026, person.balances2026);
  }

  console.log(`Seeded ${PEOPLE.length} fictional people (${PEOPLE.filter((p) => p.active === false).length} inactive).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 3: Seed the local Postgres twice**

With the local Postgres exports from "Local Postgres" set and the init migration applied (Task 3, Step 6):

```bash
npx prisma db seed
npx prisma db seed
psql -h localhost -p 54329 -U postgres -d casa -c "SELECT coalesce(h.slug, 'shared') AS house, p.post_key, p.seat, p.full_name, p.active FROM people p LEFT JOIN houses h ON h.id = p.house_id ORDER BY 1, 2, 3, 5 DESC"
```

Expected: first run "Seeded 20 fictional people (3 inactive).", second run "Seed skipped: people already exist."; the table shows 2 active shared, 8 active Paulo Freire, 7 active Carme Aymerich (no active `ct`), 3 inactive.

- [x] **Step 4: Check the partial unique indexes and CHECKs by hand**

```bash
psql -h localhost -p 54329 -U postgres -d casa <<'SQL'
\set ON_ERROR_STOP off
-- 1. Second active person on a House seat: must fail (people_active_house_seat_key).
INSERT INTO people (full_name, house_id, post_key, seat, active, updated_at)
  SELECT 'Prova Duplicada', id, 'er', 1, true, now() FROM houses WHERE slug = 'paulo-freire';
-- 2. Second active person on a shared seat: must fail (people_active_shared_seat_key).
INSERT INTO people (full_name, house_id, post_key, seat, active, updated_at) VALUES ('Prova Duplicada', NULL, 'pdg', 1, true, now());
-- 3. An inactive person on an occupied seat: must succeed.
INSERT INTO people (full_name, house_id, post_key, seat, active, updated_at) VALUES ('Prova Inactiva', NULL, 'pdg', 1, false, now());
DELETE FROM people WHERE full_name = 'Prova Inactiva';
-- 4. Seat 3 and a blank name: must fail (CHECKs).
INSERT INTO people (full_name, house_id, post_key, seat, active, updated_at) VALUES ('Prova', NULL, 'pdg', 3, false, now());
INSERT INTO people (full_name, house_id, post_key, seat, active, updated_at) VALUES ('  ', NULL, 'pdg', 1, false, now());
-- 5. Negative vacation days: must fail.
INSERT INTO person_years (person_id, year, vacation_days, carried_days, surplus_minutes) SELECT id, 2027, -1, 0, 0 FROM people LIMIT 1;
SQL
```

Expected: statements 1, 2, 4 (both) and 5 fail with the named index or CHECK; statement 3 succeeds.

- [x] **Step 5: Record the evidence**

Create `openspec/changes/prototype-foundation/db-check.md` with: the date, "local Postgres 16, migration `<timestamp>_init`", the seed output from Step 3, and the psql output from Step 4 (each statement with its ERROR or `INSERT 0 1`). Add one line: "Supabase dev reset: pending, product owner (`npx prisma migrate reset --force` then `npx prisma db seed`)" — or the result if the product owner already ran it. `verify.md` cites this file.

- [x] **Step 6: Commit**

```bash
git add prisma/seed.ts openspec/changes/prototype-foundation/db-check.md
git commit -m "feat(db): seed fictional people and record the seat index check"
```

---

### Task 6: Navigation with the final sections

**Files:**
- Create: `src/lib/sections.ts`, `src/lib/sections.test.ts`, `src/app/(app)/[house]/page.test.tsx`
- Modify: `src/components/section-nav.tsx`, `src/components/section-nav.test.tsx`
- Rewrite: `src/app/(app)/[house]/page.tsx`

**Interfaces:**
- Produces: `type Section = { segment: string; label: string; available: boolean }`, `SECTIONS: readonly Section[]`, `firstAvailableSection(): Section`, `sectionHref(houseSlug: HouseSlug, segment: string): string` — all in `src/lib/sections.ts` (plain module, so Server Components can call them). `section-nav.tsx` no longer exports `SECTIONS` or `sectionHref`.

- [x] **Step 1: Write the failing tests**

Create `src/lib/sections.test.ts`:

```ts
// @vitest-environment node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS, firstAvailableSection, sectionHref } from './sections';

describe('SECTIONS', () => {
  it('lists Saldos, Vacances, El mes and Equip in this order', () => {
    expect(SECTIONS.map((s) => [s.segment, s.label])).toEqual([
      ['saldos', 'Saldos'],
      ['vacances', 'Vacances'],
      ['mes', 'El mes'],
      ['team', 'Equip'],
    ]);
  });

  it('opens Equip first until Saldos ships', () => {
    expect(firstAvailableSection().segment).toBe('team');
  });

  it('builds hrefs inside the active House', () => {
    expect(sectionHref('carme-aymerich', 'team')).toBe('/carme-aymerich/team');
  });

  // Making a section available means flipping its flag AND adding its route; an
  // unavailable section has no route, so its URL is a 404.
  const houseDir = join(process.cwd(), 'src', 'app', '(app)', '[house]');
  it.each(SECTIONS.map((s) => [s.segment, s.available] as const))('%s has a route only when available', (segment, available) => {
    expect(existsSync(join(houseDir, segment, 'page.tsx'))).toBe(available);
  });
});
```

Replace `src/components/section-nav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomTabBar, SectionNav } from './section-nav';

const pathname = vi.hoisted(() => ({ value: '/carme-aymerich/team' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

describe.each([
  ['SectionNav', SectionNav],
  ['BottomTabBar', BottomTabBar],
])('%s', (_name, Nav) => {
  it('links Equip inside the active House and marks it current', () => {
    pathname.value = '/carme-aymerich/team';
    render(<Nav houseSlug="carme-aymerich" />);
    const team = screen.getByRole('link', { name: /Equip/ });
    expect(team).toHaveAttribute('href', '/carme-aymerich/team');
    expect(team).toHaveAttribute('aria-current', 'page');
  });

  it('shows the sections not built yet as text, not links', () => {
    render(<Nav houseSlug="carme-aymerich" />);
    for (const label of ['Saldos', 'Vacances', 'El mes']) {
      expect(screen.queryByRole('link', { name: new RegExp(label) })).toBeNull();
      expect(screen.getByText(label).closest('[aria-disabled="true"]')).not.toBeNull();
    }
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});

describe('SectionNav', () => {
  it('tags unavailable sections "aviat"', () => {
    render(<SectionNav houseSlug="paulo-freire" />);
    expect(screen.getAllByText('aviat')).toHaveLength(3);
  });
});
```

Create `src/app/(app)/[house]/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound, redirect } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import HouseHomePage from './page';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const params = (house: string) => ({ params: Promise.resolve({ house }) });

beforeEach(() => vi.clearAllMocks());

describe('House home', () => {
  it('redirects the director to the first available section', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    await expect(HouseHomePage(params('carme-aymerich'))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/carme-aymerich/team');
  });

  it('checks the director before redirecting', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(HouseHomePage(params('carme-aymerich'))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('404s an unknown House', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    await expect(HouseHomePage(params('nowhere'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/sections.test.ts src/components/section-nav.test.tsx "src/app/(app)/[house]/page.test.tsx"`
Expected: FAIL (missing `./sections`, Inici still a link, page renders instead of redirecting).

- [x] **Step 3: Implement**

Create `src/lib/sections.ts`:

```ts
// House sections in navigation order (SPEC-003 design D8). A later spec makes a
// section available by flipping `available` and adding
// src/app/(app)/[house]/<segment>/page.tsx (sections.test.ts checks both).
// A plain module, not 'use client': Server Components call these.
import type { HouseSlug } from './houses';

export type Section = { readonly segment: string; readonly label: string; readonly available: boolean };

export const SECTIONS: readonly Section[] = [
  { segment: 'saldos', label: 'Saldos', available: false },
  { segment: 'vacances', label: 'Vacances', available: false },
  { segment: 'mes', label: 'El mes', available: false },
  { segment: 'team', label: 'Equip', available: true },
];

export function firstAvailableSection(): Section {
  const section = SECTIONS.find((s) => s.available);
  if (!section) throw new Error('No House section is available.');
  return section;
}

export function sectionHref(houseSlug: HouseSlug, segment: string): string {
  return `/${houseSlug}/${segment}`;
}
```

Replace `src/components/section-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Scale, Sun, Users } from 'lucide-react';
import type { HouseSlug } from '@/lib/houses';
import { SECTIONS, sectionHref } from '@/lib/sections';
import { cn } from '@/lib/utils';

// Same icons as the prototypes (public/prototypes/shared/ui.js).
const ICONS = { saldos: Scale, vacances: Sun, mes: CalendarDays, team: Users } as const;

function iconOf(segment: string) {
  return ICONS[segment as keyof typeof ICONS] ?? Users;
}

function isCurrent(pathname: string, houseSlug: HouseSlug, segment: string): boolean {
  const href = sectionHref(houseSlug, segment);
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop: nav pills in the top bar. Sections not built yet show "aviat" and are not links. */
export function SectionNav({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seccions" className="flex items-center gap-1">
      {SECTIONS.map(({ segment, label, available }) => {
        if (!available) {
          return (
            <span
              key={segment}
              aria-disabled="true"
              title="Aviat"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/60"
            >
              {label}
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-sage-foreground">
                aviat
              </span>
            </span>
          );
        }
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={segment}
            href={sectionHref(houseSlug, segment)}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out',
              current ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: bottom tab bar (DESIGN.md: no sidebar). Sections not built yet are dimmed. */
export function BottomTabBar({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seccions"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {SECTIONS.map(({ segment, label, available }) => {
        const Icon = iconOf(segment);
        const base = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium';
        if (!available) {
          return (
            <span key={segment} aria-disabled="true" className={cn(base, 'text-muted-foreground/50')}>
              <Icon aria-hidden="true" className="size-5" />
              {label}
              <span className="sr-only"> (aviat)</span>
            </span>
          );
        }
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={segment}
            href={sectionHref(houseSlug, segment)}
            aria-current={current ? 'page' : undefined}
            className={cn(base, 'transition-colors duration-150 ease-out', current ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Note: in the mobile tab bar the visible label `Saldos` and the sr-only `(aviat)` are separate text nodes, so `getByText('Saldos')` still matches the label node and `.closest('[aria-disabled="true"]')` finds the span.

Replace `src/app/(app)/[house]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';
import { firstAvailableSection, sectionHref } from '@/lib/sections';

// The House home has no screen of its own: it opens the first available
// section (Equip until Saldos ships).
export default async function HouseHomePage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();
  redirect(sectionHref(house.slug, firstAvailableSection().segment));
}
```

- [x] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run src/lib/sections.test.ts src/components/section-nav.test.tsx "src/app/(app)/[house]/page.test.tsx" && npm test && npm run typecheck && npm run lint`
Expected: PASS. `git grep -n "SECTIONS\|sectionHref" src` shows imports only from `@/lib/sections`.

- [x] **Step 5: Commit**

```bash
git add src/lib/sections.ts src/lib/sections.test.ts src/components/section-nav.tsx src/components/section-nav.test.tsx "src/app/(app)/[house]/page.tsx" "src/app/(app)/[house]/page.test.tsx"
git commit -m "feat(nav): show Saldos, Vacances, El mes and Equip and open the first available"
```

---

### Task 7: Form schemas

**Files:**
- Create: `src/lib/people-schemas.ts`, `src/lib/people-schemas.test.ts`, `src/lib/action-result.ts`

**Interfaces:**
- Consumes: `decodeSeatRef`, `SeatRef` (posts); `parseDateDdMmYyyy` (dates); `parseDuration` (duration).
- Produces: zod schemas whose **input** is the raw form values (strings) and whose **output** is domain values:
  - `addPersonSchema`: in `{ fullName: string; startedOn: string; seat: string }` → out `{ fullName: string; startedOn: IsoDate | null; seat: SeatRef }`
  - `renamePersonSchema`: `{ personId: string; fullName: string }`
  - `placePersonSchema` (move and reactivate): in `{ personId: string; seat: string }` → out `{ personId; seat: SeatRef }`
  - `personIdSchema`: `{ personId: string }`
  - `balancesSchema`: in `{ personId: string; year: number; vacationDays: string; carriedDays: string; surplusSign: '+' | '-'; surplus: string }` → out `{ personId; year; vacationDays: number; carriedDays: number; surplusMinutes: number }`
  - `isPersonId(value: string): boolean`
  - `type ActionResult = { ok: true } | { ok: false; message: string }` in `src/lib/action-result.ts`.

- [x] **Step 1: Write the failing tests**

Create `src/lib/people-schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addPersonSchema, balancesSchema, isPersonId, placePersonSchema, renamePersonSchema } from './people-schemas';

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const firstMessage = (result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  result.error?.issues[0] ? { path: result.error.issues[0].path.join('.'), message: result.error.issues[0].message } : null;

describe('addPersonSchema', () => {
  it('trims the name and parses the date and the seat', () => {
    expect(addPersonSchema.parse({ fullName: '  Carla Ribas Solé ', startedOn: '01/07/2026', seat: 'paulo-freire:er:1' })).toEqual({
      fullName: 'Carla Ribas Solé',
      startedOn: '2026-07-01',
      seat: { house: 'paulo-freire', postKey: 'er', seat: 1 },
    });
  });

  it('allows no start date', () => {
    expect(addPersonSchema.parse({ fullName: 'Carla', startedOn: '', seat: 'shared:pdg:1' }).startedOn).toBeNull();
  });

  it('rejects a blank name', () => {
    expect(firstMessage(addPersonSchema.safeParse({ fullName: '   ', startedOn: '', seat: 'paulo-freire:er:1' }))).toEqual({
      path: 'fullName',
      message: 'Escriu el nom complet.',
    });
  });

  it.each(['31/02/2026', '2026-07-01', '1/7/2026'])('rejects the date %s', (startedOn) => {
    expect(firstMessage(addPersonSchema.safeParse({ fullName: 'Carla', startedOn, seat: 'paulo-freire:er:1' }))).toEqual({
      path: 'startedOn',
      message: 'Escriu la data com dd/mm/aaaa.',
    });
  });

  it.each(['paulo-freire:er:2', 'paulo-freire:xx:1', 'shared:er:1', ''])('rejects the seat %s', (seat) => {
    expect(firstMessage(addPersonSchema.safeParse({ fullName: 'Carla', startedOn: '', seat }))).toEqual({
      path: 'seat',
      message: 'Tria un lloc vacant.',
    });
  });
});

describe('renamePersonSchema and placePersonSchema', () => {
  it('needs a real person id', () => {
    expect(renamePersonSchema.safeParse({ personId: 'abc', fullName: 'Roger' }).success).toBe(false);
    expect(renamePersonSchema.parse({ personId: ID, fullName: ' Roger Beltrán Camps ' }).fullName).toBe('Roger Beltrán Camps');
    expect(placePersonSchema.parse({ personId: ID, seat: 'carme-aymerich:et:1' }).seat).toEqual({ house: 'carme-aymerich', postKey: 'et', seat: 1 });
    expect(isPersonId(ID)).toBe(true);
    expect(isPersonId('1')).toBe(false);
  });
});

describe('balancesSchema', () => {
  const base = { personId: ID, year: 2026, vacationDays: '31', carriedDays: '3', surplusSign: '+' as const, surplus: '12:00' };

  it('stores the surplus in minutes with its sign', () => {
    expect(balancesSchema.parse(base)).toEqual({ personId: ID, year: 2026, vacationDays: 31, carriedDays: 3, surplusMinutes: 720 });
    expect(balancesSchema.parse({ ...base, surplusSign: '-', surplus: '9:15' }).surplusMinutes).toBe(-555);
  });

  it('stores −0:00 as 0', () => {
    expect(Object.is(balancesSchema.parse({ ...base, surplusSign: '-', surplus: '0:00' }).surplusMinutes, 0)).toBe(true);
  });

  it.each(['9:75', 'abc', '', '12'])('rejects the surplus %s', (surplus) => {
    expect(firstMessage(balancesSchema.safeParse({ ...base, surplus }))).toEqual({
      path: 'surplus',
      message: 'Escriu les hores com H:MM, per exemple 3:45.',
    });
  });

  it.each(['100', '-1', '3.5', ''])('rejects vacation days %s', (vacationDays) => {
    expect(firstMessage(balancesSchema.safeParse({ ...base, vacationDays }))?.path).toBe('vacationDays');
  });

  it('rejects a year out of range', () => {
    expect(balancesSchema.safeParse({ ...base, year: 1999 }).success).toBe(false);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/people-schemas.test.ts`
Expected: FAIL, cannot resolve `./people-schemas`.

- [x] **Step 3: Implement**

Create `src/lib/action-result.ts`:

```ts
/** What every Server Function of a form returns: success, or a Catalan message to show with an icon. */
export type ActionResult = { ok: true } | { ok: false; message: string };
```

Create `src/lib/people-schemas.ts`:

```ts
// One schema per form, used by react-hook-form on the client and re-parsed by
// the Server Function (design D9). Inputs are the raw form strings; outputs are
// domain values. Messages are Catalan UI copy.
import { z } from 'zod';
import { parseDateDdMmYyyy } from './dates';
import { parseDuration } from './duration';
import { decodeSeatRef } from './posts';

const personId = z.uuid('Persona desconeguda.');

const fullName = z.string().trim().min(1, 'Escriu el nom complet.').max(120, 'El nom és massa llarg.');

const seat = z.string().transform((value, ctx) => {
  const ref = decodeSeatRef(value);
  if (!ref) {
    ctx.addIssue({ code: 'custom', message: 'Tria un lloc vacant.' });
    return z.NEVER;
  }
  return ref;
});

const optionalDate = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateDdMmYyyy(value);
    if (!date) {
      ctx.addIssue({ code: 'custom', message: 'Escriu la data com dd/mm/aaaa.' });
      return z.NEVER;
    }
    return date;
  });

const days = (what: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, `Escriu ${what} amb un nombre de 0 a 99.`)
    .transform(Number);

export const addPersonSchema = z.object({ fullName, startedOn: optionalDate, seat });

export const renamePersonSchema = z.object({ personId, fullName });

/** Move an active person, or reactivate an inactive one, into a vacant seat. */
export const placePersonSchema = z.object({ personId, seat });

export const personIdSchema = z.object({ personId });

export const balancesSchema = z
  .object({
    personId,
    year: z.number().int().min(2000).max(2100),
    vacationDays: days('els dies de vacances'),
    carriedDays: days('els dies AA'),
    surplusSign: z.enum(['+', '-']),
    surplus: z.string().trim().refine((value) => parseDuration(value) !== null, 'Escriu les hores com H:MM, per exemple 3:45.'),
  })
  .transform(({ surplusSign, surplus, ...rest }) => {
    const minutes = parseDuration(surplus) ?? 0;
    return { ...rest, surplusMinutes: surplusSign === '-' && minutes !== 0 ? -minutes : minutes };
  });

export function isPersonId(value: string): boolean {
  return personId.safeParse(value).success;
}
```

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/lib/people-schemas.test.ts && npm run typecheck`
Expected: PASS. If zod 4 reports the uuid message differently, keep the message argument as the second form `z.uuid({ error: 'Persona desconeguda.' })`.

- [x] **Step 5: Commit**

```bash
git add src/lib/people-schemas.ts src/lib/people-schemas.test.ts src/lib/action-result.ts
git commit -m "feat(people): add the form schemas shared by client and server"
```

---

### Task 8: Team view and director-gated reads

**Files:**
- Modify: `src/lib/team.ts`
- Create: `src/lib/team.test.ts`, `src/server/people.ts`, `src/server/people.test.ts`

**Interfaces:**
- Consumes: posts helpers (Task 1), `defaultOpeningBalances`, `OpeningBalances` (Task 2), store reads (Task 4), `isPersonId` (Task 7), `requireDirector`, `prisma`, `todayInMadrid`, `findHouseBySlug`, `formatDateDdMmYyyy`.
- Produces in `src/lib/team.ts`: `type SeatView = { ref: SeatRef; encoded: string; person: PersonRecord | null; onDutyThisWeek: boolean | null }`, `type PostView = { key: string; roleCode: RoleCode; label: string; summary: string; alternates: boolean; seats: SeatView[] }`, `type TeamView = { shared: PostView[]; posts: PostView[]; unplaced: PersonRecord[]; former: PersonRecord[] }`, `type SeatOption = { value: string; label: string }`, `type PersonDetails = { person: PersonRecord; year: number; balances: OpeningBalances; stored: boolean }`, `buildTeamView(house, people, today): TeamView`, `vacantSeats(people): SeatOption[]`, `seatLabel(ref: SeatRef): string`, `belongsTo(person: PersonRecord, house: HouseSlug): boolean`, `describePerson(person: PersonRecord): string`.
- Produces in `src/server/people.ts`: `getTeam(house: HouseSlug): Promise<TeamView>`, `getVacantSeats(): Promise<SeatOption[]>`, `getPersonDetails(house: HouseSlug, personId: string, year: number): Promise<PersonDetails | null>`.

- [x] **Step 1: Write the failing team view tests**

Create `src/lib/team.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nightSeatOnDuty } from './posts';
import { belongsTo, buildTeamView, describePerson, seatLabel, vacantSeats, type PersonRecord } from './team';

let n = 0;
const person = (fullName: string, house: PersonRecord['house'], postKey: string, extra: Partial<PersonRecord> = {}): PersonRecord => ({
  id: `p${++n}`,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active: true,
  ...extra,
});

const TODAY = '2026-10-13';
const people: PersonRecord[] = [
  person('Meritxell Torres Vila', null, 'pdg'),
  person('Clara Soler Pujol', null, 'pdg', { active: false }),
  person('Carla Ribas Solé', 'paulo-freire', 'er'),
  person('David Valls Medina', 'paulo-freire', 'en', { seat: 1 }),
  person('Cristina Pascual Duran', 'paulo-freire', 'en', { seat: 2 }),
  person('Pol Jiménez Alcover', 'paulo-freire', 'ct', { active: false }),
  person('Laia Vidal Mas', 'carme-aymerich', 'er'),
  person('Àlex García Martí', 'carme-aymerich', 'ct', { active: false }),
  person('Persona Perduda', 'paulo-freire', 'old-post'),
];

describe('buildTeamView', () => {
  const view = buildTeamView('paulo-freire', people, TODAY);

  it('lists the shared posts with their people', () => {
    expect(view.shared.map((p) => [p.label, p.seats.map((s) => s.person?.fullName ?? 'Vacant')])).toEqual([
      ['Pedagoga', ['Meritxell Torres Vila']],
      ['Psicòloga', ['Vacant']],
    ]);
  });

  it('lists every House post in inventory order, vacant seats included', () => {
    expect(view.posts.map((p) => p.key)).toEqual(['er', 'tfm', 'tft', 'et', 'ecs', 'en', 'ct']);
    const ct = view.posts.find((p) => p.key === 'ct')!;
    expect(ct.summary).toBe('Sense horari fix');
    expect(ct.seats[0].person).toBeNull();
    expect(ct.seats[0].encoded).toBe('paulo-freire:ct:1');
  });

  it('shows both night people and which one works this week', () => {
    const en = view.posts.find((p) => p.key === 'en')!;
    expect(en.alternates).toBe(true);
    expect(en.seats.map((s) => s.person?.fullName)).toEqual(['David Valls Medina', 'Cristina Pascual Duran']);
    expect(en.seats.map((s) => s.onDutyThisWeek)).toEqual([nightSeatOnDuty(TODAY) === 1, nightSeatOnDuty(TODAY) === 2]);
    expect(view.posts.find((p) => p.key === 'er')!.seats[0].onDutyThisWeek).toBeNull();
  });

  it('never shows people of the other House', () => {
    const names = JSON.stringify(view);
    expect(names).not.toContain('Laia Vidal Mas');
    expect(names).not.toContain('Àlex García Martí');
  });

  it('lists inactive people of the House and of the shared posts as former members', () => {
    expect(view.former.map((p) => p.fullName)).toEqual(['Clara Soler Pujol', 'Pol Jiménez Alcover']);
  });

  it('keeps an active person whose post no longer exists visible', () => {
    expect(view.unplaced.map((p) => p.fullName)).toEqual(['Persona Perduda']);
  });
});

describe('vacantSeats', () => {
  it('offers every free seat of both Houses and the shared posts', () => {
    const options = vacantSeats(people);
    const values = options.map((o) => o.value);
    expect(values).toContain('shared:psi:1');
    expect(values).toContain('carme-aymerich:ct:1');
    expect(values).toContain('paulo-freire:ct:1');
    expect(values).not.toContain('shared:pdg:1');
    expect(values).not.toContain('paulo-freire:en:2');
    expect(options.find((o) => o.value === 'carme-aymerich:ct:1')?.label).toBe('Carme Aymerich · Corretorn');
  });
});

describe('labels', () => {
  it('names seats with their House and number when the post has two', () => {
    expect(seatLabel({ house: 'paulo-freire', postKey: 'en', seat: 2 })).toBe('Paulo Freire · Educadora de nit 2');
    expect(seatLabel({ house: null, postKey: 'pdg', seat: 1 })).toBe('Compartit · Pedagoga');
  });

  it('describes a person for the details sheet', () => {
    expect(describePerson(people[2])).toBe('Paulo Freire · Educadora referent · des del 01/09/2025');
    expect(describePerson(people[5])).toBe('Paulo Freire · Corretorn · des del 01/09/2025 · antic membre');
  });

  it('says a shared person belongs to both Houses', () => {
    expect(belongsTo(people[0], 'carme-aymerich')).toBe(true);
    expect(belongsTo(people[6], 'paulo-freire')).toBe(false);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/team.test.ts`
Expected: FAIL, missing exports.

- [x] **Step 3: Implement the team view**

Append to `src/lib/team.ts` (and extend its imports to the block below):

```ts
import { formatDateDdMmYyyy, type IsoDate } from './dates';
import { findHouseBySlug, type HouseSlug } from './houses';
import {
  ROLE_LABELS,
  allSeats,
  encodeSeatRef,
  findPost,
  isValidSeat,
  nightSeatOnDuty,
  postsOf,
  scheduleSummary,
  sharedPosts,
  type Post,
  type RoleCode,
  type SeatRef,
} from './posts';
import type { OpeningBalances } from './rules';
```

```ts
export type SeatView = {
  ref: SeatRef;
  /** The seat as a form value, see encodeSeatRef. */
  encoded: string;
  person: PersonRecord | null;
  /** For posts with two alternating seats: does this seat work this week? null otherwise. */
  onDutyThisWeek: boolean | null;
};

export type PostView = {
  key: string;
  roleCode: RoleCode;
  label: string;
  summary: string;
  alternates: boolean;
  seats: SeatView[];
};

export type TeamView = {
  shared: PostView[];
  posts: PostView[];
  /** Active people whose seat is not in the code inventory any more: shown so the director can move them. */
  unplaced: PersonRecord[];
  /** "Antics membres": inactive people of the House or of a shared post. */
  former: PersonRecord[];
};

export type SeatOption = { value: string; label: string };

export type PersonDetails = { person: PersonRecord; year: number; balances: OpeningBalances; stored: boolean };

/** A shared person belongs to both Houses. */
export function belongsTo(person: PersonRecord, house: HouseSlug): boolean {
  return person.house === house || person.house === null;
}

const byName = (a: PersonRecord, b: PersonRecord) => a.fullName.localeCompare(b.fullName, 'ca');

export function buildTeamView(house: HouseSlug, people: readonly PersonRecord[], today: IsoDate): TeamView {
  const visible = people.filter((p) => belongsTo(p, house));
  const active = visible.filter((p) => p.active);
  const nightSeat = nightSeatOnDuty(today);

  const postView = (owner: HouseSlug | null, post: Post): PostView => ({
    key: post.key,
    roleCode: post.roleCode,
    label: ROLE_LABELS[post.roleCode],
    summary: scheduleSummary(post.schedule),
    alternates: post.seats > 1,
    seats: Array.from({ length: post.seats }, (_, i) => {
      const ref: SeatRef = { house: owner, postKey: post.key, seat: i + 1 };
      return {
        ref,
        encoded: encodeSeatRef(ref),
        person: active.find((p) => p.house === owner && p.postKey === post.key && p.seat === ref.seat) ?? null,
        onDutyThisWeek: post.seats > 1 ? nightSeat === ref.seat : null,
      };
    }),
  });

  return {
    shared: sharedPosts().map((post) => postView(null, post)),
    posts: postsOf(house).map((post) => postView(house, post)),
    unplaced: active.filter((p) => !isValidSeat(p)).sort(byName),
    former: visible.filter((p) => !p.active).sort(byName),
  };
}

export function seatLabel(ref: SeatRef): string {
  const post = findPost(ref.house, ref.postKey);
  const role = post ? ROLE_LABELS[post.roleCode] : ref.postKey;
  const number = post && post.seats > 1 ? ` ${ref.seat}` : '';
  const where = ref.house ? (findHouseBySlug(ref.house)?.name ?? ref.house) : 'Compartit';
  return `${where} · ${role}${number}`;
}

/** Every seat with no active person, across both Houses and the shared posts. */
export function vacantSeats(people: readonly PersonRecord[]): SeatOption[] {
  const taken = new Set(people.filter((p) => p.active).map((p) => encodeSeatRef(p)));
  return allSeats()
    .filter((ref) => !taken.has(encodeSeatRef(ref)))
    .map((ref) => ({ value: encodeSeatRef(ref), label: seatLabel(ref) }));
}

export function describePerson(person: PersonRecord): string {
  return [
    seatLabel(person),
    person.startedOn ? `des del ${formatDateDdMmYyyy(person.startedOn)}` : null,
    person.active ? null : 'antic membre',
  ]
    .filter(Boolean)
    .join(' · ');
}
```

Remove the now duplicated `import type { IsoDate }` / `import type { HouseSlug }` lines from the top of the file.

- [x] **Step 4: Run the team view tests**

Run: `npx vitest run src/lib/team.test.ts`
Expected: PASS.

- [x] **Step 5: Write the failing server read tests**

Create `src/server/people.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { findOpeningBalances, findPerson, listActivePeople, listPeopleOf } from './people-store';
import { getPersonDetails, getTeam, getVacantSeats } from './people';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('./people-store', () => ({
  listPeopleOf: vi.fn(async () => []),
  listActivePeople: vi.fn(async () => []),
  findPerson: vi.fn(async () => null),
  findOpeningBalances: vi.fn(async () => null),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const aina = { id: ID, fullName: 'Aina Martín Serra', house: 'carme-aymerich' as const, postKey: 'tft', seat: 1, startedOn: '2026-07-01', active: true };

beforeEach(() => vi.clearAllMocks());

describe('for a non-director', () => {
  it('stops before any query', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(getTeam('paulo-freire')).rejects.toThrow('NEXT_REDIRECT');
    await expect(getVacantSeats()).rejects.toThrow('NEXT_REDIRECT');
    await expect(getPersonDetails('paulo-freire', ID, 2026)).rejects.toThrow('NEXT_REDIRECT');
    expect(listPeopleOf).not.toHaveBeenCalled();
    expect(listActivePeople).not.toHaveBeenCalled();
    expect(findPerson).not.toHaveBeenCalled();
  });
});

describe('for the director', () => {
  beforeEach(() => vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' }));

  it('builds the team of the House', async () => {
    const team = await getTeam('paulo-freire');
    expect(listPeopleOf).toHaveBeenCalledWith({}, 'paulo-freire');
    expect(team.posts).toHaveLength(7);
  });

  it('shows prorated defaults when nothing is stored', async () => {
    vi.mocked(findPerson).mockResolvedValue(aina);
    await expect(getPersonDetails('carme-aymerich', ID, 2026)).resolves.toEqual({
      person: aina,
      year: 2026,
      balances: { vacationDays: 16, carriedDays: 0, surplusMinutes: 0 },
      stored: false,
    });
  });

  it('returns the stored balances', async () => {
    vi.mocked(findPerson).mockResolvedValue(aina);
    vi.mocked(findOpeningBalances).mockResolvedValue({ vacationDays: 20, carriedDays: 1, surplusMinutes: -60 });
    await expect(getPersonDetails('carme-aymerich', ID, 2026)).resolves.toMatchObject({ stored: true, balances: { vacationDays: 20 } });
  });

  it('hides a person of the other House', async () => {
    vi.mocked(findPerson).mockResolvedValue(aina);
    await expect(getPersonDetails('paulo-freire', ID, 2026)).resolves.toBeNull();
    expect(findOpeningBalances).not.toHaveBeenCalled();
  });

  it('ignores an id that is not a UUID without querying', async () => {
    await expect(getPersonDetails('paulo-freire', 'nope', 2026)).resolves.toBeNull();
    expect(findPerson).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/server/people.test.ts`
Expected: FAIL, cannot resolve `./people`.

- [x] **Step 7: Implement `src/server/people.ts`**

```ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { isPersonId } from '@/lib/people-schemas';
import { prisma } from '@/lib/prisma';
import { defaultOpeningBalances } from '@/lib/rules';
import { belongsTo, buildTeamView, vacantSeats, type PersonDetails, type SeatOption, type TeamView } from '@/lib/team';
import { findOpeningBalances, findPerson, listActivePeople, listPeopleOf } from './people-store';

// Reads for the Equip page. Every function checks the director itself: pages
// and layouts render in parallel.

export async function getTeam(house: HouseSlug): Promise<TeamView> {
  await requireDirector();
  return buildTeamView(house, await listPeopleOf(prisma, house), todayInMadrid());
}

export async function getVacantSeats(): Promise<SeatOption[]> {
  await requireDirector();
  return vacantSeats(await listActivePeople(prisma));
}

/** A person of `house` (or of a shared post) with their opening balances of `year`, or null. */
export async function getPersonDetails(house: HouseSlug, personId: string, year: number): Promise<PersonDetails | null> {
  await requireDirector();
  if (!isPersonId(personId)) return null;
  const person = await findPerson(prisma, personId);
  if (!person || !belongsTo(person, house)) return null;
  const stored = await findOpeningBalances(prisma, person.id, year);
  return { person, year, balances: stored ?? defaultOpeningBalances(year, person.startedOn), stored: stored !== null };
}
```

- [x] **Step 8: Run the tests**

Run: `npx vitest run src/lib/team.test.ts src/server/people.test.ts && npm run typecheck`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add src/lib/team.ts src/lib/team.test.ts src/server/people.ts src/server/people.test.ts
git commit -m "feat(people): build the team view and the director-gated reads"
```

---

### Task 9: Server Functions

**Files:**
- Create: `src/app/(app)/[house]/team/actions.ts`, `src/app/(app)/[house]/team/actions.test.ts`

**Interfaces:**
- Consumes: schemas (Task 7), `ActionResult`, store writes and `SeatTakenError` (Task 4), `belongsTo` (Task 8), `requireDirector`, `prisma`, `isHouseSlug`, `revalidatePath` from `next/cache`.
- Produces (each `(houseSlug: string, input: unknown) => Promise<ActionResult>`, input = the raw form values of the matching schema): `addPersonAction`, `renamePersonAction`, `movePersonAction`, `deactivatePersonAction`, `reactivatePersonAction`, `saveBalancesAction`.

- [x] **Step 1: Write the failing tests**

Create `src/app/(app)/[house]/team/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { requireDirector } from '@/lib/auth';
import * as store from '@/server/people-store';
import {
  addPersonAction,
  deactivatePersonAction,
  movePersonAction,
  reactivatePersonAction,
  renamePersonAction,
  saveBalancesAction,
} from './actions';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/people-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/people-store')>()),
  addPerson: vi.fn(async () => 'new-id'),
  findPerson: vi.fn(async () => null),
  renamePerson: vi.fn(),
  placePerson: vi.fn(),
  deactivatePerson: vi.fn(),
  saveOpeningBalances: vi.fn(),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const roger = { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire' as const, postKey: 'et', seat: 1, startedOn: null, active: true };
const balances = { personId: ID, year: 2026, vacationDays: '31', carriedDays: '3', surplusSign: '+', surplus: '12:00' };
const writes = () => [store.addPerson, store.renamePerson, store.placePerson, store.deactivatePerson, store.saveOpeningBalances];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
});

describe('a non-director', () => {
  it('is redirected before anything is read or written', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat: 'paulo-freire:ct:1' })).rejects.toThrow('NEXT_REDIRECT');
    await expect(renamePersonAction('paulo-freire', { personId: ID, fullName: 'X' })).rejects.toThrow('NEXT_REDIRECT');
    await expect(saveBalancesAction('paulo-freire', balances)).rejects.toThrow('NEXT_REDIRECT');
    expect(store.findPerson).not.toHaveBeenCalled();
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });
});

describe('addPersonAction', () => {
  it('adds a person to a vacant seat of the active House', async () => {
    await expect(addPersonAction('paulo-freire', { fullName: 'Carla Ribas Solé', startedOn: '', seat: 'paulo-freire:er:1' })).resolves.toEqual({ ok: true });
    expect(store.addPerson).toHaveBeenCalledWith({}, { fullName: 'Carla Ribas Solé', startedOn: null, seat: { house: 'paulo-freire', postKey: 'er', seat: 1 } });
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/team', 'page');
  });

  it('adds to a shared seat from either House', async () => {
    await expect(addPersonAction('carme-aymerich', { fullName: 'Meritxell Torres Vila', startedOn: '', seat: 'shared:pdg:1' })).resolves.toEqual({ ok: true });
  });

  it('rejects a seat of the other House', async () => {
    const result = await addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat: 'carme-aymerich:ct:1' });
    expect(result.ok).toBe(false);
    expect(store.addPerson).not.toHaveBeenCalled();
  });

  it.each(['paulo-freire:xx:1', 'paulo-freire:er:2'])('rejects the unknown seat %s', async (seat) => {
    await expect(addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat })).resolves.toEqual({ ok: false, message: 'Tria un lloc vacant.' });
    expect(store.addPerson).not.toHaveBeenCalled();
  });

  it('rejects an unknown House', async () => {
    expect((await addPersonAction('nowhere', { fullName: 'X', startedOn: '', seat: 'shared:pdg:1' })).ok).toBe(false);
    expect(store.addPerson).not.toHaveBeenCalled();
  });

  it('names who covers an occupied seat', async () => {
    vi.mocked(store.addPerson).mockRejectedValueOnce(new store.SeatTakenError('Carla Ribas Solé'));
    await expect(addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat: 'paulo-freire:er:1' })).resolves.toEqual({
      ok: false,
      message: "Aquest lloc ja l'ocupa Carla Ribas Solé.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('renamePersonAction', () => {
  it('renames a person of the House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(renamePersonAction('paulo-freire', { personId: ID, fullName: 'Roger Beltrán Camps' })).resolves.toEqual({ ok: true });
    expect(store.renamePerson).toHaveBeenCalledWith({}, ID, 'Roger Beltrán Camps');
  });

  it('rejects a person of the other House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    expect((await renamePersonAction('carme-aymerich', { personId: ID, fullName: 'X' })).ok).toBe(false);
    expect(store.renamePerson).not.toHaveBeenCalled();
  });

  it('accepts a shared person from either House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    await expect(renamePersonAction('carme-aymerich', { personId: ID, fullName: 'X' })).resolves.toEqual({ ok: true });
  });

  it('rejects a tampered id', async () => {
    expect((await renamePersonAction('paulo-freire', { personId: 'x', fullName: 'X' })).ok).toBe(false);
    expect(store.findPerson).not.toHaveBeenCalled();
  });
});

describe('movePersonAction', () => {
  it('moves an active person to the other House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(movePersonAction('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' })).resolves.toEqual({ ok: true });
    expect(store.placePerson).toHaveBeenCalledWith({}, ID, { house: 'carme-aymerich', postKey: 'et', seat: 1 });
  });

  it('refuses to move an inactive person', async () => {
    vi.mocked(store.findPerson).mockResolvedValue({ ...roger, active: false });
    expect((await movePersonAction('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' })).ok).toBe(false);
    expect(store.placePerson).not.toHaveBeenCalled();
  });

  it('names who covers the target seat', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    vi.mocked(store.placePerson).mockRejectedValueOnce(new store.SeatTakenError('Júlia Romero Bosch'));
    await expect(movePersonAction('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' })).resolves.toEqual({
      ok: false,
      message: "Aquest lloc ja l'ocupa Júlia Romero Bosch.",
    });
  });
});

describe('deactivate and reactivate', () => {
  it('marks an active person inactive', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(deactivatePersonAction('paulo-freire', { personId: ID })).resolves.toEqual({ ok: true });
    expect(store.deactivatePerson).toHaveBeenCalledWith({}, ID);
  });

  it('reactivates an inactive person into a vacant seat', async () => {
    vi.mocked(store.findPerson).mockResolvedValue({ ...roger, active: false, postKey: 'ct' });
    await expect(reactivatePersonAction('paulo-freire', { personId: ID, seat: 'paulo-freire:ct:1' })).resolves.toEqual({ ok: true });
    expect(store.placePerson).toHaveBeenCalledWith({}, ID, { house: 'paulo-freire', postKey: 'ct', seat: 1 });
  });

  it('does not reactivate someone already active', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    expect((await reactivatePersonAction('paulo-freire', { personId: ID, seat: 'paulo-freire:ct:1' })).ok).toBe(false);
    expect(store.placePerson).not.toHaveBeenCalled();
  });
});

describe('saveBalancesAction', () => {
  it('stores the balances in days and minutes', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(saveBalancesAction('paulo-freire', { ...balances, surplusSign: '-', surplus: '9:15' })).resolves.toEqual({ ok: true });
    expect(store.saveOpeningBalances).toHaveBeenCalledWith({}, ID, 2026, { vacationDays: 31, carriedDays: 3, surplusMinutes: -555 });
  });

  it('rejects 9:75 without saving', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    expect((await saveBalancesAction('paulo-freire', { ...balances, surplus: '9:75' })).ok).toBe(false);
    expect(store.saveOpeningBalances).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run "src/app/(app)/[house]/team/actions.test.ts"`
Expected: FAIL, cannot resolve `./actions`.

- [x] **Step 3: Implement `src/app/(app)/[house]/team/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireDirector } from '@/lib/auth';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import {
  addPersonSchema,
  balancesSchema,
  personIdSchema,
  placePersonSchema,
  renamePersonSchema,
} from '@/lib/people-schemas';
import { prisma } from '@/lib/prisma';
import { belongsTo, type PersonRecord } from '@/lib/team';
import * as store from '@/server/people-store';

// Equip writes (design D9). Server Functions are reachable by direct POST, so
// each one checks the director, validates the House from the route and
// re-parses its input with the form's own schema.

const INVALID = "No s'ha pogut desar: revisa les dades.";
const NOT_HERE = "Aquesta persona no és d'aquesta casa.";
const WRONG_HOUSE = "Aquest lloc no és d'aquesta casa.";

const fail = (message: string): ActionResult => ({ ok: false, message });

async function run<S extends z.ZodType>(
  houseSlug: string,
  schema: S,
  input: unknown,
  write: (house: HouseSlug, data: z.output<S>) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
  try {
    const result = await write(houseSlug, parsed.data);
    if (result) return result;
  } catch (error) {
    if (error instanceof store.SeatTakenError) {
      return fail(error.occupant ? `Aquest lloc ja l'ocupa ${error.occupant}.` : 'Aquest lloc ja està ocupat.');
    }
    throw error;
  }
  // Both Houses: shared people and moves show on both Equip pages.
  revalidatePath('/[house]/team', 'page');
  return { ok: true };
}

/** The person, if they belong to `house` or to a shared post. */
async function personIn(house: HouseSlug, personId: string): Promise<PersonRecord | null> {
  const person = await store.findPerson(prisma, personId);
  return person && belongsTo(person, house) ? person : null;
}

export async function addPersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, addPersonSchema, input, async (house, data) => {
    if (data.seat.house !== null && data.seat.house !== house) return fail(WRONG_HOUSE);
    await store.addPerson(prisma, data);
  });
}

export async function renamePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, renamePersonSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    await store.renamePerson(prisma, person.id, data.fullName);
  });
}

/** To a vacant seat of this House, the other House or a shared post. Never swaps people. */
export async function movePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, placePersonSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    if (!person.active) return fail('Aquesta persona és a antics membres: reincorpora-la primer.');
    await store.placePerson(prisma, person.id, data.seat);
  });
}

export async function deactivatePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, personIdSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    if (!person.active) return fail('Aquesta persona ja és a antics membres.');
    await store.deactivatePerson(prisma, person.id);
  });
}

export async function reactivatePersonAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, placePersonSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    if (person.active) return fail('Aquesta persona ja cobreix un lloc.');
    await store.placePerson(prisma, person.id, data.seat);
  });
}

export async function saveBalancesAction(houseSlug: string, input: unknown): Promise<ActionResult> {
  return run(houseSlug, balancesSchema, input, async (house, data) => {
    const person = await personIn(house, data.personId);
    if (!person) return fail(NOT_HERE);
    const { vacationDays, carriedDays, surplusMinutes } = data;
    await store.saveOpeningBalances(prisma, person.id, data.year, { vacationDays, carriedDays, surplusMinutes });
  });
}
```

Before writing, re-read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and `.../03-api-reference/04-functions/revalidatePath.md` (a dynamic route pattern needs the `'page'` type argument).

- [x] **Step 4: Run the tests**

Run: `npx vitest run "src/app/(app)/[house]/team/actions.test.ts" && npm run typecheck && npm run lint`
Expected: PASS. (Lint: a `'use server'` file may only export async functions; `run`, `personIn` and `fail` are not exported.)

- [x] **Step 5: Commit**

```bash
git add "src/app/(app)/[house]/team/actions.ts" "src/app/(app)/[house]/team/actions.test.ts"
git commit -m "feat(people): add the Equip Server Functions"
```

---

### Task 10: Form and sheet primitives

**Files:**
- Modify: `src/app/globals.css` (add `--shadow-sheet`)
- Create: `src/components/ui/input.tsx`, `src/components/ui/native-select.tsx`, `src/components/field.tsx`, `src/components/sheet.tsx`, `src/components/duration-input.tsx`, `src/components/date-input.tsx`, and tests `src/components/field.test.tsx`, `src/components/sheet.test.tsx`, `src/components/duration-input.test.tsx`, `src/components/date-input.test.tsx`

**Interfaces:**
- Consumes: `maskDuration` (Task 2), `maskDate` (Task 2), `Button`, `cn`.
- Produces: `Input(props: ComponentProps<'input'>)`, `NativeSelect(props: ComponentProps<'select'>)`, `ErrorText({ id?, children })`, `SuccessText({ children })`, `Field({ id, label, hint?, error?, children })`, `Sheet({ open, onClose, title, description?, children })`, `DurationInput({ id, value, onChange, onBlur?, sign?, onSignChange?, invalid?, describedBy? })`, `DateInput({ value, onChange, ...inputProps })`.

- [x] **Step 1: Write the failing component tests**

`src/components/field.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { Input } from './ui/input';

describe('Field', () => {
  it('labels its input and shows errors with an icon and text', () => {
    render(
      <Field id="name" label="Nom complet" error="Escriu el nom complet.">
        <Input id="name" aria-invalid aria-describedby="name-error" />
      </Field>,
    );
    expect(screen.getByLabelText('Nom complet')).toHaveAttribute('aria-describedby', 'name-error');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Escriu el nom complet.');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(alert).toHaveAttribute('id', 'name-error');
  });

  it('shows the hint only without an error', () => {
    render(
      <Field id="d" label="Data" hint="dd/mm/aaaa">
        <Input id="d" />
      </Field>,
    );
    expect(screen.getByText('dd/mm/aaaa')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

`src/components/sheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Afegeix una persona">x</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog that closes with Escape, the button and the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Afegeix una persona" description="Paulo Freire · Corretorn">
        contingut
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Afegeix una persona' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Paulo Freire · Corretorn')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
```

`src/components/duration-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DurationInput } from './duration-input';

function Harness({ signed = false }: { signed?: boolean }) {
  const [value, setValue] = useState('');
  const [sign, setSign] = useState<'+' | '-'>('+');
  return (
    <>
      <label htmlFor="d">Excedent</label>
      <DurationInput id="d" value={value} onChange={setValue} sign={signed ? sign : undefined} onSignChange={signed ? setSign : undefined} />
      <output>{`${sign}${value}`}</output>
    </>
  );
}

describe('DurationInput', () => {
  it('inserts the colon and keeps only digits', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Excedent');
    await userEvent.type(input, '5530');
    expect(input).toHaveValue('55:30');
    await userEvent.clear(input);
    await userEvent.type(input, 'ab');
    expect(input).toHaveValue('');
  });

  it('offers + and − for a surplus', async () => {
    render(<Harness signed />);
    expect(screen.getByRole('radio', { name: 'Excedent positiu' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Excedent negatiu' }));
    await userEvent.type(screen.getByLabelText('Excedent'), '915');
    expect(screen.getByRole('status')).toHaveTextContent('-9:15');
  });

  it('has no sign choice for plain durations', () => {
    render(<Harness />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('marks itself invalid', () => {
    render(<DurationInput id="x" value="9:75" onChange={() => {}} invalid describedBy="x-error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'x-error');
  });
});
```

(`<output>` has the implicit ARIA role `status`.)

`src/components/date-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DateInput } from './date-input';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="d">Des del</label>
      <DateInput id="d" value={value} onChange={setValue} />
    </>
  );
}

describe('DateInput', () => {
  it('writes dd/mm/aaaa while typing digits', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Des del');
    expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa');
    await userEvent.type(input, '01072026');
    expect(input).toHaveValue('01/07/2026');
  });
});
```

- [x] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/field.test.tsx src/components/sheet.test.tsx src/components/duration-input.test.tsx src/components/date-input.test.tsx`
Expected: FAIL, unresolved modules.

- [x] **Step 3: Implement**

In `src/app/globals.css`, next to `--shadow-clay` inside `@theme`, add (value from the prototypes' `shared/theme.js`):

```css
  --shadow-sheet: 0 24px 60px -20px rgb(46 33 27 / 0.35);
```

`src/components/ui/input.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

// Text input (DESIGN.md: rounded-lg, 44px touch target on mobile). aria-invalid
// turns the border crimson; the message itself comes from <Field> with an icon.
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-lg border border-input bg-card px-3 text-[0.9375rem] text-foreground transition-colors duration-150 ease-out placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-[invalid=true]:border-error md:h-10',
        className,
      )}
      {...props}
    />
  );
}
```

`src/components/ui/native-select.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

/** A native <select> with the Input look: reliable on mobile, no dependency. */
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-lg border border-input bg-card px-3 text-[0.9375rem] text-foreground transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-[invalid=true]:border-error md:h-10',
        className,
      )}
      {...props}
    />
  );
}
```

`src/components/field.tsx`:

```tsx
import { Check, CircleAlert } from 'lucide-react';

/** Crimson is close to terracotta (DESIGN.md): errors always carry an icon and text. */
export function ErrorText({ id, children }: Readonly<{ id?: string; children: React.ReactNode }>) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-error">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SuccessText({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-success">
      <Check aria-hidden="true" className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Label, control, hint or error. The control sets aria-describedby to `${id}-error` when there is one. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: Readonly<{ id: string; label: string; hint?: string; error?: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[0.8125rem] text-muted-foreground">{hint}</p>}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}
```

`src/components/sheet.tsx`:

```tsx
'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Side sheet on desktop, bottom sheet on mobile, as in the prototypes. A plain
 * component (no dialog library, proposal: no new dependencies): Escape, the
 * close button and the backdrop all call onClose.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: Readonly<{ open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }>) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div data-testid="sheet-backdrop" aria-hidden="true" className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <section
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-card shadow-sheet outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-2xl"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            {description && <p className="text-[0.8125rem] text-muted-foreground tabular-nums">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Tanca" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </section>
    </div>
  );
}
```

`src/components/duration-input.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { maskDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';

type Sign = '+' | '-';
const SIGNS: { value: Sign; text: string; label: string }[] = [
  { value: '+', text: '+', label: 'Excedent positiu' },
  { value: '-', text: '−', label: 'Excedent negatiu' },
];

/**
 * The one standard duration field (design D7): `H:MM` only, hours may exceed
 * 24. With `sign` and `onSignChange` it adds the + / − choice of a surplus.
 */
export function DurationInput({
  id,
  value,
  onChange,
  onBlur,
  sign,
  onSignChange,
  invalid,
  describedBy,
}: Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  sign?: Sign;
  onSignChange?: (sign: Sign) => void;
  invalid?: boolean;
  describedBy?: string;
}>) {
  return (
    <div className="flex items-center gap-2">
      {sign && onSignChange && (
        <div role="radiogroup" aria-label="Signe" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {SIGNS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={sign === option.value}
              aria-label={option.label}
              onClick={() => onSignChange(option.value)}
              className={cn(
                'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-base font-semibold transition-colors duration-150 ease-out md:min-h-9 md:min-w-9',
                sign === option.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(maskDuration(event.target.value))}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="off"
        placeholder="H:MM"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="w-28 tabular-nums"
      />
    </div>
  );
}
```

`src/components/date-input.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { maskDate } from '@/lib/dates';

/** Always reads and writes dd/mm/aaaa, whatever the browser language (docs/domain.md §10). */
export function DateInput({
  value,
  onChange,
  ...props
}: Readonly<Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void }>) {
  return (
    <Input
      {...props}
      value={value}
      onChange={(event) => onChange(maskDate(event.target.value))}
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      className="w-36 tabular-nums"
    />
  );
}
```

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/components && npm run typecheck && npm run lint`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui/input.tsx src/components/ui/native-select.tsx src/components/field.tsx src/components/field.test.tsx src/components/sheet.tsx src/components/sheet.test.tsx src/components/duration-input.tsx src/components/duration-input.test.tsx src/components/date-input.tsx src/components/date-input.test.tsx
git commit -m "feat(ui): add the field, sheet, duration and date inputs"
```

---

### Task 11: Equip page (list)

**Files:**
- Create: `src/components/team/team-board.tsx`, `src/components/team/post-card.tsx`, `src/components/team/add-person-button.tsx`, `src/components/team/add-person-form.tsx`, `src/components/team/use-server-action.ts`, `src/components/team/team-board.test.tsx`
- Rewrite: `src/app/(app)/[house]/team/page.tsx`

**Interfaces:**
- Consumes: `TeamView`, `PostView`, `PersonRecord`, `seatLabel`, `buildTeamView` (Task 8), `getTeam`, `getPersonDetails`, `getVacantSeats` (Task 8), `addPersonAction` (Task 9), `addPersonSchema` (Task 7), primitives (Task 10), `sharedWeekSplit` (Task 1), `findHouseBySlug`, `todayInMadrid`.
- Produces: `TeamBoard({ houseSlug, houseName, team, today })` (Server Component), `PostCard({ houseSlug, post, ownerName })`, `AddPersonButton({ houseSlug, seat, seatName })`, `AddPersonForm({ houseSlug, seat, onDone })`, `useServerAction(): { error: string | null; saved: boolean; pending: boolean; run(action: () => Promise<ActionResult>, onSuccess?: () => void): void }`, `personHref(houseSlug, personId, year?)`.

- [x] **Step 1: Write the failing board test**

`src/components/team/team-board.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildTeamView, type PersonRecord } from '@/lib/team';
import { TeamBoard } from './team-board';

vi.mock('@/app/(app)/[house]/team/actions', () => ({ addPersonAction: vi.fn() }));

const p = (id: string, fullName: string, house: PersonRecord['house'], postKey: string, extra: Partial<PersonRecord> = {}): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: null,
  active: true,
  ...extra,
});

const TODAY = '2026-10-13';
const team = buildTeamView(
  'paulo-freire',
  [
    p('a', 'Meritxell Torres Vila', null, 'pdg'),
    p('b', 'David Valls Medina', 'paulo-freire', 'en', { seat: 1 }),
    p('c', 'Cristina Pascual Duran', 'paulo-freire', 'en', { seat: 2 }),
    p('d', 'Pol Jiménez Alcover', 'paulo-freire', 'ct', { active: false }),
  ],
  TODAY,
);

describe('TeamBoard', () => {
  it('shows the shared posts first, then every post of the House', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Compartits entre les dues cases', 'Llocs de Paulo Freire', 'Antics membres']);
    const shared = screen.getByRole('region', { name: 'Compartits entre les dues cases' });
    expect(within(shared).getByText('Pedagoga')).toBeInTheDocument();
    expect(within(shared).getByRole('link', { name: /Meritxell Torres Vila/ })).toHaveAttribute('href', '/paulo-freire/team?person=a');
  });

  it('shows each post with its label and schedule, and vacant seats with an add button', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const ct = screen.getByRole('listitem', { name: 'Corretorn' });
    expect(within(ct).getByText('Sense horari fix')).toBeInTheDocument();
    expect(within(ct).getByText('Vacant')).toBeInTheDocument();
    expect(within(ct).getByRole('button', { name: 'Afegeix una persona a Paulo Freire · Corretorn' })).toBeInTheDocument();
    const et = screen.getByRole('listitem', { name: 'Educadora de tardes' });
    expect(within(et).getByText('dl–dv 14:00–22:00')).toBeInTheDocument();
  });

  it('shows the two night people and their alternating weeks', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const en = screen.getByRole('listitem', { name: 'Educadora de nit' });
    expect(within(en).getByText(/setmanes alternes/)).toBeInTheDocument();
    expect(within(en).getByRole('link', { name: /David Valls Medina/ })).toBeInTheDocument();
    expect(within(en).getByRole('link', { name: /Cristina Pascual Duran/ })).toBeInTheDocument();
    expect(within(en).getByText('Aquesta setmana')).toBeInTheDocument();
    expect(within(en).getByText('La setmana vinent')).toBeInTheDocument();
  });

  it('lists inactive people under Antics membres', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const former = screen.getByRole('region', { name: 'Antics membres' });
    expect(within(former).getByRole('link', { name: /Pol Jiménez Alcover/ })).toBeInTheDocument();
    expect(within(former).getByText('Paulo Freire · Corretorn')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/team/team-board.test.tsx`
Expected: FAIL, cannot resolve `./team-board`.

- [x] **Step 3: Implement the board, the card and the add flow**

`src/components/team/use-server-action.ts`:

```ts
'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/action-result';

/** Runs a Server Function in a transition and keeps its Catalan error or "saved" state. */
export function useServerAction() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setSaved(true);
        onSuccess?.();
      } else {
        setError(result.message);
      }
    });
  }

  return { error, saved, pending, run };
}
```

`src/components/team/add-person-form.tsx`:

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { addPersonAction } from '@/app/(app)/[house]/team/actions';
import { DateInput } from '@/components/date-input';
import { ErrorText, Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HouseSlug } from '@/lib/houses';
import { addPersonSchema } from '@/lib/people-schemas';
import { useServerAction } from './use-server-action';

export function AddPersonForm({ houseSlug, seat, onDone }: Readonly<{ houseSlug: HouseSlug; seat: string; onDone: () => void }>) {
  const { error, pending, run } = useServerAction();
  const form = useForm<z.input<typeof addPersonSchema>, unknown, z.output<typeof addPersonSchema>>({
    resolver: zodResolver(addPersonSchema),
    defaultValues: { fullName: '', startedOn: '', seat },
  });
  const { errors } = form.formState;
  // The server re-parses the raw values with the same schema.
  const onSubmit = form.handleSubmit(() => run(() => addPersonAction(houseSlug, form.getValues()), onDone));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field id="add-full-name" label="Nom complet" error={errors.fullName?.message}>
        <Input
          id="add-full-name"
          autoComplete="off"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? 'add-full-name-error' : undefined}
          {...form.register('fullName')}
        />
      </Field>
      <Field id="add-started-on" label="A la casa des del (opcional)" hint="dd/mm/aaaa" error={errors.startedOn?.message}>
        <Controller
          control={form.control}
          name="startedOn"
          render={({ field }) => (
            <DateInput
              id="add-started-on"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={errors.startedOn ? true : undefined}
              aria-describedby={errors.startedOn ? 'add-started-on-error' : undefined}
            />
          )}
        />
      </Field>
      {(error ?? errors.seat?.message) && <ErrorText>{error ?? errors.seat?.message}</ErrorText>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Desant…' : 'Afegeix'}
      </Button>
    </form>
  );
}
```

`src/components/team/add-person-button.tsx`:

```tsx
'use client';

import { useCallback, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import type { HouseSlug } from '@/lib/houses';
import { AddPersonForm } from './add-person-form';

export function AddPersonButton({ houseSlug, seat, seatName }: Readonly<{ houseSlug: HouseSlug; seat: string; seatName: string }>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Afegeix una persona a ${seatName}`}>
        <UserPlus aria-hidden="true" />
        Afegeix
      </Button>
      <Sheet open={open} onClose={close} title="Afegeix una persona" description={seatName}>
        <AddPersonForm houseSlug={houseSlug} seat={seat} onDone={close} />
      </Sheet>
    </>
  );
}
```

`src/components/team/post-card.tsx`:

```tsx
import Link from 'next/link';
import type { HouseSlug } from '@/lib/houses';
import { seatLabel, type PostView } from '@/lib/team';
import { AddPersonButton } from './add-person-button';

export function personHref(houseSlug: HouseSlug, personId: string, year?: number): string {
  return `/${houseSlug}/team?person=${personId}${year ? `&year=${year}` : ''}`;
}

/** One post: label, weekly schedule, and the person of each seat or "Vacant". */
export function PostCard({ houseSlug, post }: Readonly<{ houseSlug: HouseSlug; post: PostView }>) {
  const titleId = `post-${post.seats[0].encoded.replace(/:/g, '-')}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-clay">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={titleId} className="text-base">
            {post.label}
          </h3>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{post.roleCode}</span>
        </div>
        <p className="mt-0.5 text-[0.8125rem] tabular-nums text-muted-foreground">
          <span>{post.summary}</span>
          {post.alternates && <span> · setmanes alternes</span>}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {post.seats.map((seat) => (
          <li key={seat.encoded}>
            {seat.person ? (
              <Link
                href={personHref(houseSlug, seat.person.id)}
                scroll={false}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 transition-colors duration-150 ease-out hover:bg-hover"
              >
                <span className="font-medium text-foreground">{seat.person.fullName}</span>
                {seat.onDutyThisWeek !== null && (
                  <span className="text-[0.8125rem] text-muted-foreground">{seat.onDutyThisWeek ? 'Aquesta setmana' : 'La setmana vinent'}</span>
                )}
              </Link>
            ) : (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-1.5">
                <span className="text-muted-foreground">Vacant</span>
                <AddPersonButton houseSlug={houseSlug} seat={seat.encoded} seatName={seatLabel(seat.ref)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
```

Note: the nested `<li>` items inside the card have no accessible name, so `getByRole('listitem', { name: 'Corretorn' })` matches only the card.

`src/components/team/team-board.tsx`:

```tsx
import Link from 'next/link';
import type { IsoDate } from '@/lib/dates';
import { findHouseBySlug, type HouseSlug } from '@/lib/houses';
import { sharedWeekSplit } from '@/lib/posts';
import { seatLabel, type PersonRecord, type TeamView } from '@/lib/team';
import { PostCard, personHref } from './post-card';

function PeopleList({ houseSlug, people }: Readonly<{ houseSlug: HouseSlug; people: readonly PersonRecord[] }>) {
  return (
    <ul className="divide-y divide-border rounded-2xl bg-card shadow-clay">
      {people.map((person) => (
        <li key={person.id}>
          <Link
            href={personHref(houseSlug, person.id)}
            scroll={false}
            className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-5 py-3 transition-colors duration-150 ease-out hover:bg-hover"
          >
            <span className="font-medium text-foreground">{person.fullName}</span>
            <span className="text-[0.8125rem] text-muted-foreground">{seatLabel(person)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The Equip page body (design D9): shared posts, the House posts, unplaced and former people. */
export function TeamBoard({
  houseSlug,
  houseName,
  team,
  today,
}: Readonly<{ houseSlug: HouseSlug; houseName: string; team: TeamView; today: IsoDate }>) {
  const split = sharedWeekSplit(today)
    .map(({ days, house }) => `${days} a ${findHouseBySlug(house)?.name ?? house}`)
    .join(', ');

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="shared-title" className="flex flex-col gap-3">
        <div>
          <h2 id="shared-title" className="text-xl">
            Compartits entre les dues cases
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">Aquesta setmana: {split}.</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {team.shared.map((post) => (
            <PostCard key={post.key} houseSlug={houseSlug} post={post} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="posts-title" className="flex flex-col gap-3">
        <h2 id="posts-title" className="text-xl">
          Llocs de {houseName}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {team.posts.map((post) => (
            <PostCard key={post.key} houseSlug={houseSlug} post={post} />
          ))}
        </ul>
      </section>

      {team.unplaced.length > 0 && (
        <section aria-labelledby="unplaced-title" className="flex flex-col gap-3">
          <div>
            <h2 id="unplaced-title" className="text-xl">
              Sense lloc
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">El seu lloc ja no existeix: mou-les a un lloc vacant.</p>
          </div>
          <PeopleList houseSlug={houseSlug} people={team.unplaced} />
        </section>
      )}

      <section aria-labelledby="former-title" className="flex flex-col gap-3">
        <h2 id="former-title" className="text-xl">
          Antics membres
        </h2>
        {team.former.length > 0 ? (
          <PeopleList houseSlug={houseSlug} people={team.former} />
        ) : (
          <p className="text-[0.9375rem] text-muted-foreground">Ningú ha deixat {houseName}.</p>
        )}
      </section>
    </div>
  );
}
```

The board test expects exactly three `h2` headings; with no unplaced people "Sense lloc" is not rendered, which matches the fixture.

Rewrite `src/app/(app)/[house]/team/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { PersonSheet } from '@/components/team/person-sheet';
import { TeamBoard } from '@/components/team/team-board';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getPersonDetails, getTeam, getVacantSeats } from '@/server/people';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

function parseYear(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

// `?person=<id>&year=<yyyy>` opens a person's details and balances in a sheet.
export default async function TeamPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ house: string }>;
  searchParams: Promise<{ person?: string | string[]; year?: string | string[] }>;
}>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  const { person: personId, year: yearParam } = await searchParams;
  const today = todayInMadrid();
  const year = parseYear(yearParam) ?? Number(today.slice(0, 4));

  const [team, details] = await Promise.all([
    getTeam(house.slug),
    typeof personId === 'string' ? getPersonDetails(house.slug, personId, year) : Promise.resolve(null),
  ]);
  const vacantSeats = details ? await getVacantSeats() : [];

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
      <TeamBoard houseSlug={house.slug} houseName={house.name} team={team} today={today} />
      {details && <PersonSheet houseSlug={house.slug} details={details} vacantSeats={vacantSeats} today={today} />}
    </main>
  );
}
```

`PersonSheet` arrives in Task 12. To keep this task green on its own, create it now as the minimal sheet below; Task 12 replaces its body.

`src/components/team/person-sheet.tsx` (first version):

```tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import type { IsoDate } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { describePerson, type PersonDetails, type SeatOption } from '@/lib/team';

export function PersonSheet({
  houseSlug,
  details,
}: Readonly<{ houseSlug: HouseSlug; details: PersonDetails; vacantSeats: readonly SeatOption[]; today: IsoDate }>) {
  const router = useRouter();
  const close = useCallback(() => router.push(`/${houseSlug}/team`, { scroll: false }), [router, houseSlug]);
  return (
    <Sheet open onClose={close} title={details.person.fullName} description={describePerson(details.person)}>
      {null}
    </Sheet>
  );
}
```

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/components/team && npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/team "src/app/(app)/[house]/team/page.tsx"
git commit -m "feat(team): list posts, people, vacant seats and former members"
```

---

### Task 12: Person sheet: rename, move, deactivate, reactivate

**Files:**
- Create: `src/components/team/rename-form.tsx`, `src/components/team/place-form.tsx`, `src/components/team/deactivate-form.tsx`, `src/components/team/person-sheet.test.tsx`
- Rewrite: `src/components/team/person-sheet.tsx`

**Interfaces:**
- Consumes: `renamePersonAction`, `movePersonAction`, `reactivatePersonAction`, `deactivatePersonAction` (Task 9); `renamePersonSchema`, `placePersonSchema` (Task 7); primitives (Task 10); `useServerAction` (Task 11); `PersonDetails`, `SeatOption`, `describePerson` (Task 8).
- Produces: `RenameForm({ houseSlug, personId, fullName })`, `PlaceForm({ houseSlug, personId, vacantSeats, mode: 'move' | 'reactivate' })`, `DeactivateForm({ houseSlug, personId, fullName })`, `PersonSheet({ houseSlug, details, vacantSeats, today })`. `PersonSheet` renders a `{balances}` slot filled in Task 13.

- [x] **Step 1: Write the failing sheet test**

`src/components/team/person-sheet.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deactivatePersonAction,
  movePersonAction,
  reactivatePersonAction,
  renamePersonAction,
} from '@/app/(app)/[house]/team/actions';
import type { PersonDetails } from '@/lib/team';
import { PersonSheet } from './person-sheet';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/app/(app)/[house]/team/actions', () => ({
  renamePersonAction: vi.fn(async () => ({ ok: true })),
  movePersonAction: vi.fn(async () => ({ ok: true })),
  deactivatePersonAction: vi.fn(async () => ({ ok: true })),
  reactivatePersonAction: vi.fn(async () => ({ ok: true })),
  saveBalancesAction: vi.fn(async () => ({ ok: true })),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const details = (active = true): PersonDetails => ({
  person: { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire', postKey: 'et', seat: 1, startedOn: '2025-09-01', active },
  year: 2026,
  balances: { vacationDays: 31, carriedDays: 0, surplusMinutes: 0 },
  stored: false,
});
const vacant = [
  { value: 'carme-aymerich:et:1', label: 'Carme Aymerich · Educadora de tardes' },
  { value: 'paulo-freire:ct:1', label: 'Paulo Freire · Corretorn' },
];

beforeEach(() => vi.clearAllMocks());

describe('PersonSheet', () => {
  it('describes the person and closes back to the team page', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    expect(screen.getByRole('dialog', { name: 'Roger Beltrán Camps' })).toBeInTheDocument();
    expect(screen.getByText('Paulo Freire · Educadora de tardes · des del 01/09/2025')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(push).toHaveBeenCalledWith('/paulo-freire/team', { scroll: false });
  });

  it('renames keeping the same person', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    const name = screen.getByLabelText('Nom complet');
    await userEvent.clear(name);
    await userEvent.type(name, 'Roger Beltran Camps');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(renamePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID, fullName: 'Roger Beltran Camps' });
    expect(await screen.findByText('Desat.')).toBeInTheDocument();
  });

  it('keeps the name and shows the error when renaming fails', async () => {
    vi.mocked(renamePersonAction).mockResolvedValueOnce({ ok: false, message: "Aquesta persona no és d'aquesta casa." });
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    const name = screen.getByLabelText('Nom complet');
    await userEvent.type(name, ' Jr');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Aquesta persona no és d'aquesta casa.");
    expect(name).toHaveValue('Roger Beltrán Camps Jr');
  });

  it('rejects a blank name without calling the server', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.clear(screen.getByLabelText('Nom complet'));
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escriu el nom complet.');
    expect(renamePersonAction).not.toHaveBeenCalled();
  });

  it('moves an active person to a vacant seat', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.selectOptions(screen.getByLabelText('Lloc vacant'), 'carme-aymerich:et:1');
    await userEvent.click(screen.getByRole('button', { name: 'Mou' }));
    expect(movePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' });
  });

  it('asks before moving someone to former members', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.click(screen.getByRole('button', { name: 'Passa a antics membres' }));
    expect(deactivatePersonAction).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Confirmació' });
    expect(within(confirm).getByText(/deixarà el lloc vacant/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sí, deixa el lloc vacant' }));
    expect(deactivatePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID });
  });

  it('offers to reactivate an inactive person instead of moving them', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details(false)} vacantSeats={vacant} today="2026-10-13" />);
    expect(screen.queryByRole('button', { name: 'Mou' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Passa a antics membres' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Lloc vacant'), 'paulo-freire:ct:1');
    await userEvent.click(screen.getByRole('button', { name: 'Reincorpora' }));
    expect(reactivatePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID, seat: 'paulo-freire:ct:1' });
  });

  it('says so when there is no vacant seat', () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={[]} today="2026-10-13" />);
    expect(screen.getByText('No hi ha cap lloc vacant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mou' })).toBeNull();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/team/person-sheet.test.tsx`
Expected: FAIL (the first-version sheet renders no forms).

- [x] **Step 3: Implement the forms and the sheet**

`src/components/team/rename-form.tsx`:

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { renamePersonAction } from '@/app/(app)/[house]/team/actions';
import { ErrorText, Field, SuccessText } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HouseSlug } from '@/lib/houses';
import { renamePersonSchema } from '@/lib/people-schemas';
import { useServerAction } from './use-server-action';

export function RenameForm({ houseSlug, personId, fullName }: Readonly<{ houseSlug: HouseSlug; personId: string; fullName: string }>) {
  const { error, saved, pending, run } = useServerAction();
  const form = useForm<z.input<typeof renamePersonSchema>, unknown, z.output<typeof renamePersonSchema>>({
    resolver: zodResolver(renamePersonSchema),
    defaultValues: { personId, fullName },
  });
  const fieldError = form.formState.errors.fullName?.message;
  const onSubmit = form.handleSubmit(() => run(() => renamePersonAction(houseSlug, form.getValues())));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Field id="rename-full-name" label="Nom complet" error={fieldError}>
        <Input
          id="rename-full-name"
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'rename-full-name-error' : undefined}
          {...form.register('fullName')}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      {saved && <SuccessText>Desat.</SuccessText>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        Desa el nom
      </Button>
    </form>
  );
}
```

`src/components/team/place-form.tsx`:

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRightLeft, UserCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { movePersonAction, reactivatePersonAction } from '@/app/(app)/[house]/team/actions';
import { ErrorText, Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import type { HouseSlug } from '@/lib/houses';
import { placePersonSchema } from '@/lib/people-schemas';
import type { SeatOption } from '@/lib/team';
import { useServerAction } from './use-server-action';

/** Move an active person, or reactivate an inactive one, into a vacant seat of either House. */
export function PlaceForm({
  houseSlug,
  personId,
  vacantSeats,
  mode,
}: Readonly<{ houseSlug: HouseSlug; personId: string; vacantSeats: readonly SeatOption[]; mode: 'move' | 'reactivate' }>) {
  const { error, pending, run } = useServerAction();
  const form = useForm<z.input<typeof placePersonSchema>, unknown, z.output<typeof placePersonSchema>>({
    resolver: zodResolver(placePersonSchema),
    defaultValues: { personId, seat: '' },
  });
  const fieldError = form.formState.errors.seat?.message;
  const action = mode === 'move' ? movePersonAction : reactivatePersonAction;
  const onSubmit = form.handleSubmit(() => run(() => action(houseSlug, form.getValues())));

  if (vacantSeats.length === 0) {
    return <p className="text-[0.875rem] text-muted-foreground">No hi ha cap lloc vacant.</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Field id={`${mode}-seat`} label="Lloc vacant" error={fieldError}>
        <NativeSelect
          id={`${mode}-seat`}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${mode}-seat-error` : undefined}
          {...form.register('seat')}
        >
          <option value="" disabled>
            Tria un lloc
          </option>
          {vacantSeats.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        {mode === 'move' ? <ArrowRightLeft aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
        {mode === 'move' ? 'Mou' : 'Reincorpora'}
      </Button>
    </form>
  );
}
```

`src/components/team/deactivate-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { deactivatePersonAction } from '@/app/(app)/[house]/team/actions';
import { ErrorText } from '@/components/field';
import { Button } from '@/components/ui/button';
import type { HouseSlug } from '@/lib/houses';
import { useServerAction } from './use-server-action';

/** Frees the seat and keeps the person's data and balances (no delete: spec). Asks first. */
export function DeactivateForm({ houseSlug, personId, fullName }: Readonly<{ houseSlug: HouseSlug; personId: string; fullName: string }>) {
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useServerAction();

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" className="self-start" onClick={() => setConfirming(true)}>
        <UserMinus aria-hidden="true" />
        Passa a antics membres
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Confirmació" className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <p className="text-[0.875rem]">
        {fullName} deixarà el lloc vacant. Es guarden les seves dades i saldos, i la pots reincorporar quan torni.
      </p>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => run(() => deactivatePersonAction(houseSlug, { personId }))}
        >
          Sí, deixa el lloc vacant
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel·la
        </Button>
      </div>
    </div>
  );
}
```

Rewrite `src/components/team/person-sheet.tsx`:

```tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import type { IsoDate } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { describePerson, type PersonDetails, type SeatOption } from '@/lib/team';
import { DeactivateForm } from './deactivate-form';
import { PlaceForm } from './place-form';
import { RenameForm } from './rename-form';

function SheetSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[0.9375rem]">{title}</h3>
      {children}
    </section>
  );
}

/** A person's details, opened from the Equip page with `?person=<id>`. */
export function PersonSheet({
  houseSlug,
  details,
  vacantSeats,
  balances,
}: Readonly<{
  houseSlug: HouseSlug;
  details: PersonDetails;
  vacantSeats: readonly SeatOption[];
  today: IsoDate;
  /** Opening balances section (Task 13). */
  balances?: React.ReactNode;
}>) {
  const router = useRouter();
  const close = useCallback(() => router.push(`/${houseSlug}/team`, { scroll: false }), [router, houseSlug]);
  const { person } = details;

  return (
    <Sheet open onClose={close} title={person.fullName} description={describePerson(person)}>
      <div className="flex flex-col gap-8">
        {balances}
        <SheetSection title="Nom">
          {/* key: a rename refreshes the props, so the form restarts from the saved name. */}
          <RenameForm key={person.fullName} houseSlug={houseSlug} personId={person.id} fullName={person.fullName} />
        </SheetSection>
        {person.active ? (
          <SheetSection title="Lloc">
            <p className="text-[0.8125rem] text-muted-foreground">
              Mou-la a un lloc vacant d&apos;aquesta casa, de l&apos;altra o compartit. Els saldos es queden amb la persona.
            </p>
            <PlaceForm houseSlug={houseSlug} personId={person.id} vacantSeats={vacantSeats} mode="move" />
            <DeactivateForm houseSlug={houseSlug} personId={person.id} fullName={person.fullName} />
          </SheetSection>
        ) : (
          <SheetSection title="Reincorporar">
            <PlaceForm houseSlug={houseSlug} personId={person.id} vacantSeats={vacantSeats} mode="reactivate" />
          </SheetSection>
        )}
      </div>
    </Sheet>
  );
}
```

(`today` is accepted but not destructured until Task 13 uses it for the year tabs.)

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/components/team && npm run typecheck && npm run lint`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/team
git commit -m "feat(team): rename, move, deactivate and reactivate people"
```

---

### Task 13: Opening balances in the person sheet

**Files:**
- Create: `src/components/team/balances-section.tsx`, `src/components/team/balances-section.test.tsx`
- Modify: `src/components/team/person-sheet.tsx` (render the section, drop `void today`)

**Interfaces:**
- Consumes: `saveBalancesAction` (Task 9), `balancesSchema` (Task 7), `formatDuration`, `toDurationText` (Task 2), `DurationInput`, `Field`, `ErrorText`, `SuccessText`, `Input` (Task 10), `personHref` (Task 11), `PersonDetails`.
- Produces: `BalancesSection({ houseSlug, details, currentYear })`.

- [x] **Step 1: Write the failing test**

`src/components/team/balances-section.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBalancesAction } from '@/app/(app)/[house]/team/actions';
import type { PersonDetails } from '@/lib/team';
import { BalancesSection } from './balances-section';

vi.mock('@/app/(app)/[house]/team/actions', () => ({ saveBalancesAction: vi.fn(async () => ({ ok: true })) }));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const mireia = (stored: boolean, balances = { vacationDays: 31, carriedDays: 0, surplusMinutes: 0 }): PersonDetails => ({
  person: { id: ID, fullName: 'Mireia Santos Rovira', house: 'paulo-freire', postKey: 'ecs', seat: 1, startedOn: '2025-09-01', active: true },
  year: 2026,
  balances,
  stored,
});

beforeEach(() => vi.clearAllMocks());

describe('BalancesSection', () => {
  it('shows defaults and says they are not saved yet', () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    expect(screen.getByText('31 dies')).toBeInTheDocument();
    expect(screen.getByText('+0 h')).toBeInTheDocument();
    expect(screen.getByText(/Encara no s'han desat/)).toBeInTheDocument();
  });

  it('links the previous, current and next year', () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    expect(screen.getByRole('link', { name: '2026' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '2027' })).toHaveAttribute('href', `/paulo-freire/team?person=${ID}&year=2027`);
    expect(screen.getByRole('link', { name: '2025' })).toBeInTheDocument();
  });

  it('shows stored balances with a signed surplus', () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(true, { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 })} currentYear={2026} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('+12 h')).toBeInTheDocument();
    expect(screen.queryByText(/Encara no s'han desat/)).toBeNull();
    expect(screen.getByLabelText("Excedent de calendari a l'inici de l'any")).toHaveValue('12:00');
  });

  it('saves a negative surplus typed as − 9:15', async () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Excedent negatiu' }));
    const surplus = screen.getByLabelText("Excedent de calendari a l'inici de l'any");
    await userEvent.clear(surplus);
    await userEvent.type(surplus, '915');
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    expect(saveBalancesAction).toHaveBeenCalledWith('paulo-freire', {
      personId: ID,
      year: 2026,
      vacationDays: '31',
      carriedDays: '0',
      surplusSign: '-',
      surplus: '9:15',
    });
  });

  it('shows an error with an icon for 9:75 and saves nothing', async () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    const surplus = screen.getByLabelText("Excedent de calendari a l'inici de l'any");
    await userEvent.clear(surplus);
    await userEvent.type(surplus, '975');
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Escriu les hores com H:MM, per exemple 3:45.');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(saveBalancesAction).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/team/balances-section.test.tsx`
Expected: FAIL, cannot resolve `./balances-section`.

- [x] **Step 3: Implement**

`src/components/team/balances-section.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { saveBalancesAction } from '@/app/(app)/[house]/team/actions';
import { DurationInput } from '@/components/duration-input';
import { ErrorText, Field, SuccessText } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDuration, toDurationText } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { balancesSchema } from '@/lib/people-schemas';
import type { PersonDetails } from '@/lib/team';
import { cn } from '@/lib/utils';
import { personHref } from './post-card';
import { useServerAction } from './use-server-action';

function Tile({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl bg-background p-3">
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function BalancesForm({ houseSlug, details }: Readonly<{ houseSlug: HouseSlug; details: PersonDetails }>) {
  const { person, year, balances } = details;
  const { error, saved, pending, run } = useServerAction();
  const form = useForm<z.input<typeof balancesSchema>, unknown, z.output<typeof balancesSchema>>({
    resolver: zodResolver(balancesSchema),
    defaultValues: {
      personId: person.id,
      year,
      vacationDays: String(balances.vacationDays),
      carriedDays: String(balances.carriedDays),
      surplusSign: balances.surplusMinutes < 0 ? '-' : '+',
      surplus: toDurationText(balances.surplusMinutes),
    },
  });
  const { errors } = form.formState;
  const sign = form.watch('surplusSign');
  const onSubmit = form.handleSubmit(() => run(() => saveBalancesAction(houseSlug, form.getValues())));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id="balances-vacation" label="Dies de vacances" error={errors.vacationDays?.message}>
          <Input
            id="balances-vacation"
            inputMode="numeric"
            className="w-24 tabular-nums"
            aria-invalid={errors.vacationDays ? true : undefined}
            aria-describedby={errors.vacationDays ? 'balances-vacation-error' : undefined}
            {...form.register('vacationDays')}
          />
        </Field>
        <Field id="balances-carried" label="Dies AA (any anterior)" error={errors.carriedDays?.message}>
          <Input
            id="balances-carried"
            inputMode="numeric"
            className="w-24 tabular-nums"
            aria-invalid={errors.carriedDays ? true : undefined}
            aria-describedby={errors.carriedDays ? 'balances-carried-error' : undefined}
            {...form.register('carriedDays')}
          />
        </Field>
      </div>
      <Field id="balances-surplus" label="Excedent de calendari a l'inici de l'any" error={errors.surplus?.message}>
        <Controller
          control={form.control}
          name="surplus"
          render={({ field }) => (
            <DurationInput
              id="balances-surplus"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              sign={sign}
              onSignChange={(value) => form.setValue('surplusSign', value, { shouldDirty: true })}
              invalid={!!errors.surplus}
              describedBy={errors.surplus ? 'balances-surplus-error' : undefined}
            />
          )}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      {saved && <SuccessText>Desat.</SuccessText>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        Desa els saldos de {year}
      </Button>
    </form>
  );
}

/** Opening balances of one year (design D6): defaults until the director saves them. */
export function BalancesSection({
  houseSlug,
  details,
  currentYear,
}: Readonly<{ houseSlug: HouseSlug; details: PersonDetails; currentYear: number }>) {
  const { person, year, balances, stored } = details;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[0.9375rem]">Saldos d&apos;inici d&apos;any</h3>
        <nav aria-label="Any" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <Link
              key={y}
              href={personHref(houseSlug, person.id, y)}
              scroll={false}
              aria-current={y === year ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium tabular-nums transition-colors duration-150 ease-out',
                y === year ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Tile label="Vacances" value={`${balances.vacationDays} dies`} />
        <Tile label="Dies AA" value={String(balances.carriedDays)} />
        <Tile label="Excedent" value={formatDuration(balances.surplusMinutes, { signed: true })} />
      </dl>
      {!stored && <p className="text-[0.8125rem] text-muted-foreground">Encara no s&apos;han desat: són els valors per defecte.</p>}
      {/* key: switching year or saving restarts the form from the shown values. */}
      <BalancesForm key={`${person.id}-${year}-${balances.vacationDays}-${balances.carriedDays}-${balances.surplusMinutes}`} houseSlug={houseSlug} details={details} />
    </section>
  );
}
```

In `src/components/team/person-sheet.tsx`: import `BalancesSection`, remove the `balances` prop, destructure `today`, and render it first:

```tsx
        <BalancesSection houseSlug={houseSlug} details={details} currentYear={Number(today.slice(0, 4))} />
```

(replacing `{balances}`). `person-sheet.test.tsx` already mocks `saveBalancesAction`. Note the "Nom complet" label is unique in the sheet; the balances fields use other labels.

- [x] **Step 4: Run the tests**

Run: `npx vitest run src/components/team && npm test && npm run typecheck && npm run lint`
Expected: PASS. If `getByText('3')` is ambiguous because another node renders "3", scope it with `within(screen.getByText('Dies AA').closest('div')!)`.

- [x] **Step 5: Commit**

```bash
git add src/components/team
git commit -m "feat(team): edit opening balances per person and year"
```

---

### Task 14: Browser check on desktop and mobile

**Files:** none (evidence goes to `openspec/changes/prototype-foundation/db-check.md` → rename the section "Manual checks", or straight into `verify.md` later).

This needs Clerk dev keys, a user with `publicMetadata.role = "director"` and a seeded database. In the cloud container there is no `.env.local`: if the variables are not available, **do not fake auth**; write "Browser check: pending, product owner" in the evidence file and tell the product owner the steps below.

- [x] **Step 1: Start the app** — `npm run dev` with `.env.local` pointing at a seeded database (Supabase dev after the reset, or the local Postgres via `DATABASE_URL`).
- [x] **Step 2: Desktop (1280px), Paulo Freire** — `/paulo-freire` redirects to `/paulo-freire/team`; nav shows Saldos, Vacances, El mes with "aviat" (not clickable) and Equip current; `/paulo-freire/saldos` shows the Catalan 404; shared posts listed first with "Aquesta setmana: …"; seven posts with schedules; EN with both people and "Aquesta setmana" / "La setmana vinent"; Antics membres lists Clara Soler Pujol and Núria Roca Ferrer.
- [x] **Step 3: Flows** — add a person to Carme Aymerich's vacant Corretorn; rename Roger Beltrán Camps; move him to a vacant seat of Carme Aymerich and back; try moving into an occupied seat (error with icon names the occupant; no implicit swap); pass Pol Jiménez Alcover to antics membres and reincorporate him; save Mireia Santos Rovira's 2026 balances 31 / 3 / +12:00 and see "31 dies", "3", "+12 h"; type `9:75` and see the error; switch year to 2027 and see defaults.
- [x] **Step 4: House switch** — from `/paulo-freire/team` switch to Carme Aymerich: lands on `/carme-aymerich/team`, shared posts show the same people, no Paulo Freire names.
- [x] **Step 5: Mobile (390px)** — bottom tab bar with Saldos, Vacances, El mes dimmed and Equip active; cards in one column; the person sheet opens from the bottom; inputs are at least 44px high.
- [x] **Step 6: Record** the results (or "pending, product owner") and commit:

```bash
git add openspec/changes/prototype-foundation/db-check.md
git commit -m "docs(openspec): record the Equip browser check"
```

---

### Task 15: Docs and final checks

**Files:**
- Modify: `docs/domain.md`, `AGENTS.md`, `README.md`, `openspec/config.yaml`, `docs/prototypes/director-feedback.md`, `openspec/changes/prototype-foundation/tasks.md`

- [x] **Step 1: `docs/domain.md`** — §2: posts live in `src/lib/posts.ts` (keys `er, tfm, tft, et, ecs, en, ct`; shared `pdg, psi`). §3: replace "alternate by ISO week" wording with "alternate every week, counted from a fixed Monday (`weekIndex` in `src/lib/dates.ts`) so the alternation survives 53-week years"; state that shared posts work Monday to Wednesday in one House and Thursday and Friday in the other, swapping each week (provisional). §7: default vacation days are `defaultVacationDays` in `src/lib/rules.ts`. §10: dates use `DateInput`, durations `DurationInput`. §11: Equip "Done in SPEC-003". Mark each edit "(changed in SPEC-003)" where it differs from what was written before.
- [x] **Step 2: `docs/prototypes/director-feedback.md`** — the note "the app's role catalogue (`src/lib/roles.ts`, staffing migration) still says Corretor" refers to unmerged SPEC-002: replace with "The app says Corretorn (`src/lib/posts.ts`)."
- [x] **Step 3: `AGENTS.md`** — intro: SPEC-003 `prototype-foundation` replaced dated membership with people per post; the next specs are SPEC-004 Saldos, SPEC-005 El mes, SPEC-006 Vacances, and agents **must read `docs/domain.md`, the prototypes in `public/prototypes/` and `docs/prototypes/director-feedback.md` before working on them**. Stack: models `House`, `Person`, `PersonYear`. Layout: `[house]/` sections are registered in `src/lib/sections.ts` (flag + route) and their icon in `src/components/section-nav.tsx`; `/[house]` redirects to the first available section; `src/lib/posts.ts`, `src/lib/rules.ts`, `src/lib/duration.ts`, `src/lib/team.ts`, `src/lib/people-schemas.ts`; `src/server/people.ts` (director-gated reads), `src/server/people-store.ts` (Prisma, no auth, seed only outside the Server Functions), `src/app/(app)/[house]/team/actions.ts`; `src/components/team/`, `sheet.tsx`, `field.tsx`, `duration-input.tsx`, `date-input.tsx`. Remove `house-membership.ts`, `membership-store.ts`. Access and data rules: replace the "Every House-scoped record stores its own houseId … transfer" and exclusion-constraint bullets with: balances, APs and vacations belong to the person, never to a House; records that belong to a House (rota changes, day notes) store `house_id`; one active person per seat is enforced by two hand-written partial unique indexes in the init migration (Prisma does not show them); posts, schedules and rules are code, changed by a code change; Server Functions call `requireDirector()`, validate the House slug and re-parse with the form's zod schema.
- [x] **Step 4: `README.md`** — Status: "Houses, the final navigation and the Equip page (people per post, opening balances). Saldos, Vacances and El mes are next (SPEC-004 to SPEC-006)." Routes: `/<house>` redirects to Equip. "Dev data and access": (1) reset the dev database after pulling SPEC-003 (`npx prisma migrate reset --force`, it drops everything; fictional data only), (2) `npx prisma db seed` (20 fictional people, 3 inactive), (3) the Clerk metadata step unchanged.
- [x] **Step 5: `openspec/config.yaml`** — add to `context`: "Domain reference: docs/domain.md (read before any spec). Approved UI: public/prototypes/ and docs/prototypes/director-feedback.md. People cover seats of posts defined in src/lib/posts.ts; balances belong to the person."
- [x] **Step 6: Final checks**

```bash
npm run lint
npm run typecheck
npm test
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-} npm run build
```

Expected: lint, typecheck and tests green. `npm run build` needs real Clerk keys (`README.md`); with `.env.local` present it must succeed and list `/[house]`, `/[house]/team`, `/dashboard`, `/no-access`. Without keys in the cloud container, record "build: pending, product owner" and the exact error. `git grep -nE "Employee|HouseMembership|membership|transferEmployee|Inici" -- src prisma AGENTS.md README.md` must return nothing relevant (the word "membres" in Catalan copy is fine).

- [x] **Step 7: Tick `tasks.md`** — mark every completed box; leave 2.4 (Supabase reset) and 6.5 (browser check) unticked if they are still pending for the product owner, with a note.
- [x] **Step 8: Commit**

```bash
git add docs AGENTS.md README.md openspec
git commit -m "docs: document people and posts for the next specs"
```

---

## Self-review notes

- **Spec coverage:** posts per House and shared (T1), role labels (T1), weekly schedule and provisional times (T1), weekends/holidays/nights/CT (T1 `rangesOn`, `nightSeatOnDuty`), minimal personal data (T3 schema, T5 seed), one active person per seat in the DB (T3, T5 check), Equip lists posts and people, not the other House (T8, T11), add/rename/move/inactive/reactivate (T9, T11, T12), opening balances and defaults (T2, T8, T13), duration input (T2, T10, T13), balances follow the person (store never touches `person_years` on a move: T4 `placePerson`), writes scoped to the House (T9), director-only everywhere (T6, T8, T9 tests), sections and "aviat" (T6), House home redirect (T6), unavailable URL 404 (T6 route test + T14), membership removal (T3), docs (T15).
- **Deliberate refinement of design D3:** alternation uses a fixed-Monday week index instead of ISO week parity (see Review Focus 1); recorded in `docs/domain.md` by T15.
- **Not automatable here:** Supabase dev reset (T5, product owner), browser check and `next build` with real Clerk keys (T14, T15) when no `.env.local` is available.
