# House Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task, tick the matching `tasks.md` items listed under **Covers**.

**Goal:** Make the House (Paulo Freire, Carme Aymerich) the operational context of the app: House-scoped routes with a switcher, dated employee membership with one House at a time, a read-only team page, and a director-only gate.

**Architecture:** The active House is the first URL segment (`/[house]/...`). The proxy remembers the last one in a cookie that is used only to redirect `/dashboard`. Membership rules live in a pure TypeScript module (`src/lib/house-membership.ts`) backed by a Postgres exclusion constraint. A thin data layer (`src/server/`) wraps Prisma and checks `requireDirector()` on every call, because Next.js renders layouts and pages in parallel.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7 (`prisma-client` generator, `PrismaPg` adapter) on Supabase Postgres (EU), Clerk (`@clerk/nextjs`), Tailwind v4 tokens, Vitest + Testing Library, lucide-react (new), tsx (new, dev).

**Spec:** `openspec/changes/house-context/` (`design.md` D1 to D9; `specs/house-context/spec.md`; `specs/house-membership/spec.md`). Read `design.md` and both specs before starting.

## Global Constraints

- UI copy is Catalan. Code, identifiers, **routes**, comments and commit messages are English (`/[house]/team`, label "Equip").
- No em-dashes in code comments, commit messages or logs.
- Conventional commits. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- npm only. Node 24.
- House slugs are exactly `paulo-freire` and `carme-aymerich`, with names `Paulo Freire` and `Carme Aymerich`. They are permanent.
- Honey (`accent`, `bg-accent`, `text-accent`, `border-accent`) is never used in this change. Selected states use `bg-secondary` (Salvia clara) with `text-foreground`.
- Fraunces only via `h1`/`h2`/`.font-display` at 20px or more. Dates use `tabular-nums`. Mobile side gutter is 16px (`px-4`).
- Errors and blocking states carry an icon and text.
- Radii: `rounded-2xl` panels, `rounded-xl` cards, `rounded-lg` buttons/inputs, `rounded-md` dense. Panels use `shadow-clay`. Transitions 150 to 200ms.
- Dates are `IsoDate` strings (`YYYY-MM-DD`). "Today" is always `todayInMadrid()`.
- Read the relevant guide in `node_modules/next/dist/docs/` before using a Next API you have not used in this plan (AGENTS.md).
- **Worktree setup:** `.env.local` is gitignored. Copy it from the main checkout into the worktree before any Prisma or `npm run build` command: `cp ../<main-checkout>/.env.local .env.local` (adjust the path). Then `npm install`.

## Review Focus

1. **Tampered `active-house` cookie** (`//evil.com`, `../x`, empty): `/dashboard` must redirect to `/paulo-freire`, never echo the value (open redirect). Test in Task 8.
2. **Odd paths**: a trailing slash (`/paulo-freire/team/`), deep paths (`/paulo-freire/team/x/y`) and wrong case (`/Paulo-Freire`). Switching keeps the section without a trailing slash, and wrong case is not a House (no cookie, 404). Tests in Task 1 and Task 8.
3. **Madrid midnight in both DST regimes**: summer (UTC+2) and winter (UTC+1) must both flip the date at local midnight. Test in Task 2.
4. **Memberships that start in the future or have already ended** must not appear in today's team. Tests in Task 3 and Task 6.
5. **A non-director opening a deep House URL directly** must be stopped before any query, even though the parent layout also checks. Test in Task 6 (data layer) and Task 5 (`requireDirector`).

---

## Task 1: Houses in code

**Covers:** tasks.md 1.1, 1.2

**Files:**
- Create: `src/lib/houses.ts`
- Test: `src/lib/houses.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HOUSES: readonly [{ slug: 'paulo-freire'; name: 'Paulo Freire' }, { slug: 'carme-aymerich'; name: 'Carme Aymerich' }]`
  - `type House = (typeof HOUSES)[number]`, `type HouseSlug = House['slug']`
  - `DEFAULT_HOUSE_SLUG: HouseSlug` (`'paulo-freire'`)
  - `isHouseSlug(value: unknown): value is HouseSlug`
  - `findHouseBySlug(slug: string): House | undefined`
  - `houseSlugFromPath(pathname: string): HouseSlug | null`
  - `switchHousePath(pathname: string, toSlug: HouseSlug): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/houses.test.ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_SLUG,
  HOUSES,
  findHouseBySlug,
  houseSlugFromPath,
  isHouseSlug,
  switchHousePath,
} from './houses';

describe('HOUSES', () => {
  it('lists exactly the two Houses with their permanent slugs', () => {
    expect(HOUSES).toEqual([
      { slug: 'paulo-freire', name: 'Paulo Freire' },
      { slug: 'carme-aymerich', name: 'Carme Aymerich' },
    ]);
    expect(DEFAULT_HOUSE_SLUG).toBe('paulo-freire');
  });
});

describe('isHouseSlug / findHouseBySlug', () => {
  it('accepts known slugs only, case-sensitively', () => {
    expect(isHouseSlug('carme-aymerich')).toBe(true);
    expect(isHouseSlug('Paulo-Freire')).toBe(false);
    expect(isHouseSlug('')).toBe(false);
    expect(isHouseSlug(undefined)).toBe(false);
    expect(findHouseBySlug('paulo-freire')?.name).toBe('Paulo Freire');
    expect(findHouseBySlug('casa-inexistent')).toBeUndefined();
  });
});

describe('houseSlugFromPath', () => {
  it('reads the first path segment', () => {
    expect(houseSlugFromPath('/paulo-freire')).toBe('paulo-freire');
    expect(houseSlugFromPath('/carme-aymerich/team')).toBe('carme-aymerich');
    expect(houseSlugFromPath('/carme-aymerich/team/')).toBe('carme-aymerich');
  });

  it('returns null outside a House', () => {
    expect(houseSlugFromPath('/')).toBeNull();
    expect(houseSlugFromPath('/dashboard')).toBeNull();
    expect(houseSlugFromPath('/Paulo-Freire/team')).toBeNull();
  });
});

describe('switchHousePath', () => {
  it('swaps the House and keeps the section', () => {
    expect(switchHousePath('/paulo-freire', 'carme-aymerich')).toBe('/carme-aymerich');
    expect(switchHousePath('/paulo-freire/team', 'carme-aymerich')).toBe('/carme-aymerich/team');
    expect(switchHousePath('/paulo-freire/team/a/b', 'carme-aymerich')).toBe('/carme-aymerich/team/a/b');
  });

  it('drops a trailing slash', () => {
    expect(switchHousePath('/paulo-freire/team/', 'carme-aymerich')).toBe('/carme-aymerich/team');
  });

  it('keeps the path when switching to the same House', () => {
    expect(switchHousePath('/paulo-freire/team', 'paulo-freire')).toBe('/paulo-freire/team');
  });

  it('goes to the House home from a non-House path', () => {
    expect(switchHousePath('/dashboard', 'carme-aymerich')).toBe('/carme-aymerich');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/houses.test.ts`
Expected: FAIL, "Failed to resolve import './houses'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/houses.ts

// The two Cases d'Infants (FR-001). Keep in sync with the rows inserted by the
// house_context migration (a test checks it). The proxy uses this list, so it
// must stay a plain constant with no database access.
export const HOUSES = [
  { slug: 'paulo-freire', name: 'Paulo Freire' },
  { slug: 'carme-aymerich', name: 'Carme Aymerich' },
] as const;

export type House = (typeof HOUSES)[number];
export type HouseSlug = House['slug'];

export const DEFAULT_HOUSE_SLUG: HouseSlug = 'paulo-freire';

export function isHouseSlug(value: unknown): value is HouseSlug {
  return typeof value === 'string' && HOUSES.some((house) => house.slug === value);
}

export function findHouseBySlug(slug: string): House | undefined {
  return HOUSES.find((house) => house.slug === slug);
}

/** The House in the first path segment: `/paulo-freire/team` is `paulo-freire`. */
export function houseSlugFromPath(pathname: string): HouseSlug | null {
  const first = pathname.split('/')[1] ?? '';
  return isHouseSlug(first) ? first : null;
}

/**
 * Same section, other House: `/paulo-freire/team` becomes `/carme-aymerich/team`.
 * A path outside any House goes to the target House home.
 */
export function switchHousePath(pathname: string, toSlug: HouseSlug): string {
  if (!houseSlugFromPath(pathname)) return `/${toSlug}`;
  const segments = pathname.split('/');
  segments[1] = toSlug;
  const path = segments.join('/');
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/houses.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/houses.ts src/lib/houses.test.ts openspec/changes/house-context/tasks.md
git commit -m "feat(houses): add House constants and path helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Calendar dates and "today" in Madrid

**Covers:** tasks.md 2.1

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type IsoDate = string` (`YYYY-MM-DD`; compares correctly as a string)
  - `isIsoDate(value: string): boolean`
  - `todayInMadrid(now?: Date): IsoDate`
  - `addDays(date: IsoDate, days: number): IsoDate`
  - `isoDateToDate(date: IsoDate): Date` (UTC midnight, for Prisma `@db.Date`)
  - `dateToIsoDate(date: Date): IsoDate`
  - `formatDateCa(date: IsoDate): string` (e.g. `1 de juliol del 2026`)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dates.test.ts
import { describe, expect, it } from 'vitest';
import { addDays, dateToIsoDate, formatDateCa, isIsoDate, isoDateToDate, todayInMadrid } from './dates';

describe('todayInMadrid', () => {
  it('flips at Madrid midnight in summer (UTC+2)', () => {
    expect(todayInMadrid(new Date('2026-06-30T21:59:59Z'))).toBe('2026-06-30');
    expect(todayInMadrid(new Date('2026-06-30T22:00:00Z'))).toBe('2026-07-01');
    expect(todayInMadrid(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
  });

  it('flips at Madrid midnight in winter (UTC+1)', () => {
    expect(todayInMadrid(new Date('2026-01-14T22:59:59Z'))).toBe('2026-01-14');
    expect(todayInMadrid(new Date('2026-01-14T23:00:00Z'))).toBe('2026-01-15');
  });
});

describe('addDays', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-07-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-7-1')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('Date conversion', () => {
  it('round-trips through UTC midnight', () => {
    const date = isoDateToDate('2026-07-01');
    expect(date.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(dateToIsoDate(date)).toBe('2026-07-01');
  });
});

describe('formatDateCa', () => {
  it('formats in Catalan', () => {
    expect(formatDateCa('2026-07-01')).toBe('1 de juliol del 2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL, "Failed to resolve import './dates'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/dates.ts

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS. If only the `formatDateCa` assertion fails because of the local ICU data (for example `de 2026` instead of `del 2026`), print the actual value with `node -e "console.log(new Intl.DateTimeFormat('ca',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date('2026-07-01T00:00:00Z')))"` and use it as the expected string. Node 24 prints `1 de juliol del 2026`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts openspec/changes/house-context/tasks.md
git commit -m "feat(dates): add IsoDate helpers and Madrid today

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Membership domain module

**Covers:** tasks.md 2.2, 2.3, 2.4

**Files:**
- Create: `src/lib/house-membership.ts`
- Test: `src/lib/house-membership.test.ts`

**Interfaces:**
- Consumes: `IsoDate`, `addDays` from `src/lib/dates.ts` (Task 2).
- Produces:
  - `type Membership = { id: string; employeeId: string; houseId: string; startsOn: IsoDate; endsOn: IsoDate | null }`
  - `type TeamMember = { employeeId: string; fullName: string; startsOn: IsoDate }`
  - `isActiveOn(m: Pick<Membership, 'startsOn' | 'endsOn'>, date: IsoDate): boolean`
  - `membersOn<T extends Membership>(memberships: readonly T[], houseId: string, date: IsoDate): T[]`
  - `houseOf(memberships: readonly Membership[], employeeId: string, date: IsoDate): string | null`
  - `findOverlap<T extends MembershipPeriod>(existing: readonly T[], candidate: MembershipPeriod): T | undefined`, with `type MembershipPeriod = Pick<Membership, 'employeeId' | 'startsOn' | 'endsOn'>`
  - `class TransferError extends Error { reason: TransferErrorReason }`, with `type TransferErrorReason = 'no-current-membership' | 'already-ending' | 'same-house' | 'starts-too-early'`
  - `type TransferPlan = { close: { id: string; endsOn: IsoDate }; open: { employeeId: string; houseId: string; startsOn: IsoDate } }`
  - `planTransfer(current: Membership, toHouseId: string, startsOn: IsoDate): TransferPlan`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/house-membership.test.ts
import { describe, expect, it } from 'vitest';
import {
  TransferError,
  findOverlap,
  houseOf,
  isActiveOn,
  membersOn,
  planTransfer,
  type Membership,
} from './house-membership';

const PF = 'house-pf';
const CA = 'house-ca';

function membership(overrides: Partial<Membership> & Pick<Membership, 'id' | 'employeeId'>): Membership {
  return { houseId: PF, startsOn: '2026-01-01', endsOn: null, ...overrides };
}

// Ana: Paulo Freire until 30 June, Carme Aymerich from 1 July (spec scenario 5).
const anaPf = membership({ id: 'm1', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: '2026-06-30' });
const anaCa = membership({ id: 'm2', employeeId: 'ana', houseId: CA, startsOn: '2026-07-01' });
const marta = membership({ id: 'm3', employeeId: 'marta', houseId: CA, startsOn: '2025-09-01' });
const future = membership({ id: 'm4', employeeId: 'pol', houseId: PF, startsOn: '2026-11-01' });
const all = [anaPf, anaCa, marta, future];

describe('isActiveOn', () => {
  it('includes both bounds', () => {
    expect(isActiveOn(anaPf, '2026-01-01')).toBe(true);
    expect(isActiveOn(anaPf, '2026-06-30')).toBe(true);
    expect(isActiveOn(anaPf, '2026-07-01')).toBe(false);
    expect(isActiveOn(anaPf, '2025-12-31')).toBe(false);
  });

  it('treats a missing end as ongoing', () => {
    expect(isActiveOn(anaCa, '2099-01-01')).toBe(true);
  });
});

describe('membersOn', () => {
  it('lists only current members of the given House (scenario 4)', () => {
    expect(membersOn(all, PF, '2026-03-15').map((m) => m.employeeId)).toEqual(['ana']);
    expect(membersOn(all, CA, '2026-03-15').map((m) => m.employeeId)).toEqual(['marta']);
  });

  it('drops a transferred employee from the old House (EC-002)', () => {
    expect(membersOn(all, PF, '2026-09-15').map((m) => m.employeeId)).toEqual([]);
    expect(membersOn(all, CA, '2026-09-15').map((m) => m.employeeId)).toEqual(['ana', 'marta']);
  });

  it('does not list a membership that starts in the future', () => {
    expect(membersOn(all, PF, '2026-10-04').map((m) => m.employeeId)).toEqual([]);
    expect(membersOn(all, PF, '2026-11-01').map((m) => m.employeeId)).toEqual(['pol']);
  });
});

describe('houseOf', () => {
  it('answers for past and later dates (scenario 5)', () => {
    expect(houseOf(all, 'ana', '2026-03-15')).toBe(PF);
    expect(houseOf(all, 'ana', '2026-09-15')).toBe(CA);
    expect(houseOf(all, 'ana', '2025-06-01')).toBeNull();
  });
});

describe('findOverlap', () => {
  it('detects an overlap in another House', () => {
    const candidate = { employeeId: 'ana', startsOn: '2026-06-15', endsOn: null };
    expect(findOverlap([anaPf], candidate)).toBe(anaPf);
  });

  it('detects an overlap in the same House', () => {
    const candidate = { employeeId: 'marta', startsOn: '2026-01-01', endsOn: '2026-02-01' };
    expect(findOverlap([marta], candidate)).toBe(marta);
  });

  it('allows adjacent periods', () => {
    const candidate = { employeeId: 'ana', startsOn: '2026-07-01', endsOn: null };
    expect(findOverlap([anaPf], candidate)).toBeUndefined();
  });

  it('ignores other employees', () => {
    const candidate = { employeeId: 'ana', startsOn: '2026-01-01', endsOn: null };
    expect(findOverlap([marta], candidate)).toBeUndefined();
  });
});

describe('planTransfer', () => {
  const current = membership({ id: 'm1', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01' });

  it('closes the day before and opens in the new House (scenario 8)', () => {
    expect(planTransfer(current, CA, '2026-07-01')).toEqual({
      close: { id: 'm1', endsOn: '2026-06-30' },
      open: { employeeId: 'ana', houseId: CA, startsOn: '2026-07-01' },
    });
  });

  it('never touches the existing start date or House', () => {
    planTransfer(current, CA, '2026-07-01');
    expect(current).toEqual(membership({ id: 'm1', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01' }));
  });

  it('rejects a transfer to the same House', () => {
    expect(() => planTransfer(current, PF, '2026-07-01')).toThrow(TransferError);
    try {
      planTransfer(current, PF, '2026-07-01');
    } catch (error) {
      expect((error as TransferError).reason).toBe('same-house');
    }
  });

  it('rejects a start on or before the current start', () => {
    expect(() => planTransfer(current, CA, '2026-01-01')).toThrow(/starts-too-early/);
    expect(() => planTransfer(current, CA, '2025-12-01')).toThrow(/starts-too-early/);
  });

  it('rejects a membership that already has an end date', () => {
    expect(() => planTransfer(anaPf, CA, '2026-08-01')).toThrow(/already-ending/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/house-membership.test.ts`
Expected: FAIL, "Failed to resolve import './house-membership'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/house-membership.ts
import { addDays, type IsoDate } from './dates';

/**
 * A period during which an employee belongs to a House. Both bounds are
 * inclusive; `endsOn: null` means ongoing. The database forbids overlapping
 * periods for the same employee (one House at a time, BR-002).
 */
export type Membership = {
  id: string;
  employeeId: string;
  houseId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
};

export type MembershipPeriod = Pick<Membership, 'employeeId' | 'startsOn' | 'endsOn'>;

/** A current team member as shown on the team page. */
export type TeamMember = { employeeId: string; fullName: string; startsOn: IsoDate };

const OPEN_END: IsoDate = '9999-12-31';

export function isActiveOn(m: Pick<Membership, 'startsOn' | 'endsOn'>, date: IsoDate): boolean {
  return m.startsOn <= date && date <= (m.endsOn ?? OPEN_END);
}

/** Memberships of `houseId` active on `date`: the team on that day. */
export function membersOn<T extends Membership>(memberships: readonly T[], houseId: string, date: IsoDate): T[] {
  return memberships.filter((m) => m.houseId === houseId && isActiveOn(m, date));
}

/** The House an employee belonged to on `date`, or null. */
export function houseOf(memberships: readonly Membership[], employeeId: string, date: IsoDate): string | null {
  return memberships.find((m) => m.employeeId === employeeId && isActiveOn(m, date))?.houseId ?? null;
}

function overlaps(a: MembershipPeriod, b: MembershipPeriod): boolean {
  return a.startsOn <= (b.endsOn ?? OPEN_END) && b.startsOn <= (a.endsOn ?? OPEN_END);
}

/** Mirrors the database exclusion constraint so callers can show a friendly error. */
export function findOverlap<T extends MembershipPeriod>(existing: readonly T[], candidate: MembershipPeriod): T | undefined {
  return existing.find((m) => m.employeeId === candidate.employeeId && overlaps(m, candidate));
}

export type TransferErrorReason = 'no-current-membership' | 'already-ending' | 'same-house' | 'starts-too-early';

export class TransferError extends Error {
  readonly reason: TransferErrorReason;

  constructor(reason: TransferErrorReason) {
    super(`Invalid transfer: ${reason}`);
    this.name = 'TransferError';
    this.reason = reason;
  }
}

export type TransferPlan = {
  close: { id: string; endsOn: IsoDate };
  open: { employeeId: string; houseId: string; startsOn: IsoDate };
};

/**
 * A transfer ends the ongoing membership the day before `startsOn` and opens a
 * new one. Past periods keep their House and start date (BR-004).
 */
export function planTransfer(current: Membership, toHouseId: string, startsOn: IsoDate): TransferPlan {
  if (current.endsOn !== null) throw new TransferError('already-ending');
  if (current.houseId === toHouseId) throw new TransferError('same-house');
  if (startsOn <= current.startsOn) throw new TransferError('starts-too-early');
  return {
    close: { id: current.id, endsOn: addDays(startsOn, -1) },
    open: { employeeId: current.employeeId, houseId: toHouseId, startsOn },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/house-membership.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/house-membership.ts src/lib/house-membership.test.ts openspec/changes/house-context/tasks.md
git commit -m "feat(membership): add dated House membership rules and transfer planning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Database schema and migration

**Covers:** tasks.md 3.1, 3.2, 3.3, 3.4, 3.5

**Files:**
- Modify: `prisma/schema.prisma` (replace the "No models yet" block)
- Create: `prisma/migrations/<timestamp>_house_context/migration.sql` (generated, then hand-edited)
- Test: `src/lib/houses-migration.test.ts`

**Interfaces:**
- Consumes: `HOUSES` (Task 1).
- Produces: Prisma models `House { id, slug, name }`, `Employee { id, fullName, createdAt }` and `HouseMembership { id, employeeId, houseId, startsOn: Date, endsOn: Date | null }` with accessors `prisma.house`, `prisma.employee` and `prisma.houseMembership`. Ids are UUID strings generated by the database. Tables are `houses`, `employees` and `house_memberships`, with snake_case columns.

- [ ] **Step 1: Make sure `.env.local` exists in the worktree** (see Global Constraints), then run `npm install`.

- [ ] **Step 2: Add the models**

Replace the "Data model" comment block at the end of `prisma/schema.prisma` with:

```prisma
// ── Data model ───────────────────────────────────────────────────────────────

/// One of the two Cases d'Infants. Rows are inserted by the house_context
/// migration; keep them in sync with HOUSES in src/lib/houses.ts.
model House {
  id          String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug        String            @unique
  name        String
  memberships HouseMembership[]

  @@map("houses")
}

/// Minimal on purpose (GDPR minimisation): roles, contact data and the Clerk
/// link arrive with SPEC-002.
model Employee {
  id          String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  fullName    String            @map("full_name")
  createdAt   DateTime          @default(now()) @map("created_at")
  memberships HouseMembership[]

  @@map("employees")
}

/// A period (inclusive dates, endsOn null = ongoing) during which an employee
/// belongs to a House. The migration adds constraints Prisma cannot express:
/// CHECK (ends_on >= starts_on) and an EXCLUDE USING gist constraint that
/// forbids overlapping periods per employee (one House at a time).
/// See prisma/migrations/*_house_context/migration.sql.
model HouseMembership {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId String    @map("employee_id") @db.Uuid
  houseId    String    @map("house_id") @db.Uuid
  startsOn   DateTime  @map("starts_on") @db.Date
  endsOn     DateTime? @map("ends_on") @db.Date
  employee   Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  house      House     @relation(fields: [houseId], references: [id], onDelete: Restrict)

  @@index([houseId, startsOn])
  @@index([employeeId])
  @@map("house_memberships")
}
```

- [ ] **Step 3: Generate the migration without applying it**

Run: `npx prisma migrate dev --create-only --name house_context`
Expected: "Prisma Migrate created the following migration without applying it `<timestamp>_house_context`".

- [ ] **Step 4: Hand-edit the migration**

Append to the end of `prisma/migrations/<timestamp>_house_context/migration.sql`:

```sql
-- Hand-written: Prisma cannot express these. Do not remove.

-- One House at a time (BR-002): no overlapping periods per employee.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "house_memberships"
  ADD CONSTRAINT "house_memberships_period_check"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "house_memberships"
  ADD CONSTRAINT "house_memberships_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  );

-- The two Houses (FR-001). Keep in sync with HOUSES in src/lib/houses.ts.
INSERT INTO "houses" ("slug", "name") VALUES
  ('paulo-freire', 'Paulo Freire'),
  ('carme-aymerich', 'Carme Aymerich');
```

- [ ] **Step 5: Write the failing sync test**

```ts
// src/lib/houses-migration.test.ts
// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOUSES } from './houses';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function houseContextMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_house_context'));
  if (!folder) throw new Error('house_context migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('house_context migration', () => {
  const sql = houseContextMigration();

  it('inserts exactly the Houses listed in HOUSES', () => {
    const inserted = [...sql.matchAll(/\('([a-z-]+)', '([^']+)'\)/g)].map(([, slug, name]) => ({ slug, name }));
    expect(inserted).toEqual(HOUSES.map(({ slug, name }) => ({ slug, name })));
  });

  it('keeps the hand-written membership constraints', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS btree_gist');
    expect(sql).toContain('"house_memberships_period_check"');
    expect(sql).toContain('"house_memberships_no_overlap"');
    expect(sql).toMatch(/daterange\("starts_on", "ends_on", '\[\]'\) WITH &&/);
  });
});
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/lib/houses-migration.test.ts`
Expected: PASS. If it fails, fix the migration SQL (not the test) until the inserted rows match `HOUSES`.

- [ ] **Step 7: Apply the migration to the dev database and regenerate the client**

Run: `npm run db:migrate`
Expected: "Applying migration `<timestamp>_house_context`" and "Your database is now in sync with your schema", followed by client generation.

- [ ] **Step 8: Confirm there is no drift**

Run: `npx prisma migrate dev --create-only --name drift_check`
Expected: "Already in sync, no schema change or pending migration was found" and no new folder. If Prisma creates a `drift_check` migration that drops the constraints, delete that folder and record the issue in `design.md` Risks. Do not commit it.

- [ ] **Step 9: Verify the constraints by hand on the dev database**

Run each script. Each must fail with the named constraint. The connection closes on error, so nothing is kept.

```bash
cat <<'SQL' | npx prisma db execute --stdin
BEGIN;
INSERT INTO employees (full_name) VALUES ('Constraint Check');
INSERT INTO house_memberships (employee_id, house_id, starts_on)
  SELECT e.id, h.id, DATE '2026-01-01' FROM employees e, houses h
  WHERE e.full_name = 'Constraint Check' AND h.slug = 'paulo-freire';
INSERT INTO house_memberships (employee_id, house_id, starts_on)
  SELECT e.id, h.id, DATE '2026-06-01' FROM employees e, houses h
  WHERE e.full_name = 'Constraint Check' AND h.slug = 'carme-aymerich';
ROLLBACK;
SQL
```
Expected: error containing `house_memberships_no_overlap`.

```bash
cat <<'SQL' | npx prisma db execute --stdin
BEGIN;
INSERT INTO employees (full_name) VALUES ('Constraint Check');
INSERT INTO house_memberships (employee_id, house_id, starts_on, ends_on)
  SELECT e.id, h.id, DATE '2026-06-01', DATE '2026-05-01' FROM employees e, houses h
  WHERE e.full_name = 'Constraint Check' AND h.slug = 'paulo-freire';
ROLLBACK;
SQL
```
Expected: error containing `house_memberships_period_check`.

Check that deleting an employee deletes their memberships (spec "Employee erasure"):

```bash
cat <<'SQL' | npx prisma db execute --stdin
BEGIN;
INSERT INTO employees (full_name) VALUES ('Constraint Check');
INSERT INTO house_memberships (employee_id, house_id, starts_on)
  SELECT e.id, h.id, DATE '2026-01-01' FROM employees e, houses h
  WHERE e.full_name = 'Constraint Check' AND h.slug = 'paulo-freire';
DELETE FROM employees WHERE full_name = 'Constraint Check';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM house_memberships m LEFT JOIN employees e ON e.id = m.employee_id WHERE e.id IS NULL)
  THEN RAISE EXCEPTION 'orphan memberships after employee delete'; END IF;
END $$;
ROLLBACK;
SQL
```
Expected: "Script executed successfully." (no orphan memberships).

Then confirm nothing was left behind:

```bash
echo "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM employees WHERE full_name = 'Constraint Check') THEN RAISE EXCEPTION 'leftover rows'; END IF; END \$\$;" | npx prisma db execute --stdin
```
Expected: "Script executed successfully." Paste the four outputs into the task report for `verify.md`.

- [ ] **Step 10: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: both pass.

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/houses-migration.test.ts openspec/changes/house-context/tasks.md
git commit -m "feat(db): add House, Employee and HouseMembership with no-overlap constraint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Director gate and no-access page

**Covers:** tasks.md 4.1, 4.2, 4.3, 6.5

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`
- Create: `src/components/no-access.tsx`, `src/components/no-access.test.tsx`, `src/app/(app)/no-access/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (drop the shared `TopBar`)
- Modify: `package.json` / `package-lock.json` (add `lucide-react`)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `NO_ACCESS_PATH = '/no-access'`
  - `isDirector(user: { publicMetadata?: Record<string, unknown> } | null | undefined): boolean`
  - `requireDirector(): Promise<{ userId: string; name: string | null }>`. It calls `redirect('/no-access')` for signed-in non-directors and throws `Error('Not authorized')` when signed out.
  - `requireUser()` is unchanged.
  - `<NoAccess />`

- [ ] **Step 1: Install the icon library**

Run: `npm install lucide-react`
Expected: added to `dependencies` (shadcn's `components.json` already declares `iconLibrary: lucide`).

- [ ] **Step 2: Write the failing auth test**

```ts
// src/lib/auth.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NO_ACCESS_PATH, isDirector, requireDirector } from './auth';

vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

function user(publicMetadata: Record<string, unknown>) {
  return { id: 'user_1', firstName: 'Marta', lastName: 'Soler', publicMetadata } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('isDirector', () => {
  it('is true only for role director', () => {
    expect(isDirector({ publicMetadata: { role: 'director' } })).toBe(true);
    expect(isDirector({ publicMetadata: { role: 'Director' } })).toBe(false);
    expect(isDirector({ publicMetadata: {} })).toBe(false);
    expect(isDirector({})).toBe(false);
    expect(isDirector(null)).toBe(false);
  });
});

describe('requireDirector', () => {
  it('returns the director', async () => {
    vi.mocked(currentUser).mockResolvedValue(user({ role: 'director' }));
    await expect(requireDirector()).resolves.toEqual({ userId: 'user_1', name: 'Marta Soler' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects a signed-in non-director to /no-access', async () => {
    vi.mocked(currentUser).mockResolvedValue(user({}));
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(NO_ACCESS_PATH);
  });

  it('rejects a signed-out request', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    await expect(requireDirector()).rejects.toThrow('Not authorized');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL, "isDirector is not a function" (or a missing export).

- [ ] **Step 4: Implement**

Replace `src/lib/auth.ts` with:

```ts
import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const NO_ACCESS_PATH = '/no-access';

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  publicMetadata?: Record<string, unknown>;
};

function displayName(user: ClerkUserLike): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('Not authorized');
  return { userId: user.id, name: displayName(user) };
}

/** Temporary role check until SPEC-002 models roles: set by hand in the Clerk dashboard. */
export function isDirector(user: { publicMetadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.publicMetadata?.role === 'director';
}

/**
 * Director-only gate for House pages and House data. Everyone else is
 * redirected to /no-access. Call it in every page and data function, not only
 * in a layout: layouts and pages render in parallel, so a layout check alone
 * does not stop a page's queries.
 */
export async function requireDirector() {
  const user = await currentUser();
  if (!user) throw new Error('Not authorized');
  if (!isDirector(user)) redirect(NO_ACCESS_PATH);
  return { userId: user.id, name: displayName(user) };
}
```

- [ ] **Step 5: Run the auth test**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing NoAccess test**

```tsx
// src/components/no-access.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoAccess } from './no-access';

vi.mock('@clerk/nextjs', () => ({ UserButton: () => <button type="button">Compte</button> }));

describe('NoAccess', () => {
  it('explains the block with an icon and text, and offers the account menu', () => {
    render(<NoAccess />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Sense accés');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aquesta zona és només per a la direcció');
    expect(screen.getByRole('button', { name: 'Compte' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/components/no-access.test.tsx`
Expected: FAIL, "Failed to resolve import './no-access'".

- [ ] **Step 8: Implement the component and page**

```tsx
// src/components/no-access.tsx
import { UserButton } from '@clerk/nextjs';
import { Lock } from 'lucide-react';
import { HouseMark } from '@/components/house-mark';
import { TopBar } from '@/components/top-bar';

/** Shown to signed-in users without the director flag (temporary gate, see src/lib/auth.ts). */
export function NoAccess() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar>
        <UserButton />
      </TopBar>
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8">
        <HouseMark className="size-24" />
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error"
        >
          <Lock aria-hidden="true" className="size-4" />
          Sense accés
        </div>
        <h1 className="text-[1.875rem] tracking-[-0.015em]">Aquesta zona és només per a la direcció</h1>
        <p className="text-[0.9375rem] leading-[1.65] text-muted-foreground">
          El teu compte no té permís per veure les cases. Si creus que és un error, parla amb la direcció.
        </p>
      </main>
    </div>
  );
}
```

```tsx
// src/app/(app)/no-access/page.tsx
import type { Metadata } from 'next';
import { NoAccess } from '@/components/no-access';

export const metadata: Metadata = {
  title: "Sense accés · Casa d'Infants",
};

// Deliberately does not call requireDirector(): this is where non-directors land.
export default function NoAccessPage() {
  return <NoAccess />;
}
```

- [ ] **Step 9: Remove the shared top bar from the signed-in layout**

Replace `src/app/(app)/layout.tsx` with:

```tsx
import { requireUser } from '@/lib/auth';

// Everything under the (app) route group requires a signed-in user.
// src/proxy.ts already protects these routes; requireUser() is the
// server-side check. Each child (House layout, no-access page) renders its
// own top bar. Director checks live in each page and data function, because
// layouts and pages render in parallel.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();

  return <div className="min-h-screen bg-background">{children}</div>;
}
```

- [ ] **Step 10: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (`/dashboard` temporarily has no top bar; Task 8 turns it into a redirect.)

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/lib/auth.ts src/lib/auth.test.ts src/components/no-access.tsx src/components/no-access.test.tsx "src/app/(app)/no-access/page.tsx" "src/app/(app)/layout.tsx" openspec/changes/house-context/tasks.md
git commit -m "feat(auth): add temporary director gate and no-access page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Data layer

**Covers:** tasks.md 5.1

**Files:**
- Create: `src/server/membership-store.ts`, `src/server/membership-store.test.ts`
- Create: `src/server/houses.ts`, `src/server/houses.test.ts`

**Interfaces:**
- Consumes: `PrismaClient` type from `@/generated/prisma/client` (Task 4); `IsoDate`, `isoDateToDate`, `dateToIsoDate` (Task 2); `Membership`, `TeamMember`, `membersOn`, `planTransfer`, `TransferError` (Task 3); `requireDirector` (Task 5); `prisma` from `@/lib/prisma`.
- Produces:
  - `membership-store.ts` (no auth, no `server-only`; importable from the seed):
    - `toMembership(row: { id: string; employeeId: string; houseId: string; startsOn: Date; endsOn: Date | null }): Membership`
    - `findCurrentMembers(db: PrismaClient, houseId: string, date: IsoDate): Promise<TeamMember[]>` (sorted by name, Catalan collation)
    - `applyTransfer(db: PrismaClient, employeeId: string, toHouseId: string, startsOn: IsoDate): Promise<void>`
  - `houses.ts` (`server-only`, director-only):
    - `getHouseBySlug(slug: string): Promise<{ id: string; slug: string; name: string } | null>`
    - `listCurrentMembers(houseId: string, date: IsoDate): Promise<TeamMember[]>`
    - `transferEmployee(employeeId: string, toHouseId: string, startsOn: IsoDate): Promise<void>`

- [ ] **Step 1: Write the failing store test**

```ts
// src/server/membership-store.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { TransferError } from '@/lib/house-membership';
import { applyTransfer, findCurrentMembers, toMembership } from './membership-store';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function row(id: string, employeeId: string, fullName: string, houseId: string, startsOn: string, endsOn: string | null) {
  return { id, employeeId, houseId, startsOn: d(startsOn), endsOn: endsOn ? d(endsOn) : null, employee: { id: employeeId, fullName } };
}

describe('toMembership', () => {
  it('maps database dates to IsoDate', () => {
    expect(toMembership(row('m1', 'e1', 'Ana', 'pf', '2026-01-01', '2026-06-30'))).toEqual({
      id: 'm1', employeeId: 'e1', houseId: 'pf', startsOn: '2026-01-01', endsOn: '2026-06-30',
    });
  });
});

describe('findCurrentMembers', () => {
  it('returns only members active on the date, sorted by name', async () => {
    const findMany = vi.fn().mockResolvedValue([
      row('m1', 'e1', 'Ana Puig', 'pf', '2026-01-01', '2026-06-30'),
      row('m2', 'e2', 'Laia Serra', 'pf', '2025-09-01', null),
      row('m3', 'e3', 'Èric Bosch', 'pf', '2025-09-01', null),
      row('m4', 'e4', 'Pol Mas', 'pf', '2026-11-01', null),
    ]);
    const db = { houseMembership: { findMany } } as unknown as PrismaClient;

    const members = await findCurrentMembers(db, 'pf', '2026-10-04');

    expect(findMany).toHaveBeenCalledWith({ where: { houseId: 'pf' }, include: { employee: true } });
    expect(members).toEqual([
      { employeeId: 'e3', fullName: 'Èric Bosch', startsOn: '2025-09-01' },
      { employeeId: 'e2', fullName: 'Laia Serra', startsOn: '2025-09-01' },
    ]);
  });
});

describe('applyTransfer', () => {
  function fakeDb(current: ReturnType<typeof row> | null) {
    const tx = {
      houseMembership: {
        findFirst: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
    return { db: db as unknown as PrismaClient, tx };
  }

  it('closes the ongoing membership and opens the new one in one transaction', async () => {
    const { db, tx } = fakeDb(row('m1', 'e1', 'Ana Puig', 'pf', '2025-09-01', null));

    await applyTransfer(db, 'e1', 'ca', '2026-07-01');

    expect(tx.houseMembership.findFirst).toHaveBeenCalledWith({ where: { employeeId: 'e1', endsOn: null } });
    expect(tx.houseMembership.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { endsOn: d('2026-06-30') } });
    expect(tx.houseMembership.create).toHaveBeenCalledWith({
      data: { employeeId: 'e1', houseId: 'ca', startsOn: d('2026-07-01') },
    });
  });

  it('rejects an employee without an ongoing membership and writes nothing', async () => {
    const { db, tx } = fakeDb(null);
    await expect(applyTransfer(db, 'e1', 'ca', '2026-07-01')).rejects.toThrow(TransferError);
    expect(tx.houseMembership.update).not.toHaveBeenCalled();
    expect(tx.houseMembership.create).not.toHaveBeenCalled();
  });

  it('rejects a same-House transfer and writes nothing', async () => {
    const { db, tx } = fakeDb(row('m1', 'e1', 'Ana Puig', 'pf', '2025-09-01', null));
    await expect(applyTransfer(db, 'e1', 'pf', '2026-07-01')).rejects.toThrow(/same-house/);
    expect(tx.houseMembership.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/membership-store.test.ts`
Expected: FAIL, "Failed to resolve import './membership-store'".

- [ ] **Step 3: Implement the store**

```ts
// src/server/membership-store.ts
//
// Membership persistence with the Prisma client passed in. No auth and no
// `server-only` here so the dev seed can use it; app code must go through
// src/server/houses.ts, which checks the director first.
import type { PrismaClient } from '@/generated/prisma/client';
import { dateToIsoDate, isoDateToDate, type IsoDate } from '@/lib/dates';
import { TransferError, membersOn, planTransfer, type Membership, type TeamMember } from '@/lib/house-membership';

type MembershipRow = { id: string; employeeId: string; houseId: string; startsOn: Date; endsOn: Date | null };

export function toMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    employeeId: row.employeeId,
    houseId: row.houseId,
    startsOn: dateToIsoDate(row.startsOn),
    endsOn: row.endsOn ? dateToIsoDate(row.endsOn) : null,
  };
}

export async function findCurrentMembers(db: PrismaClient, houseId: string, date: IsoDate): Promise<TeamMember[]> {
  const rows = await db.houseMembership.findMany({ where: { houseId }, include: { employee: true } });
  const names = new Map(rows.map((row) => [row.employeeId, row.employee.fullName]));
  return membersOn(rows.map(toMembership), houseId, date)
    .map((m) => ({ employeeId: m.employeeId, fullName: names.get(m.employeeId) ?? '', startsOn: m.startsOn }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ca'));
}

/** Ends the ongoing membership and opens one in `toHouseId`, atomically. Never edits past periods. */
export async function applyTransfer(db: PrismaClient, employeeId: string, toHouseId: string, startsOn: IsoDate): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.houseMembership.findFirst({ where: { employeeId, endsOn: null } });
    if (!current) throw new TransferError('no-current-membership');
    const plan = planTransfer(toMembership(current), toHouseId, startsOn);
    await tx.houseMembership.update({ where: { id: plan.close.id }, data: { endsOn: isoDateToDate(plan.close.endsOn) } });
    await tx.houseMembership.create({
      data: { employeeId: plan.open.employeeId, houseId: plan.open.houseId, startsOn: isoDateToDate(plan.open.startsOn) },
    });
  });
}
```

- [ ] **Step 4: Run the store test**

Run: `npx vitest run src/server/membership-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing gate test for `houses.ts`**

```ts
// src/server/houses.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getHouseBySlug, listCurrentMembers, transferEmployee } from './houses';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    house: { findUnique: vi.fn() },
    houseMembership: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

beforeEach(() => vi.clearAllMocks());

describe('House data for a non-director', () => {
  beforeEach(() => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
  });

  it('stops before any query', async () => {
    await expect(getHouseBySlug('paulo-freire')).rejects.toThrow('NEXT_REDIRECT');
    await expect(listCurrentMembers('pf', '2026-10-04')).rejects.toThrow('NEXT_REDIRECT');
    await expect(transferEmployee('e1', 'ca', '2026-07-01')).rejects.toThrow('NEXT_REDIRECT');
    expect(prisma.house.findUnique).not.toHaveBeenCalled();
    expect(prisma.houseMembership.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('House data for the director', () => {
  beforeEach(() => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
  });

  it('looks a House up by slug', async () => {
    vi.mocked(prisma.house.findUnique).mockResolvedValue({ id: 'pf', slug: 'paulo-freire', name: 'Paulo Freire' } as never);
    await expect(getHouseBySlug('paulo-freire')).resolves.toEqual({ id: 'pf', slug: 'paulo-freire', name: 'Paulo Freire' });
    expect(prisma.house.findUnique).toHaveBeenCalledWith({ where: { slug: 'paulo-freire' } });
  });

  it('lists current members', async () => {
    vi.mocked(prisma.houseMembership.findMany).mockResolvedValue([] as never);
    await expect(listCurrentMembers('pf', '2026-10-04')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/server/houses.test.ts`
Expected: FAIL, "Failed to resolve import './houses'".

- [ ] **Step 7: Implement `houses.ts`**

```ts
// src/server/houses.ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import type { IsoDate } from '@/lib/dates';
import type { TeamMember } from '@/lib/house-membership';
import { prisma } from '@/lib/prisma';
import { applyTransfer, findCurrentMembers } from './membership-store';

// Every function checks the director itself: pages and layouts render in
// parallel, so a check in a parent layout does not protect these queries.

export async function getHouseBySlug(slug: string) {
  await requireDirector();
  return prisma.house.findUnique({ where: { slug } });
}

export async function listCurrentMembers(houseId: string, date: IsoDate): Promise<TeamMember[]> {
  await requireDirector();
  return findCurrentMembers(prisma, houseId, date);
}

export async function transferEmployee(employeeId: string, toHouseId: string, startsOn: IsoDate): Promise<void> {
  await requireDirector();
  await applyTransfer(prisma, employeeId, toHouseId, startsOn);
}
```

- [ ] **Step 8: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/server openspec/changes/house-context/tasks.md
git commit -m "feat(houses): add director-only House data layer and membership store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Dev seed

**Covers:** tasks.md 5.2, 5.3

**Files:**
- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts` (add `migrations.seed`)
- Modify: `package.json` / `package-lock.json` (add `tsx` dev dependency)

**Interfaces:**
- Consumes: `PrismaClient` (`src/generated/prisma/client`), `PrismaPg`, `isoDateToDate` (Task 2), `applyTransfer` (Task 6).
- Produces: in the dev database, six fictional employees, with Ana Puig in Paulo Freire from 2025-09-01 to 2026-06-30 and in Carme Aymerich from 2026-07-01.

- [ ] **Step 1: Install tsx**

Run: `npm install -D tsx`
Expected: `tsx` appears in `devDependencies`.

- [ ] **Step 2: Register the seed command**

In `prisma.config.ts`, change the `migrations` block to:

```ts
  migrations: {
    path: "prisma/migrations",
    // Dev only: fictional people. Run with `npx prisma db seed`.
    seed: "tsx prisma/seed.ts",
  },
```

- [ ] **Step 3: Write the seed**

```ts
// prisma/seed.ts
//
// Dev seed with FICTIONAL people only (GDPR: never seed real staff). Runs the
// real transfer path so Ana's House history is built exactly as the app would.
// Safe to re-run: it does nothing when employees already exist.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { isoDateToDate } from '../src/lib/dates';
import { applyTransfer } from '../src/server/membership-store';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const SEED_START = '2025-09-01';
const ANA_MOVES_ON = '2026-07-01';

// Roles (CT, ER) arrive with SPEC-002; for now they are only noted here.
const PEOPLE = [
  { fullName: 'Ana Puig', house: 'paulo-freire' },
  { fullName: 'Jordi Vidal', house: 'paulo-freire' }, // corretor (CT)
  { fullName: 'Laia Serra', house: 'paulo-freire' }, // ER
  { fullName: 'Marta Soler', house: 'carme-aymerich' },
  { fullName: 'Pau Ferrer', house: 'carme-aymerich' }, // corretor (CT)
  { fullName: 'Núria Costa', house: 'carme-aymerich' },
] as const;

async function main() {
  if ((await db.employee.count()) > 0) {
    console.log('Seed skipped: employees already exist.');
    return;
  }

  const houses = await db.house.findMany();
  const houseId = (slug: string) => {
    const house = houses.find((h) => h.slug === slug);
    if (!house) throw new Error(`House ${slug} is missing: run the migrations first.`);
    return house.id;
  };

  for (const person of PEOPLE) {
    await db.employee.create({
      data: {
        fullName: person.fullName,
        memberships: { create: { houseId: houseId(person.house), startsOn: isoDateToDate(SEED_START) } },
      },
    });
  }

  const ana = await db.employee.findFirstOrThrow({ where: { fullName: 'Ana Puig' } });
  await applyTransfer(db, ana.id, houseId('carme-aymerich'), ANA_MOVES_ON);

  console.log(`Seeded ${PEOPLE.length} fictional employees. Ana Puig moves to Carme Aymerich on ${ANA_MOVES_ON}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 4: Run the seed against the dev database**

Run: `npx prisma db seed`
Expected: "Seeded 6 fictional employees. Ana Puig moves to Carme Aymerich on 2026-07-01." If tsx cannot resolve the `@/` imports inside `membership-store.ts`, confirm that `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }` (tsx reads it). Do not change the import style of `src/`.

- [ ] **Step 5: Check idempotency**

Run: `npx prisma db seed`
Expected: "Seed skipped: employees already exist."

- [ ] **Step 6: Check Ana's history in the database**

```bash
echo "DO \$\$ BEGIN IF (SELECT count(*) FROM house_memberships m JOIN employees e ON e.id = m.employee_id WHERE e.full_name = 'Ana Puig') <> 2 THEN RAISE EXCEPTION 'Ana should have 2 periods'; END IF; END \$\$;" | npx prisma db execute --stdin
```
Expected: "Script executed successfully."

- [ ] **Step 7: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add prisma/seed.ts prisma.config.ts package.json package-lock.json openspec/changes/house-context/tasks.md
git commit -m "chore(db): add dev seed with fictional employees and a transfer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Remembered House and `/dashboard` redirect

**Covers:** tasks.md 6.1, 6.2, 6.3

**Files:**
- Create: `src/lib/active-house.ts`, `src/lib/active-house.test.ts`
- Modify: `src/proxy.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `DEFAULT_HOUSE_SLUG`, `houseSlugFromPath`, `isHouseSlug`, `HouseSlug` (Task 1); `requireDirector` (Task 5).
- Produces:
  - `ACTIVE_HOUSE_COOKIE = 'active-house'`
  - `ACTIVE_HOUSE_COOKIE_MAX_AGE = 31536000`
  - `activeHouseCookieUpdate(pathname: string, current: string | undefined): HouseSlug | null`
  - `resolveDashboardRedirect(cookieValue: string | undefined): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/active-house.test.ts
import { describe, expect, it } from 'vitest';
import { activeHouseCookieUpdate, resolveDashboardRedirect } from './active-house';

describe('activeHouseCookieUpdate', () => {
  it('stores the House when entering a House path', () => {
    expect(activeHouseCookieUpdate('/carme-aymerich/team', undefined)).toBe('carme-aymerich');
    expect(activeHouseCookieUpdate('/carme-aymerich', 'paulo-freire')).toBe('carme-aymerich');
  });

  it('leaves the cookie alone when nothing changes', () => {
    expect(activeHouseCookieUpdate('/carme-aymerich/team', 'carme-aymerich')).toBeNull();
  });

  it('ignores paths outside a House, including wrong case', () => {
    expect(activeHouseCookieUpdate('/dashboard', 'paulo-freire')).toBeNull();
    expect(activeHouseCookieUpdate('/no-access', undefined)).toBeNull();
    expect(activeHouseCookieUpdate('/Carme-Aymerich', undefined)).toBeNull();
  });
});

describe('resolveDashboardRedirect', () => {
  it('returns to the remembered House', () => {
    expect(resolveDashboardRedirect('carme-aymerich')).toBe('/carme-aymerich');
  });

  it('falls back to Paulo Freire without a valid cookie', () => {
    expect(resolveDashboardRedirect(undefined)).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('')).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('casa-inexistent')).toBe('/paulo-freire');
  });

  it('never redirects to a tampered value', () => {
    expect(resolveDashboardRedirect('//evil.example')).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('https://evil.example')).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('../paulo-freire')).toBe('/paulo-freire');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/active-house.test.ts`
Expected: FAIL, "Failed to resolve import './active-house'".

- [ ] **Step 3: Implement**

```ts
// src/lib/active-house.ts
//
// The active House lives in the URL. This cookie only remembers the last one
// so /dashboard can send the director back to it. It is never used to
// authorize or to scope queries.
import { DEFAULT_HOUSE_SLUG, houseSlugFromPath, isHouseSlug, type HouseSlug } from './houses';

export const ACTIVE_HOUSE_COOKIE = 'active-house';
export const ACTIVE_HOUSE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The slug to store for this request, or null to leave the cookie as it is. */
export function activeHouseCookieUpdate(pathname: string, current: string | undefined): HouseSlug | null {
  const slug = houseSlugFromPath(pathname);
  return slug && slug !== current ? slug : null;
}

/** Only known slugs are ever echoed, so a tampered cookie cannot cause an open redirect. */
export function resolveDashboardRedirect(cookieValue: string | undefined): string {
  return `/${isHouseSlug(cookieValue) ? cookieValue : DEFAULT_HOUSE_SLUG}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/active-house.test.ts`
Expected: PASS.

- [ ] **Step 5: Set the cookie in the proxy**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` ("Using Cookies") first. Then replace `src/proxy.ts` with:

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  ACTIVE_HOUSE_COOKIE,
  ACTIVE_HOUSE_COOKIE_MAX_AGE,
  activeHouseCookieUpdate,
} from '@/lib/active-house';

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Clerk auto-detects this file and runs auth on matched routes.
const isPublic = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }

  // Remember the last visited House for the /dashboard redirect. Server
  // Components cannot set cookies, so this is the one place that can.
  const slug = activeHouseCookieUpdate(req.nextUrl.pathname, req.cookies.get(ACTIVE_HOUSE_COOKIE)?.value);
  if (slug) {
    const response = NextResponse.next();
    response.cookies.set(ACTIVE_HOUSE_COOKIE, slug, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACTIVE_HOUSE_COOKIE_MAX_AGE,
    });
    return response;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Clerk's auto-proxy path
    '/__clerk/:path*',
  ],
};
```

- [ ] **Step 6: Turn `/dashboard` into the redirect**

Replace `src/app/(app)/dashboard/page.tsx` with:

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_HOUSE_COOKIE, resolveDashboardRedirect } from '@/lib/active-house';
import { requireDirector } from '@/lib/auth';

// Clerk's after-sign-in redirect lands here: send the director to the last
// House they visited, or to Paulo Freire.
export default async function DashboardPage() {
  await requireDirector();
  const cookieStore = await cookies();
  redirect(resolveDashboardRedirect(cookieStore.get(ACTIVE_HOUSE_COOKIE)?.value));
}
```

- [ ] **Step 7: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass. (`/paulo-freire` returns 404 until Task 10.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/active-house.ts src/lib/active-house.test.ts src/proxy.ts "src/app/(app)/dashboard/page.tsx" openspec/changes/house-context/tasks.md
git commit -m "feat(houses): remember the last House and redirect /dashboard to it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: House switcher, section nav and page header

**Covers:** tasks.md 7.1, 7.2, 7.3

**Files:**
- Create: `src/components/house-switcher.tsx`, `src/components/house-switcher.test.tsx`
- Create: `src/components/section-nav.tsx`, `src/components/section-nav.test.tsx`
- Create: `src/components/house-page-header.tsx`
- Modify: `src/components/top-bar.tsx` (show the middle slot from `md`, the DESIGN.md mobile breakpoint of 768px)

**Interfaces:**
- Consumes: `HOUSES`, `HouseSlug`, `switchHousePath` (Task 1); `cn` from `@/lib/utils`.
- Produces:
  - `<HouseSwitcher activeSlug={HouseSlug} className?={string} />` (client)
  - `SECTIONS: readonly [{ segment: ''; label: 'Inici' }, { segment: 'team'; label: 'Equip' }]`
  - `sectionHref(houseSlug: HouseSlug, segment: string): string`
  - `<SectionNav houseSlug={HouseSlug} />` (client, desktop) and `<BottomTabBar houseSlug={HouseSlug} />` (client, mobile)
  - `<HousePageHeader houseName={string} title={string} />`

- [ ] **Step 1: Write the failing switcher test**

```tsx
// src/components/house-switcher.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HouseSwitcher } from './house-switcher';

vi.mock('next/navigation', () => ({ usePathname: () => '/paulo-freire/team' }));

describe('HouseSwitcher', () => {
  it('shows both Houses and marks the active one', () => {
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    const active = screen.getByRole('link', { name: 'Paulo Freire' });
    const other = screen.getByRole('link', { name: 'Carme Aymerich' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('switches House while keeping the section', () => {
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    expect(screen.getByRole('link', { name: 'Carme Aymerich' })).toHaveAttribute('href', '/carme-aymerich/team');
  });

  it('never uses honey for the active House', () => {
    render(<HouseSwitcher activeSlug="paulo-freire" />);
    const active = screen.getByRole('link', { name: 'Paulo Freire' });
    expect(active.className).toContain('bg-secondary');
    expect(active.className).not.toMatch(/accent/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/house-switcher.test.tsx`
Expected: FAIL, "Failed to resolve import './house-switcher'".

- [ ] **Step 3: Implement the switcher**

```tsx
// src/components/house-switcher.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HOUSES, switchHousePath, type HouseSlug } from '@/lib/houses';
import { cn } from '@/lib/utils';

/**
 * Two-option segmented control: both Houses are always visible, so the active
 * one is unmistakable (FR-002). Plain links, so switching writes nothing.
 */
export function HouseSwitcher({ activeSlug, className }: Readonly<{ activeSlug: HouseSlug; className?: string }>) {
  const pathname = usePathname();

  return (
    <nav aria-label="Casa" className={cn('inline-flex rounded-lg border border-border bg-background p-0.5', className)}>
      {HOUSES.map((house) => {
        const active = house.slug === activeSlug;
        return (
          <Link
            key={house.slug}
            href={switchHousePath(pathname, house.slug)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out md:min-h-8',
              active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {house.name}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the switcher test**

Run: `npx vitest run src/components/house-switcher.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing section-nav test**

```tsx
// src/components/section-nav.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomTabBar, SectionNav, sectionHref } from './section-nav';

const pathname = vi.hoisted(() => ({ value: '/carme-aymerich/team' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

describe('sectionHref', () => {
  it('builds hrefs inside the active House', () => {
    expect(sectionHref('carme-aymerich', '')).toBe('/carme-aymerich');
    expect(sectionHref('carme-aymerich', 'team')).toBe('/carme-aymerich/team');
  });
});

describe.each([
  ['SectionNav', SectionNav],
  ['BottomTabBar', BottomTabBar],
])('%s', (_name, Nav) => {
  it('keeps every link in the active House and marks the current section', () => {
    pathname.value = '/carme-aymerich/team';
    render(<Nav houseSlug="carme-aymerich" />);
    expect(screen.getByRole('link', { name: /Inici/ })).toHaveAttribute('href', '/carme-aymerich');
    const team = screen.getByRole('link', { name: /Equip/ });
    expect(team).toHaveAttribute('href', '/carme-aymerich/team');
    expect(team).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Inici/ })).not.toHaveAttribute('aria-current');
  });

  it('marks Inici only on the House home', () => {
    pathname.value = '/carme-aymerich';
    render(<Nav houseSlug="carme-aymerich" />);
    expect(screen.getByRole('link', { name: /Inici/ })).toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/section-nav.test.tsx`
Expected: FAIL, "Failed to resolve import './section-nav'".

- [ ] **Step 7: Implement the section nav**

```tsx
// src/components/section-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users } from 'lucide-react';
import type { HouseSlug } from '@/lib/houses';
import { cn } from '@/lib/utils';

// House sections. New House-scoped features add an entry here and a route
// under src/app/(app)/[house]/<segment>.
export const SECTIONS = [
  { segment: '', label: 'Inici', icon: Home },
  { segment: 'team', label: 'Equip', icon: Users },
] as const;

export function sectionHref(houseSlug: HouseSlug, segment: string): string {
  return segment ? `/${houseSlug}/${segment}` : `/${houseSlug}`;
}

function isCurrent(pathname: string, houseSlug: HouseSlug, segment: string): boolean {
  const href = sectionHref(houseSlug, segment);
  return segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}

/** Desktop: nav pills in the top bar. */
export function SectionNav({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seccions" className="flex items-center gap-1">
      {SECTIONS.map(({ segment, label }) => {
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={label}
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

/** Mobile: bottom tab bar (DESIGN.md: no sidebar). */
export function BottomTabBar({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seccions"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {SECTIONS.map(({ segment, label, icon: Icon }) => {
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={label}
            href={sectionHref(houseSlug, segment)}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150 ease-out',
              current ? 'text-primary' : 'text-muted-foreground',
            )}
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

- [ ] **Step 8: Run the section-nav test**

Run: `npx vitest run src/components/section-nav.test.tsx`
Expected: PASS.

- [ ] **Step 9: Add the page header**

```tsx
// src/components/house-page-header.tsx

/** House name as a micro eyebrow above the Fraunces page title, so the active House is always visible. */
export function HousePageHeader({ houseName, title }: Readonly<{ houseName: string; title: string }>) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{houseName}</p>
      <h1 className="text-[1.875rem] tracking-[-0.015em]">{title}</h1>
    </header>
  );
}
```

- [ ] **Step 10: Align the top bar breakpoint with DESIGN.md**

In `src/components/top-bar.tsx`, change the middle slot's classes from `hidden flex-1 items-center gap-1.5 overflow-hidden text-sm font-medium text-muted-foreground sm:flex` to `hidden flex-1 items-center gap-3 overflow-hidden text-sm font-medium text-muted-foreground md:flex`.

- [ ] **Step 11: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add src/components openspec/changes/house-context/tasks.md
git commit -m "feat(ui): add House switcher, section nav and House page header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: House layout and Inici page

**Covers:** tasks.md 6.4, 8.1

**Files:**
- Create: `src/app/(app)/[house]/layout.tsx`
- Create: `src/app/(app)/[house]/page.tsx`

**Interfaces:**
- Consumes: `findHouseBySlug` (Task 1); `requireDirector` (Task 5); `HouseSwitcher`, `SectionNav`, `BottomTabBar`, `HousePageHeader` (Task 9); `TopBar`.
- Produces: routes `/paulo-freire` and `/carme-aymerich` (Inici). Any child route under `[house]/` gets the top bar, switcher and nav.

- [ ] **Step 1: Read the Next docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` and `layout.md` (`params` is a Promise).

- [ ] **Step 2: Add the House layout**

```tsx
// src/app/(app)/[house]/layout.tsx
import { notFound } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { HouseSwitcher } from '@/components/house-switcher';
import { BottomTabBar, SectionNav } from '@/components/section-nav';
import { TopBar } from '@/components/top-bar';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';

// Every route under /[house] runs in the context of that House (FR-004,
// FR-005). Pages still call requireDirector() themselves: layouts and pages
// render in parallel.
export default async function HouseLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <TopBar
        breadcrumb={
          <>
            <HouseSwitcher activeSlug={house.slug} />
            <SectionNav houseSlug={house.slug} />
          </>
        }
      >
        <UserButton />
      </TopBar>
      <div className="border-b border-border bg-card px-4 py-2 md:hidden">
        <HouseSwitcher activeSlug={house.slug} className="flex w-full" />
      </div>
      {children}
      <BottomTabBar houseSlug={house.slug} />
    </div>
  );
}
```

- [ ] **Step 3: Add the Inici page**

```tsx
// src/app/(app)/[house]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';

export const metadata: Metadata = {
  title: "Inici · Casa d'Infants",
};

export default async function HouseHomePage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  const { name } = await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title={name ? `Hola, ${name}` : 'Hola!'} />
      <p className="max-w-xl text-[0.9375rem] leading-[1.65] text-muted-foreground">
        Encara no hi ha res. Aviat hi trobaràs la gestió de vacances i absències de {house.name}.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck, lint, test, build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass. The build lists `/[house]` as a dynamic route (ƒ).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/[house]" openspec/changes/house-context/tasks.md
git commit -m "feat(houses): add House-scoped layout with switcher and Inici page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Team page

**Covers:** tasks.md 8.2, 8.3

**Files:**
- Create: `src/components/team-list.tsx`, `src/components/team-list.test.tsx`
- Create: `src/app/(app)/[house]/team/page.tsx`

**Interfaces:**
- Consumes: `TeamMember` (Task 3); `formatDateCa`, `todayInMadrid` (Task 2); `getHouseBySlug`, `listCurrentMembers` (Task 6); `requireDirector` (Task 5); `HousePageHeader` (Task 9); `HouseMark`.
- Produces: routes `/paulo-freire/team` and `/carme-aymerich/team`, plus `<TeamList houseName={string} members={readonly TeamMember[]} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/team-list.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamList } from './team-list';

describe('TeamList', () => {
  it('lists current members with their start date in Catalan', () => {
    render(
      <TeamList
        houseName="Carme Aymerich"
        members={[
          { employeeId: 'e1', fullName: 'Ana Puig', startsOn: '2026-07-01' },
          { employeeId: 'e2', fullName: 'Marta Soler', startsOn: '2025-09-01' },
        ]}
      />,
    );
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ana Puig');
    expect(items[0]).toHaveTextContent('Des del 1 de juliol del 2026');
    expect(within(items[0]).getByText(/Des del/)).toHaveClass('tabular-nums');
  });

  it('shows a warm empty state', () => {
    render(<TeamList houseName="Paulo Freire" members={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText("Encara no hi ha ningú a l'equip de Paulo Freire.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/team-list.test.tsx`
Expected: FAIL, "Failed to resolve import './team-list'".

- [ ] **Step 3: Implement the list**

```tsx
// src/components/team-list.tsx
import { HouseMark } from '@/components/house-mark';
import { formatDateCa } from '@/lib/dates';
import type { TeamMember } from '@/lib/house-membership';

/** Current members of one House (FR-006). Read-only until SPEC-002 adds people management. */
export function TeamList({ houseName, members }: Readonly<{ houseName: string; members: readonly TeamMember[] }>) {
  if (members.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center shadow-clay">
        <HouseMark className="size-24" />
        <p className="text-[0.9375rem] text-muted-foreground">Encara no hi ha ningú a l&apos;equip de {houseName}.</p>
      </section>
    );
  }

  return (
    <section aria-label={`Equip de ${houseName}`} className="rounded-2xl bg-card shadow-clay">
      <ul className="divide-y divide-border">
        {members.map((member) => (
          <li key={member.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <span className="font-semibold text-foreground">{member.fullName}</span>
            <span className="text-sm tabular-nums text-muted-foreground">Des del {formatDateCa(member.startsOn)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run the list test**

Run: `npx vitest run src/components/team-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the team page**

```tsx
// src/app/(app)/[house]/team/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HousePageHeader } from '@/components/house-page-header';
import { TeamList } from '@/components/team-list';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import { getHouseBySlug, listCurrentMembers } from '@/server/houses';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

export default async function TeamPage({ params }: Readonly<{ params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = await getHouseBySlug(slug);
  if (!house) notFound();

  const members = await listCurrentMembers(house.id, todayInMadrid());

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
      <TeamList houseName={house.name} members={members} />
    </main>
  );
}
```

- [ ] **Step 6: Typecheck, lint, test, build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/team-list.tsx src/components/team-list.test.tsx "src/app/(app)/[house]/team" openspec/changes/house-context/tasks.md
git commit -m "feat(houses): add read-only team page with current members

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Docs and verification

**Covers:** tasks.md 9.1, 9.2, 9.3

**Files:**
- Modify: `AGENTS.md`, `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: up-to-date docs and a recorded smoke test.

- [ ] **Step 1: Update `AGENTS.md`**

Replace the intro line "This repo is currently a bare skeleton: auth, a landing page and a protected `/dashboard` placeholder. No domain features yet." with:

```markdown
The House context (SPEC-001, `openspec/changes/house-context/`) is in place: two Houses,
House-scoped routes, dated employee membership and a read-only team page. Other domain
features (APs, calendar, vacations, absences) are not built yet.
```

Replace the `## Layout` section with:

```markdown
## Layout

- `src/app/page.tsx`: public landing page.
- `src/app/(app)/`: signed-in area (layout runs `requireUser()`).
  - `[house]/`: House-scoped area. The first URL segment is the active House
    (`/paulo-freire`, `/carme-aymerich`). **Add House-specific features as
    `[house]/<section>/`** and register the section in `src/components/section-nav.tsx`.
  - `dashboard/`: redirects to the last visited House (`active-house` cookie, set in `src/proxy.ts`).
  - `no-access/`: shown to signed-in users without the director flag.
- `src/lib/houses.ts`: the two Houses (keep in sync with the `house_context` migration).
- `src/lib/dates.ts`: `IsoDate` helpers; "today" is always `todayInMadrid()`.
- `src/lib/house-membership.ts`: pure membership rules (current/historical members, transfers).
- `src/server/houses.ts`: House data, director-only. `src/server/membership-store.ts`: Prisma
  persistence without auth (seed only; app code uses `houses.ts`).
- `src/components/top-bar.tsx`: shared contextual top bar. `src/components/house-mark.tsx`: provisional clay-house mark. `src/components/ui/`: shadcn primitives.

## Access and data rules

- Access is temporary: `requireDirector()` checks Clerk `publicMetadata.role === "director"`
  (set by hand in the Clerk dashboard; currently the director and the developer). **Call it in
  every page and data function**, not only in a layout: layouts and pages render in parallel.
- Every House-scoped record stores its own `houseId` at creation time. Never derive it from an
  employee's current membership (a transfer must not move history).
- One House at a time per employee is enforced by a Postgres exclusion constraint written by
  hand in the `house_context` migration. Prisma does not show it in `schema.prisma`.
```

In the `## Stack` section, replace "The schema has no models yet." with "Models: `House`, `Employee`, `HouseMembership`." and replace "`src/lib/auth.ts` exposes `requireUser()`; roles are not modelled yet." with "`src/lib/auth.ts` exposes `requireUser()` and the temporary `requireDirector()`; roles arrive with SPEC-002."

- [ ] **Step 2: Update `README.md`**

Read `README.md`, then add this section after the database setup instructions (create the heading if no database section exists):

```markdown
### Dev data and access

1. Apply migrations: `npm run db:migrate` (creates the two Houses).
2. Seed fictional employees (dev only): `npx prisma db seed`. Re-running does nothing once employees exist.
3. In the Clerk dashboard, open your user → **Metadata** → **Public** and set:

   ```json
   { "role": "director" }
   ```

   Without it you will land on the "Sense accés" page.
```

- [ ] **Step 3: Run the full verification suite**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass. Record the test count and build route table in the task report.

- [ ] **Step 4: Manual smoke test (dev server)**

Run `npm run dev` and check, as the director (Clerk `role: director`):
1. Sign in: `/dashboard` redirects to `/paulo-freire`.
2. Open Equip: `/paulo-freire/team` lists Jordi Vidal and Laia Serra, but not Ana Puig (today is after 2026-07-01).
3. Click "Carme Aymerich" in the switcher: the URL becomes `/carme-aymerich/team`, and Ana Puig ("Des del 1 de juliol del 2026"), Marta Soler, Núria Costa and Pau Ferrer are listed.
4. Navigate Inici ↔ Equip: the URL stays under `/carme-aymerich`, and the switcher and eyebrow show Carme Aymerich.
5. Open `/dashboard` again: it redirects to `/carme-aymerich`.
6. Open `/casa-inexistent/team`: 404.
7. Narrow the window below 768px: the switcher sits under the top bar, the bottom tab bar shows Inici and Equip, and there is no horizontal scroll.

Then, as a signed-in user **without** the flag:
8. `/paulo-freire/team` redirects to `/no-access`, which shows "Sense accés" with the lock icon, and no employee names appear.

Record each result (pass/fail plus a note) in the task report. If the dev server or a second Clerk account is not available to the executor, mark this step `[~]` deferred and list the automated tests that cover each check, for verify §7.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md openspec/changes/house-context/tasks.md
git commit -m "docs: document House context, director flag and dev seed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
