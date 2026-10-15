# Saldos (SPEC-004) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. `tasks.md` is the change's progress tracker: tick its boxes as each plan task lands (the mapping is given under every task).

**Goal:** Let the director record and delete APs (no recuperables and recuperables) per person and year, with FASI's limits and "Desfés", and show every person's vacation entitlement, AP balances and calendar surplus on a new `/<house>/saldos` page that becomes the House home.

**Architecture:** The rules are pure TypeScript in `src/lib/` (`holidays.ts`, `balances.ts`, `ap-schemas.ts`, `saldos.ts`), unit tested and shared by the page, the form preview and the server. Persistence is a thin Prisma store (`src/server/aps-store.ts`, no auth, reused by the seed) whose `createAp` checks the limits inside a transaction that locks the person row. A director-gated read (`src/server/saldos.ts`) and Server Functions (`src/app/(app)/[house]/saldos/actions.ts`) sit on top. The page renders its frame and an async child inside `<Suspense>`; the client board (`src/components/saldos/`) holds filter, search, the person `Sheet`, the "Apuntar AP" `Dialog` and the undo toast.

**Tech Stack:** Next.js 16.4 App Router (Server Functions, `revalidatePath`), React 19.2 (`useEffectEvent`, `useTransition`), TypeScript, Tailwind v4, Base UI 1.8 (`@base-ui/react/dialog`, already installed), Prisma 7.10 + `@prisma/adapter-pg`, Postgres 16 (local throwaway for checks), Clerk, react-hook-form 7 + zod 4 + `@hookform/resolvers` 5, Vitest 4 + Testing Library, lucide-react.

**Spec:** `openspec/changes/saldos/`: `proposal.md`, `design.md` (decisions D1 to D14), `specs/ap-balances/spec.md`, `specs/house-context/spec.md`, `tasks.md`; decision log in `brainstorm.md`. Domain: `docs/domain.md`. Approved UI: `public/prototypes/saldos.html`. Read `AGENTS.md` and `DESIGN.md` before any UI work.

## Global Constraints

- UI copy in **Catalan**; code, identifiers, comments, commit messages and docs in **English**. No em-dashes in code comments, commit messages or logs. Conventional commits; npm. End every commit message with the two attribution lines of the session (`Co-Authored-By: …` and `Claude-Session: …`) as given by the harness.
- **No new npm dependencies.** `@base-ui/react` 1.8.0 is already a dependency (Dialog lives at `@base-ui/react/dialog`).
- `requireDirector()` is called by the page's data child, by `getSaldos()` and by every Server Function itself (AGENTS.md). Server Functions check the House slug, re-parse their input with the form's zod schema, and check the person belongs to the route's House or to a shared post.
- After a write: `revalidatePath('/[house]/saldos', 'page')`; never `router.refresh()`; never `revalidateTag(tag)` with one argument.
- The page must survive Cache Components: no route segment config; `params`, `searchParams`, `requireDirector()` and `getSaldos()` are read inside an async child under `<Suspense>`.
- Next 16: `params` and `searchParams` are Promises. A `'use client'` module exports client references: constants and functions a Server Component calls live in plain modules.
- AP rules (from `src/lib/rules.ts`, `AP_RULES`): AP no recuperable 24 h a year in at most 5 requests; AP recuperable 24 h a year in at most 3 requests; one request 0:01 to 24:00 (1 to 1440 minutes). An AP counts toward `year` and its date is between `YYYY-01-01` and `(YYYY+1)-01-31`. An APR is never blocked by the surplus.
- Durations are integer minutes, typed `H:MM` (`DurationInput`), shown with `formatDuration` (`3 h 45 min`; signed `+12 h`, `−9 h 15 min` with U+2212). Dates typed and shown `dd/mm/aaaa` (`DateInput`); "today" is `todayInMadrid()`.
- Design (`DESIGN.md`): Fraunces only for headings 20px and up; `tabular-nums` for dates and durations; **no honey (`accent`) anywhere on this page**; errors always icon + text; warnings use the `warning` / `warning-bg` tokens with an icon (text stays `text-foreground`: `#C98A1B` on `#FBEFD3` is below 4.5:1); `rounded-2xl` panels, `rounded-xl` cards (`shadow-clay`), `rounded-lg` buttons and inputs; 150–200ms transitions; no `dark:` utilities.
- GDPR: an AP stores person, House, kind, year, date, minutes, `created_at`; no reason; delete is a real delete. Seeds use fictional people only.
- Overlays: `Sheet` for detail panels; the new `Dialog` (centred on desktop, bottom sheet on mobile) for short forms. App code never uses the shadcn Drawer or Dialog primitives directly.
- Migrations are additive and backward compatible; never edit a merged migration. Agents verify migrations on a **throwaway local Postgres** (block below), never on Supabase.

## Review Focus

1. **Double submit.** The director double-clicks "Apunta-ho" or "Desfés"; she expects one AP, not two. → Task 10 tests that a second click on "Desfés" while the first is pending does not call `undo` again; Task 12 tests that "Apunta-ho" is disabled while the save is pending.
2. **The same January date in two years.** 15/01/2027 is valid for Saldos 2026 (counts toward 2026) and for Saldos 2027; the director expects the "gener 2027" label only on 2026. → Task 4 tests `apDateLabel` for both years.
3. **A shared or moved person's AP recorded in the other House.** Deleting it from this House must work when the person belongs here, whatever `aps.house_id` says; restoring it keeps the original House. → Task 8 tests both.
4. **A stale or foreign `?person=` in the URL** (a person of the other House, an inactive person with no data that year, garbage). The director expects the page without a sheet, not an error. → Task 13 tests it.
5. **A garbage `?year=`** (`abcd`, `1999`, `2101`, two values). The director expects the current year. → Task 11 tests `parseYearParam` and the content child.

## Local Postgres (agents, cloud container)

Postgres 16 binaries exist at `/usr/lib/postgresql/16/bin`. `initdb` refuses root, so the cluster belongs to the `postgres` user and lives outside the session scratchpad:

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
| `src/lib/holidays.ts` (create) | Public holidays per year (2026), `holidayOn(date)` |
| `src/lib/balances.ts` (create) | `ApKind`, `ApRecord`, limits per kind, `personBalances`, `remainingFor`, `checkNewAp`, `apDateWindow`, kind labels |
| `src/lib/ap-schemas.ts` (create) | zod schemas: add (form strings), id, restore snapshot |
| `src/lib/saldos.ts` (create) | `SaldoRow`, `SaldosView`, `buildSaldosView`, totals, `matchesName`, `initials`, `vacationLabel`, `apDateLabel`, `saldosHref` |
| `src/lib/dates.ts` (modify) | + `parseYearParam` (shared by Equip and Saldos) |
| `src/lib/action-result.ts` (modify) | `ActionResult<T = void>`, `ActionFailure` |
| `prisma/schema.prisma` (modify) | + `ApKind` enum, `Ap` model, relations |
| `prisma/migrations/20261015120000_aps/migration.sql` (create) | Enum, table, index, FKs, hand-written CHECKs |
| `src/lib/aps-migration.test.ts` (create) | Keeps the hand-written CHECKs in the migration |
| `src/server/aps-store.ts` (create) | Prisma persistence of APs (no auth): list, find, create with lock, delete, opening balances of many people |
| `src/server/saldos.ts` (create) | Director-gated `getSaldos(house, year)` |
| `src/app/(app)/[house]/saldos/actions.ts` (create) | `addApAction`, `deleteApAction`, `restoreApAction` |
| `src/app/(app)/[house]/saldos/page.tsx` (create) | Frame + `<Suspense>` |
| `src/app/(app)/[house]/saldos/saldos-content.tsx` (create) | Async child: director, House, year, person, `getSaldos()` |
| `src/components/ui/dialog.tsx` (create) | shadcn Dialog primitives, Base UI flavour |
| `src/components/dialog.tsx` (create) | The app's `Dialog` wrapper |
| `src/components/undo-toast.tsx` (create) | Toast with "Desfés" |
| `src/components/callout.tsx` (create) | Error / warning / success message block with icon |
| `src/components/saldos/year-switcher.tsx` (create) | Previous / current / next year links |
| `src/components/saldos/saldos-stats.tsx` (create) | Two stat cards |
| `src/components/saldos/saldos-toolbar.tsx` (create) | Heading, filter, search |
| `src/components/saldos/saldos-table.tsx` (create) | Desktop table and mobile cards, "Deu" chip |
| `src/components/saldos/person-saldo-sheet.tsx` (create) | Person details sheet with AP lists and delete |
| `src/components/saldos/ap-form.tsx` (create) | "Apuntar AP" form |
| `src/components/saldos/saldos-board.tsx` (create) | Client board: state, filters, sheet, dialog, toast |
| `src/lib/sections.ts`, `src/components/section-nav.tsx` (modify) | Saldos available |
| `src/app/(app)/[house]/team/page.tsx` (modify) | Use `parseYearParam` |
| `prisma/seed.ts` (modify) | Fictional 2026 APs |
| `openspec/changes/saldos/db-check.md` (create) | Hand checks (CHECKs, concurrency, browser) |
| `docs/domain.md`, `AGENTS.md`, `README.md` (modify) | Docs |

---

### Task 1: Public holidays in code

**tasks.md:** 1.1

**Files:**
- Create: `src/lib/holidays.ts`
- Test: `src/lib/holidays.test.ts`

**Interfaces:**
- Produces: `HOLIDAYS: Readonly<Record<number, Readonly<Record<IsoDate, string>>>>`, `holidayOn(date: IsoDate): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/holidays.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HOLIDAYS, holidayOn } from './holidays';

describe('holidays', () => {
  it('lists the 16 public holidays of 2026 (Catalonia plus Barcelona, docs/domain.md §9)', () => {
    expect(Object.keys(HOLIDAYS[2026])).toHaveLength(16);
    expect(Object.keys(HOLIDAYS[2026]).every((date) => date.startsWith('2026-'))).toBe(true);
  });

  it('names a holiday', () => {
    expect(holidayOn('2026-12-25')).toBe('Nadal');
    expect(holidayOn('2026-09-24')).toBe('La Mercè');
  });

  it('returns null on a working day', () => {
    expect(holidayOn('2026-12-23')).toBeNull();
  });

  it('returns null for a year without a list (2027 is not official yet)', () => {
    expect(holidayOn('2027-01-01')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/holidays.test.ts`
Expected: FAIL with "Failed to resolve import "./holidays"".

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/holidays.ts
// Public holidays of Catalonia plus Barcelona's local ones, as in the
// director's FESTIUS tab (docs/domain.md §9). One list per year: add the next
// year when the Generalitat and Barcelona publish their calendars. A year with
// no list simply has no holidays here, so no notice is shown.
import type { IsoDate } from './dates';

export const HOLIDAYS: Readonly<Record<number, Readonly<Record<IsoDate, string>>>> = {
  2026: {
    '2026-01-01': "Cap d'Any",
    '2026-01-06': 'Reis',
    '2026-04-03': 'Divendres Sant',
    '2026-04-06': 'Dilluns de Pasqua',
    '2026-05-01': 'Festa del Treball',
    '2026-05-25': 'Segona Pasqua',
    '2026-06-24': 'Sant Joan',
    '2026-08-15': "L'Assumpció",
    '2026-09-11': 'Diada',
    '2026-09-24': 'La Mercè',
    '2026-10-12': "Festa Nacional d'Espanya",
    '2026-11-01': 'Tots Sants',
    '2026-12-06': 'Constitució',
    '2026-12-08': 'La Puríssima',
    '2026-12-25': 'Nadal',
    '2026-12-26': 'Sant Esteve',
  },
};

/** The holiday's name, or null on a working day or a year without a list. */
export function holidayOn(date: IsoDate): string | null {
  return HOLIDAYS[Number(date.slice(0, 4))]?.[date] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/holidays.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/holidays.ts src/lib/holidays.test.ts
git commit -m "feat(rules): add the 2026 public holidays in code"
```

---

### Task 2: Balance rules

**tasks.md:** 1.2

**Files:**
- Create: `src/lib/balances.ts`
- Test: `src/lib/balances.test.ts`

**Interfaces:**
- Consumes: `holidayOn` (Task 1); `AP_RULES`, `OpeningBalances` (`src/lib/rules.ts`); `formatDuration` (`src/lib/duration.ts`); `formatDateDdMmYyyy`, `IsoDate` (`src/lib/dates.ts`); `HouseSlug` (`src/lib/houses.ts`).
- Produces:
  - `AP_KINDS = ['non_recoverable', 'recoverable'] as const`, `type ApKind`, `AP_KIND_LABELS: Record<ApKind, string>` ("AP no recuperable", "AP recuperable"), `MAX_REQUEST_MINUTES = 1440`.
  - `type ApRecord = { id: string; personId: string; house: HouseSlug; kind: ApKind; year: number; date: IsoDate; minutes: number }`.
  - `type KindBalance = { usedMinutes: number; leftMinutes: number; count: number; maxCount: number; capMinutes: number }`.
  - `type PersonBalances = { vacationDays: number; carriedDays: number; vacationTotal: number; nonRecoverable: KindBalance; recoverable: KindBalance; openingSurplusMinutes: number; surplusMinutes: number }`.
  - `personBalances(opening: OpeningBalances, aps: readonly { kind: ApKind; minutes: number }[]): PersonBalances`.
  - `kindBalance(balances: PersonBalances, kind: ApKind): KindBalance`.
  - `remainingFor(balances: PersonBalances, kind: ApKind): { minutes: number; last: boolean } | null`.
  - `apDateWindow(year: number): { first: IsoDate; last: IsoDate }`.
  - `type NewApCheck = { kind: ApKind; year: number; date: IsoDate | null; minutes: number | null }`, `type ApCheck = { errors: string[]; notices: string[]; preview: string | null }`, `checkNewAp(balances: PersonBalances, ap: NewApCheck): ApCheck`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/balances.test.ts`
Expected: FAIL with "Failed to resolve import "./balances"".

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/balances.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balances.ts src/lib/balances.test.ts
git commit -m "feat(rules): compute AP balances and check a new AP"
```

---

### Task 3: AP form schemas

**tasks.md:** 1.3

**Files:**
- Create: `src/lib/ap-schemas.ts`
- Test: `src/lib/ap-schemas.test.ts`

**Interfaces:**
- Consumes: `AP_KINDS`, `MAX_REQUEST_MINUTES` (Task 2); `parseDateDdMmYyyy`, `isIsoDate`, `IsoDate` (`dates.ts`); `parseDuration` (`duration.ts`); `isHouseSlug`, `HouseSlug` (`houses.ts`).
- Produces:
  - `addApSchema`: input `{ personId: string; kind: ApKind; year: number; date: string /* dd/mm/aaaa */; hours: string /* H:MM */ }`, output `{ personId: string; kind: ApKind; year: number; date: IsoDate; minutes: number }`.
  - `apIdSchema`: `{ apId: string }` (UUID).
  - `restoreApSchema` and `type ApSnapshot = { personId: string; kind: ApKind; year: number; date: IsoDate; minutes: number; house: HouseSlug }`.
  - Message constants used by tests and UI: `HOURS_MESSAGE = 'Escriu les hores com H:MM, entre 0:01 i 24:00.'`, `DATE_MESSAGE = 'Escriu la data com dd/mm/aaaa.'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ap-schemas.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DATE_MESSAGE, HOURS_MESSAGE, addApSchema, apIdSchema, restoreApSchema } from './ap-schemas';

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';

describe('addApSchema', () => {
  const input = { personId: ID, kind: 'non_recoverable', year: 2026, date: '20/02/2026', hours: '3:45' };

  it('turns the form strings into domain values', () => {
    expect(addApSchema.parse(input)).toEqual({ personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 225 });
  });

  it('accepts 24:00 in one request', () => {
    expect(addApSchema.parse({ ...input, hours: '24:00' }).minutes).toBe(1440);
  });

  it.each(['9:75', '0:00', '25:00', '3,75', '4', ''])('rejects the hours "%s"', (hours) => {
    const result = addApSchema.safeParse({ ...input, hours });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(HOURS_MESSAGE);
  });

  it.each(['31/02/2026', '2026-02-20', ''])('rejects the date "%s"', (date) => {
    const result = addApSchema.safeParse({ ...input, date });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(DATE_MESSAGE);
  });

  it('asks for a person', () => {
    expect(addApSchema.safeParse({ ...input, personId: '' }).error?.issues[0]?.message).toBe('Tria una persona.');
  });

  it('rejects an unknown kind and a year out of range', () => {
    expect(addApSchema.safeParse({ ...input, kind: 'vacation' }).success).toBe(false);
    expect(addApSchema.safeParse({ ...input, year: 1999 }).success).toBe(false);
  });
});

describe('apIdSchema', () => {
  it('accepts a UUID only', () => {
    expect(apIdSchema.safeParse({ apId: ID }).success).toBe(true);
    expect(apIdSchema.safeParse({ apId: 'x' }).success).toBe(false);
  });
});

describe('restoreApSchema', () => {
  const snapshot = { personId: ID, kind: 'recoverable', year: 2026, date: '2027-01-15', minutes: 120, house: 'paulo-freire' };

  it('accepts the snapshot of a deleted AP', () => {
    expect(restoreApSchema.parse(snapshot)).toEqual(snapshot);
  });

  it.each([{ house: 'nowhere' }, { date: '15/01/2027' }, { minutes: 0 }, { minutes: 1441 }, { year: 1999 }])('rejects %o', (patch) => {
    expect(restoreApSchema.safeParse({ ...snapshot, ...patch }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ap-schemas.test.ts`
Expected: FAIL with "Failed to resolve import "./ap-schemas"".

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/ap-schemas.ts
// One schema per AP form, used by react-hook-form on the client and re-parsed
// by the Server Functions (design D7). Inputs are the raw form strings; outputs
// are domain values. Messages are Catalan UI copy.
import { z } from 'zod';
import { AP_KINDS, MAX_REQUEST_MINUTES } from './balances';
import { isIsoDate, parseDateDdMmYyyy, type IsoDate } from './dates';
import { parseDuration } from './duration';
import { isHouseSlug, type HouseSlug } from './houses';

export const HOURS_MESSAGE = 'Escriu les hores com H:MM, entre 0:01 i 24:00.';
export const DATE_MESSAGE = 'Escriu la data com dd/mm/aaaa.';

const personId = z.uuid('Tria una persona.');
const kind = z.enum(AP_KINDS, "Tria el tipus d'AP.");
const year = z.number().int().min(2000).max(2100);

const date = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const parsed = parseDateDdMmYyyy(value);
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: DATE_MESSAGE });
      return z.NEVER;
    }
    return parsed;
  });

const hours = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const minutes = parseDuration(value);
    if (minutes === null || minutes < 1 || minutes > MAX_REQUEST_MINUTES) {
      ctx.addIssue({ code: 'custom', message: HOURS_MESSAGE });
      return z.NEVER;
    }
    return minutes;
  });

export const addApSchema = z
  .object({ personId, kind, year, date, hours })
  .transform(({ hours: minutes, ...rest }) => ({ ...rest, minutes }));

export const apIdSchema = z.object({ apId: z.uuid('Aquest AP ja no existeix.') });

/** A deleted AP, sent back by "Desfés" (design D6). The server checks the rules again. */
export const restoreApSchema = z.object({
  personId,
  kind,
  year,
  date: z.custom<IsoDate>((value) => typeof value === 'string' && isIsoDate(value)),
  minutes: z.number().int().min(1).max(MAX_REQUEST_MINUTES),
  house: z.custom<HouseSlug>((value) => isHouseSlug(value)),
});

export type ApSnapshot = z.output<typeof restoreApSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ap-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ap-schemas.ts src/lib/ap-schemas.test.ts
git commit -m "feat(saldos): add the AP form schemas shared by client and server"
```

---

### Task 4: Saldos view and its labels

**tasks.md:** 1.4

**Files:**
- Create: `src/lib/saldos.ts`
- Test: `src/lib/saldos.test.ts`

**Interfaces:**
- Consumes: `personBalances`, `ApRecord`, `PersonBalances` (Task 2); `belongsTo`, `PersonRecord` (`src/lib/team.ts`); `findPost`, `ROLE_LABELS` (`posts.ts`); `defaultOpeningBalances`, `OpeningBalances`, `AP_RULES` (`rules.ts`); `formatDateDdMmYyyy`, `weekdayOf`, `IsoDate` (`dates.ts`).
- Produces:
  - `type SaldoRow = { person: PersonRecord; postLabel: string; balances: PersonBalances; aps: readonly ApRecord[] }`.
  - `type SaldosTotals = { apnrUsedMinutes: number; apnrCapMinutes: number; owePeople: number; oweMinutes: number }`.
  - `type SaldosView = { year: number; rows: SaldoRow[]; former: SaldoRow[]; totals: SaldosTotals }`.
  - `buildSaldosView(input: { house: HouseSlug; year: number; people: readonly PersonRecord[]; openings: ReadonlyMap<string, OpeningBalances>; aps: readonly ApRecord[] }): SaldosView`.
  - `matchesName(fullName: string, query: string): boolean`, `initials(fullName: string): string`, `vacationLabel(balances: PersonBalances): string`, `apDateLabel(date: IsoDate, year: number): { text: string; note: string | null }`, `saldosHref(house: HouseSlug, year: number, personId?: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/saldos.test.ts`
Expected: FAIL with "Failed to resolve import "./saldos"".

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/saldos.test.ts`
Expected: PASS. (2026-04-08 is a Wednesday, `dc.`; 2027-01-15 is a Friday, `dv.`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/saldos.ts src/lib/saldos.test.ts
git commit -m "feat(saldos): build the Saldos view, totals and labels"
```

---

### Task 5: The `aps` table

**tasks.md:** 2.1, 2.2

**Files:**
- Modify: `prisma/schema.prisma` (add the enum and model; relations on `House` and `Person`)
- Create: `prisma/migrations/20261015120000_aps/migration.sql`
- Create: `src/lib/aps-migration.test.ts`
- Create: `openspec/changes/saldos/db-check.md`

**Interfaces:**
- Produces: Prisma model `Ap` (`db.ap`), enum `ApKind` (`non_recoverable`, `recoverable`), fields `id`, `personId`, `houseId`, `kind`, `year`, `date` (`DateTime @db.Date`), `minutes`, `createdAt`; relations `person`, `house`; `Person.aps`, `House.aps`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/aps-migration.test.ts
// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function apsMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_aps'));
  if (!folder) throw new Error('aps migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

// Prisma does not show these in schema.prisma (design D1); the database
// rejects impossible rows even if the app has a bug.
describe('aps migration', () => {
  const sql = apsMigration();

  it('keeps the hand-written CHECKs', () => {
    for (const name of ['aps_year_check', 'aps_date_check', 'aps_minutes_check']) {
      expect(sql).toContain(`"${name}"`);
    }
  });

  it('bounds the date to 31 January of the next year (FPOL32 §1)', () => {
    expect(sql).toContain('CHECK ("date" BETWEEN make_date("year", 1, 1) AND make_date("year" + 1, 1, 31))');
  });

  it('bounds one request to 24 h', () => {
    expect(sql).toContain('CHECK ("minutes" BETWEEN 1 AND 1440)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aps-migration.test.ts`
Expected: FAIL with "aps migration not found".

- [ ] **Step 3: Add the model to `prisma/schema.prisma`**

Add `aps Ap[]` to `House` (after `people Person[]`) and to `Person` (after `years PersonYear[]`), then append:

```prisma
/// AP type (SPEC-004, design D1). Adding a type later is an additive
/// ALTER TYPE ... ADD VALUE.
enum ApKind {
  non_recoverable
  recoverable

  @@map("ap_kind")
}

/// An AP (assumpte propi) of a person, counted toward `year` (design D1 to D3).
/// It belongs to the person; houseId is the House where it was recorded and
/// never changes when the person moves. The migration adds CHECKs on year, the
/// date window (1 January of `year` to 31 January of the next, FPOL32 §1) and
/// minutes (1 to 1440). The yearly limits live in src/lib/balances.ts.
model Ap {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  personId  String   @map("person_id") @db.Uuid
  houseId   String   @map("house_id") @db.Uuid
  kind      ApKind
  year      Int
  date      DateTime @db.Date
  minutes   Int
  createdAt DateTime @default(now()) @map("created_at")
  person    Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  house     House    @relation(fields: [houseId], references: [id], onDelete: Restrict)

  @@index([personId, year])
  @@map("aps")
}
```

- [ ] **Step 4: Write the migration**

```sql
-- prisma/migrations/20261015120000_aps/migration.sql
-- CreateEnum
CREATE TYPE "ap_kind" AS ENUM ('non_recoverable', 'recoverable');

-- CreateTable
CREATE TABLE "aps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "kind" "ap_kind" NOT NULL,
    "year" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aps_person_id_year_idx" ON "aps"("person_id", "year");

-- AddForeignKey
ALTER TABLE "aps" ADD CONSTRAINT "aps_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aps" ADD CONSTRAINT "aps_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express these. Do not remove.
ALTER TABLE "aps" ADD CONSTRAINT "aps_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
-- APs of a year can be taken until 31 January of the next year (FPOL32 §1).
ALTER TABLE "aps" ADD CONSTRAINT "aps_date_check" CHECK ("date" BETWEEN make_date("year", 1, 1) AND make_date("year" + 1, 1, 31));
ALTER TABLE "aps" ADD CONSTRAINT "aps_minutes_check" CHECK ("minutes" BETWEEN 1 AND 1440);
```

- [ ] **Step 5: Regenerate the client and run the tests**

Run: `npx prisma generate && npx vitest run src/lib/aps-migration.test.ts && npm run typecheck`
Expected: client generated; PASS (3 tests); typecheck clean.

- [ ] **Step 6: Apply on a throwaway local Postgres and check drift**

Start the local Postgres (block above), then:

```bash
npx prisma migrate deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Expected: both migrations applied; the diff exits 0 ("No difference detected"). This is what CI's Migrations job runs.

- [ ] **Step 7: Check the CHECKs by hand**

```bash
psql -h localhost -p 54329 -U postgres -d casa <<'SQL'
INSERT INTO people (full_name, house_id, post_key, updated_at) SELECT 'Prova AP', id, 'ct', now() FROM houses WHERE slug = 'paulo-freire';
\set p '(SELECT id FROM people WHERE full_name = ''Prova AP'')'
\set h '(SELECT id FROM houses WHERE slug = ''paulo-freire'')'
INSERT INTO aps (person_id, house_id, kind, year, date, minutes) VALUES (:p, :h, 'non_recoverable', 2026, DATE '2027-01-31', 60); -- ok
INSERT INTO aps (person_id, house_id, kind, year, date, minutes) VALUES (:p, :h, 'non_recoverable', 2026, DATE '2027-02-01', 60); -- aps_date_check
INSERT INTO aps (person_id, house_id, kind, year, date, minutes) VALUES (:p, :h, 'non_recoverable', 2026, DATE '2025-12-31', 60); -- aps_date_check
INSERT INTO aps (person_id, house_id, kind, year, date, minutes) VALUES (:p, :h, 'recoverable', 2026, DATE '2026-03-10', 0);    -- aps_minutes_check
INSERT INTO aps (person_id, house_id, kind, year, date, minutes) VALUES (:p, :h, 'recoverable', 2026, DATE '2026-03-10', 1441); -- aps_minutes_check
INSERT INTO aps (person_id, house_id, kind, year, date, minutes) VALUES (:p, :h, 'vacation', 2026, DATE '2026-03-10', 60);     -- invalid enum value
DELETE FROM people WHERE full_name = 'Prova AP'; -- cascades to its APs
SELECT count(*) FROM aps;
SQL
```

Expected: the first insert succeeds; the next five fail with `aps_date_check`, `aps_date_check`, `aps_minutes_check`, `aps_minutes_check` and `invalid input value for enum ap_kind`; the final count is `0`.

- [ ] **Step 8: Record the results**

Create `openspec/changes/saldos/db-check.md`:

```markdown
# Database and browser checks: saldos

Checks that unit tests cannot make, run by hand. Supabase is not touched.

## 1. Migration on a throwaway local Postgres (task 2.2)

- Postgres 16 at `localhost:54329`, database `casa`.
- `npx prisma migrate deploy`: <paste the two applied migration names>
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: <paste output, exit 0>

| Insert | Expected | Result |
|---|---|---|
| 2026 AP dated 31/01/2027, 60 min | accepted | <result> |
| 2026 AP dated 01/02/2027 | `aps_date_check` | <result> |
| 2026 AP dated 31/12/2025 | `aps_date_check` | <result> |
| 0 minutes | `aps_minutes_check` | <result> |
| 1441 minutes | `aps_minutes_check` | <result> |
| kind `vacation` | invalid enum value | <result> |
| Delete the person | APs removed (cascade), count 0 | <result> |
```

Fill in every `<…>` with the real output before committing.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261015120000_aps src/lib/aps-migration.test.ts openspec/changes/saldos/db-check.md
git commit -m "feat(db): add the aps table with year, date window and minutes checks"
```

---

### Task 6: AP store

**tasks.md:** 3.1, 3.2

**Files:**
- Create: `src/server/aps-store.ts`
- Test: `src/server/aps-store.test.ts`
- Modify: `openspec/changes/saldos/db-check.md` (concurrency check)

**Interfaces:**
- Consumes: `checkNewAp`, `personBalances`, `ApKind`, `ApRecord` (Task 2); Prisma `Ap` (Task 5); `defaultOpeningBalances`, `OpeningBalances` (`rules.ts`); `dateToIsoDate`, `isoDateToDate`, `IsoDate` (`dates.ts`); `isHouseSlug`, `HouseSlug`.
- Produces:
  - `class ApRuleError extends Error` (its `message` is Catalan UI copy).
  - `type NewAp = { personId: string; house: HouseSlug; kind: ApKind; year: number; date: IsoDate; minutes: number }`.
  - `createAp(db: PrismaClient, input: NewAp): Promise<string>` (new id).
  - `deleteAp(db: PrismaClient, id: string): Promise<void>`.
  - `findAp(db: PrismaClient, id: string): Promise<ApRecord | null>`.
  - `listApsOf(db: PrismaClient, personIds: readonly string[], year: number): Promise<ApRecord[]>`.
  - `listOpeningBalancesOf(db: PrismaClient, personIds: readonly string[], year: number): Promise<Map<string, OpeningBalances>>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/aps-store.test.ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { ApRuleError, createAp, deleteAp, findAp, listApsOf, listOpeningBalancesOf, type NewAp } from './aps-store';

const PERSON = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';

function fakeDb({
  locked = true,
  stored = null as { vacationDays: number; carriedDays: number; surplusMinutes: number } | null,
  existing = [] as { kind: 'non_recoverable' | 'recoverable'; minutes: number }[],
} = {}) {
  const db = {
    $queryRaw: vi.fn(async () => (locked ? [{ id: PERSON }] : [])),
    house: { findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => ({ id: `id-${where.slug}` })) },
    person: { findUnique: vi.fn(async () => ({ startedOn: null })) },
    personYear: { findUnique: vi.fn(async () => stored), findMany: vi.fn(async () => [] as unknown[]) },
    ap: {
      findMany: vi.fn(async () => existing as unknown[]),
      findUnique: vi.fn(async () => null as unknown),
      create: vi.fn(async () => ({ id: AP_ID })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  return Object.assign(db, { $transaction: vi.fn(async (fn: (tx: typeof db) => unknown) => fn(db)) });
}
const asDb = (db: ReturnType<typeof fakeDb>) => db as unknown as PrismaClient;

const input: NewAp = { personId: PERSON, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240 };

describe('createAp', () => {
  it('locks the person, checks the rules and inserts, in one transaction', async () => {
    const db = fakeDb();
    await expect(createAp(asDb(db), input)).resolves.toBe(AP_ID);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const [strings, ...values] = db.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?')).toContain('FOR UPDATE');
    expect(values).toEqual([PERSON]);
    // The lock comes before reading the APs it protects.
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.ap.findMany.mock.invocationCallOrder[0]);
    expect(db.ap.findMany).toHaveBeenCalledWith({ where: { personId: PERSON, year: 2026 }, select: { kind: true, minutes: true } });
    expect(db.ap.create).toHaveBeenCalledWith({
      data: { personId: PERSON, houseId: 'id-paulo-freire', kind: 'non_recoverable', year: 2026, date: new Date('2026-02-20T00:00:00Z'), minutes: 240 },
      select: { id: true },
    });
  });

  it('rejects a sixth AP no recuperable with the Catalan message', async () => {
    const db = fakeDb({ existing: Array.from({ length: 5 }, () => ({ kind: 'non_recoverable' as const, minutes: 60 })) });
    const error = await createAp(asDb(db), input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApRuleError);
    expect((error as Error).message).toBe("Ja ha fet servir els 5 dies que permet aquest tipus d'AP.");
    expect(db.ap.create).not.toHaveBeenCalled();
  });

  it('never blocks an AP recuperable for lack of surplus (default balances when none are stored)', async () => {
    const db = fakeDb();
    await expect(createAp(asDb(db), { ...input, kind: 'recoverable', minutes: 360 })).resolves.toBe(AP_ID);
  });

  it('uses the stored opening balances of that year', async () => {
    const db = fakeDb({ stored: { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 } });
    await createAp(asDb(db), { ...input, kind: 'recoverable' });
    expect(db.personYear.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId_year: { personId: PERSON, year: 2026 } } }),
    );
  });

  it('rejects an unknown person', async () => {
    const db = fakeDb({ locked: false });
    await expect(createAp(asDb(db), input)).rejects.toThrow(new ApRuleError('Persona desconeguda.'));
    expect(db.ap.create).not.toHaveBeenCalled();
  });
});

describe('reads and delete', () => {
  const row = {
    id: AP_ID,
    personId: PERSON,
    kind: 'recoverable',
    year: 2026,
    date: new Date('2027-01-15T00:00:00Z'),
    minutes: 120,
    house: { slug: 'carme-aymerich' },
  };

  it('maps rows to records with ISO dates and the House slug', async () => {
    const db = fakeDb();
    db.ap.findMany.mockResolvedValueOnce([row]);
    await expect(listApsOf(asDb(db), [PERSON], 2026)).resolves.toEqual([
      { id: AP_ID, personId: PERSON, house: 'carme-aymerich', kind: 'recoverable', year: 2026, date: '2027-01-15', minutes: 120 },
    ]);
    expect(db.ap.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { personId: { in: [PERSON] }, year: 2026 } }));
  });

  it('does not query for nobody', async () => {
    const db = fakeDb();
    await expect(listApsOf(asDb(db), [], 2026)).resolves.toEqual([]);
    await expect(listOpeningBalancesOf(asDb(db), [], 2026)).resolves.toEqual(new Map());
    expect(db.ap.findMany).not.toHaveBeenCalled();
    expect(db.personYear.findMany).not.toHaveBeenCalled();
  });

  it('reads the opening balances of many people', async () => {
    const db = fakeDb();
    db.personYear.findMany.mockResolvedValueOnce([{ personId: PERSON, vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]);
    await expect(listOpeningBalancesOf(asDb(db), [PERSON], 2026)).resolves.toEqual(
      new Map([[PERSON, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]]),
    );
  });

  it('finds one AP or null', async () => {
    const db = fakeDb();
    await expect(findAp(asDb(db), AP_ID)).resolves.toBeNull();
    db.ap.findUnique.mockResolvedValueOnce(row);
    await expect(findAp(asDb(db), AP_ID)).resolves.toMatchObject({ id: AP_ID, date: '2027-01-15' });
  });

  it('deletes by id, quietly when it is already gone', async () => {
    const db = fakeDb();
    await deleteAp(asDb(db), AP_ID);
    expect(db.ap.deleteMany).toHaveBeenCalledWith({ where: { id: AP_ID } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/aps-store.test.ts`
Expected: FAIL with "Failed to resolve import "./aps-store"".

- [ ] **Step 3: Write the implementation**

```ts
// src/server/aps-store.ts
// AP persistence with the Prisma client passed in. No auth and no
// `server-only` here so the dev seed can use it; app code goes through
// src/server/saldos.ts and the Server Functions, which check the director first.
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { checkNewAp, personBalances, type ApKind, type ApRecord } from '@/lib/balances';
import { dateToIsoDate, isoDateToDate, type IsoDate } from '@/lib/dates';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import { defaultOpeningBalances, type OpeningBalances } from '@/lib/rules';

/** A rule stopped the write; the message is Catalan UI copy. */
export class ApRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApRuleError';
  }
}

export type NewAp = { personId: string; house: HouseSlug; kind: ApKind; year: number; date: IsoDate; minutes: number };

const apSelect = {
  id: true,
  personId: true,
  kind: true,
  year: true,
  date: true,
  minutes: true,
  house: { select: { slug: true } },
} satisfies Prisma.ApSelect;

type ApRow = Prisma.ApGetPayload<{ select: typeof apSelect }>;

function toRecord(row: ApRow): ApRecord {
  const { slug } = row.house;
  if (!isHouseSlug(slug)) throw new Error(`Unknown House ${slug}: keep HOUSES and the houses table in sync.`);
  return { id: row.id, personId: row.personId, house: slug, kind: row.kind, year: row.year, date: dateToIsoDate(row.date), minutes: row.minutes };
}

export async function listApsOf(db: PrismaClient, personIds: readonly string[], year: number): Promise<ApRecord[]> {
  if (personIds.length === 0) return [];
  const rows = await db.ap.findMany({
    where: { personId: { in: [...personIds] }, year },
    select: apSelect,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toRecord);
}

export async function listOpeningBalancesOf(db: PrismaClient, personIds: readonly string[], year: number): Promise<Map<string, OpeningBalances>> {
  if (personIds.length === 0) return new Map();
  const rows = await db.personYear.findMany({
    where: { personId: { in: [...personIds] }, year },
    select: { personId: true, vacationDays: true, carriedDays: true, surplusMinutes: true },
  });
  return new Map(rows.map(({ personId, ...balances }) => [personId, balances]));
}

export async function findAp(db: PrismaClient, id: string): Promise<ApRecord | null> {
  const row = await db.ap.findUnique({ where: { id }, select: apSelect });
  return row ? toRecord(row) : null;
}

/**
 * Checks the yearly limits and inserts in one transaction that first locks the
 * person's row (design D5), so two saves at once cannot both pass the limits.
 * Interactive transactions work through the pooled connection (pgbouncer in
 * transaction mode keeps one server connection per transaction).
 */
export async function createAp(db: PrismaClient, input: NewAp): Promise<string> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "people" WHERE "id" = ${input.personId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw new ApRuleError('Persona desconeguda.');
    const person = await tx.person.findUnique({ where: { id: input.personId }, select: { startedOn: true } });
    const house = await tx.house.findUnique({ where: { slug: input.house }, select: { id: true } });
    if (!house) throw new Error(`House ${input.house} is missing: run the migrations first.`);
    const stored = await tx.personYear.findUnique({
      where: { personId_year: { personId: input.personId, year: input.year } },
      select: { vacationDays: true, carriedDays: true, surplusMinutes: true },
    });
    const startedOn = person?.startedOn ? dateToIsoDate(person.startedOn) : null;
    const opening = stored ?? defaultOpeningBalances(input.year, startedOn);
    const existing = await tx.ap.findMany({ where: { personId: input.personId, year: input.year }, select: { kind: true, minutes: true } });
    const { errors } = checkNewAp(personBalances(opening, existing), input);
    if (errors.length > 0) throw new ApRuleError(errors[0]);
    const created = await tx.ap.create({
      data: {
        personId: input.personId,
        houseId: house.id,
        kind: input.kind,
        year: input.year,
        date: isoDateToDate(input.date),
        minutes: input.minutes,
      },
      select: { id: true },
    });
    return created.id;
  });
}

/** A real delete (GDPR minimisation); deleting an AP that is already gone does nothing. */
export async function deleteAp(db: PrismaClient, id: string): Promise<void> {
  await db.ap.deleteMany({ where: { id } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/aps-store.test.ts && npm run typecheck`
Expected: PASS; typecheck clean. If typecheck rejects `kind: row.kind` because the generated enum type differs from `ApKind`, keep the code and check `src/generated/prisma/enums.ts`: Prisma 7 generates `ApKind` as a string-literal union of the same values, which is assignable.

- [ ] **Step 5: Check two concurrent fifth APs on the local Postgres**

With the local Postgres running and migrated (Task 5), create an untracked script at the repo root, `race-check.ts` (do not commit it):

```ts
// race-check.ts (throwaway: delete after use)
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client';
import { createAp } from './src/server/aps-store';

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const house = await db.house.findUniqueOrThrow({ where: { slug: 'paulo-freire' } });
  const person = await db.person.create({ data: { fullName: 'Prova Concurrència', houseId: house.id, postKey: 'ct', active: false } });
  const ap = (date: string) => createAp(db, { personId: person.id, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date, minutes: 60 });
  for (const date of ['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05']) await ap(date);
  const results = await Promise.allSettled([ap('2026-02-06'), ap('2026-02-09')]);
  console.log(results.map((r) => (r.status === 'fulfilled' ? 'saved' : `rejected: ${(r.reason as Error).message}`)));
  console.log('APs stored:', await db.ap.count({ where: { personId: person.id } }));
  await db.person.delete({ where: { id: person.id } });
}

main().finally(() => db.$disconnect());
```

Run: `npx tsx race-check.ts && rm race-check.ts`
Expected: one `saved`, one `rejected: Ja ha fet servir els 5 dies que permet aquest tipus d'AP.`, and `APs stored: 5`.

Append to `openspec/changes/saldos/db-check.md`:

```markdown
## 2. Two concurrent fifth APs (task 3.2)

A person with 4 APs no recuperables in 2026; two `createAp` calls at once for the fifth.

- Output: <paste the two lines>
- Expected: exactly one saved, the other rejected with "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.", 5 APs stored.
```

- [ ] **Step 6: Commit**

```bash
git add src/server/aps-store.ts src/server/aps-store.test.ts openspec/changes/saldos/db-check.md
git commit -m "feat(saldos): add the AP store with the limits checked under a person lock"
```

---

### Task 7: The director-gated read and a generic `ActionResult`

**tasks.md:** 3.3, 3.4

**Files:**
- Create: `src/server/saldos.ts`
- Test: `src/server/saldos.test.ts`
- Modify: `src/lib/action-result.ts`

**Interfaces:**
- Consumes: `listPeopleOf` (`people-store.ts`); `listApsOf`, `listOpeningBalancesOf` (Task 6); `buildSaldosView`, `SaldosView` (Task 4); `requireDirector`.
- Produces:
  - `getSaldos(house: HouseSlug, year: number): Promise<SaldosView>`.
  - `type ActionFailure = { ok: false; message: string }`; `type ActionResult<T = void> = ([T] extends [void] ? { ok: true } : { ok: true; data: T }) | ActionFailure`. Existing callers keep `ActionResult` (= `{ ok: true } | ActionFailure`).

- [ ] **Step 1: Write the failing test**

```ts
// src/server/saldos.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { listApsOf, listOpeningBalancesOf } from './aps-store';
import { listPeopleOf } from './people-store';
import { getSaldos } from './saldos';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('./people-store', () => ({ listPeopleOf: vi.fn(async () => []) }));
vi.mock('./aps-store', () => ({
  listApsOf: vi.fn(async () => []),
  listOpeningBalancesOf: vi.fn(async () => new Map()),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const roger = { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire' as const, postKey: 'et', seat: 1, startedOn: '2025-09-01', active: true };

beforeEach(() => vi.clearAllMocks());

describe('getSaldos', () => {
  it('stops a non-director before any query', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(getSaldos('paulo-freire', 2026)).rejects.toThrow('NEXT_REDIRECT');
    expect(listPeopleOf).not.toHaveBeenCalled();
  });

  it('reads the people, their openings and APs of the year, and builds the view', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    vi.mocked(listPeopleOf).mockResolvedValue([roger]);
    vi.mocked(listOpeningBalancesOf).mockResolvedValue(new Map([[ID, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]]));
    const view = await getSaldos('paulo-freire', 2026);
    expect(listPeopleOf).toHaveBeenCalledWith({}, 'paulo-freire');
    expect(listOpeningBalancesOf).toHaveBeenCalledWith({}, [ID], 2026);
    expect(listApsOf).toHaveBeenCalledWith({}, [ID], 2026);
    expect(view.rows[0].balances.surplusMinutes).toBe(-240);
    expect(view.totals.owePeople).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/saldos.test.ts`
Expected: FAIL with "Failed to resolve import "./saldos"".

- [ ] **Step 3: Write the implementation**

```ts
// src/server/saldos.ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import type { HouseSlug } from '@/lib/houses';
import { prisma } from '@/lib/prisma';
import { buildSaldosView, type SaldosView } from '@/lib/saldos';
import { listApsOf, listOpeningBalancesOf } from './aps-store';
import { listPeopleOf } from './people-store';

/** The Saldos page of a House and year (design D8). Checks the director itself: pages and layouts render in parallel. */
export async function getSaldos(house: HouseSlug, year: number): Promise<SaldosView> {
  await requireDirector();
  const people = await listPeopleOf(prisma, house);
  const ids = people.map((person) => person.id);
  const [openings, aps] = await Promise.all([listOpeningBalancesOf(prisma, ids, year), listApsOf(prisma, ids, year)]);
  return buildSaldosView({ house, year, people, openings, aps });
}
```

Replace `src/lib/action-result.ts` with:

```ts
// src/lib/action-result.ts
export type ActionFailure = { ok: false; message: string };

/**
 * What every Server Function of a form returns: success (with `data` when the
 * function has something to give back, such as a new id), or a Catalan message
 * to show with an icon.
 */
export type ActionResult<T = void> = ([T] extends [void] ? { ok: true } : { ok: true; data: T }) | ActionFailure;
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/server/saldos.test.ts src/app/\(app\)/\[house\]/team && npm run typecheck`
Expected: PASS (the Equip tests still return `{ ok: true }`); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/saldos.ts src/server/saldos.test.ts src/lib/action-result.ts
git commit -m "feat(saldos): add the director-gated Saldos read and a generic action result"
```

---

### Task 8: Server Functions

**tasks.md:** 3.5

**Files:**
- Create: `src/app/(app)/[house]/saldos/actions.ts`
- Test: `src/app/(app)/[house]/saldos/actions.test.ts`

**Interfaces:**
- Consumes: `addApSchema`, `apIdSchema`, `restoreApSchema`, `ApSnapshot` (Task 3); `createAp`, `deleteAp`, `findAp`, `ApRuleError` (Task 6); `findPerson` (`people-store.ts`); `belongsTo` (`team.ts`); `ActionResult` (Task 7).
- Produces:
  - `addApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ id: string }>>`.
  - `deleteApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ removed: ApSnapshot }>>`.
  - `restoreApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ id: string }>>`.
  - Messages: `"Aquesta persona no és d'aquesta casa."`, `'Aquest AP ja no existeix.'`, `"No s'ha pogut desar: revisa les dades."`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/(app)/[house]/saldos/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { requireDirector } from '@/lib/auth';
import * as aps from '@/server/aps-store';
import * as people from '@/server/people-store';
import { addApAction, deleteApAction, restoreApAction } from './actions';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/people-store', () => ({ findPerson: vi.fn(async () => null) }));
vi.mock('@/server/aps-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/aps-store')>()),
  createAp: vi.fn(async () => 'new-ap'),
  deleteAp: vi.fn(),
  findAp: vi.fn(async () => null),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';
const roger = { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire' as const, postKey: 'et', seat: 1, startedOn: null, active: true };
const form = { personId: ID, kind: 'non_recoverable', year: 2026, date: '20/02/2026', hours: '4:00' };
const stored = { id: AP_ID, personId: ID, house: 'paulo-freire' as const, kind: 'non_recoverable' as const, year: 2026, date: '2026-02-20', minutes: 240 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
});

describe('a non-director', () => {
  it('is redirected before anything is read or written', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(addApAction('paulo-freire', form)).rejects.toThrow('NEXT_REDIRECT');
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).rejects.toThrow('NEXT_REDIRECT');
    await expect(restoreApAction('paulo-freire', { ...stored, house: 'paulo-freire' })).rejects.toThrow('NEXT_REDIRECT');
    expect(people.findPerson).not.toHaveBeenCalled();
    expect(aps.createAp).not.toHaveBeenCalled();
    expect(aps.deleteAp).not.toHaveBeenCalled();
  });
});

describe('addApAction', () => {
  it('records an AP in the route House and returns its id', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(addApAction('paulo-freire', form)).resolves.toEqual({ ok: true, data: { id: 'new-ap' } });
    expect(aps.createAp).toHaveBeenCalledWith({}, { personId: ID, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240 });
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/saldos', 'page');
  });

  it('records a shared person from the House the director is in', async () => {
    vi.mocked(people.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    await addApAction('carme-aymerich', form);
    expect(aps.createAp).toHaveBeenCalledWith({}, expect.objectContaining({ house: 'carme-aymerich' }));
  });

  it('rejects a person of the other House', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(addApAction('carme-aymerich', form)).resolves.toEqual({ ok: false, message: "Aquesta persona no és d'aquesta casa." });
    expect(aps.createAp).not.toHaveBeenCalled();
  });

  it('rejects an unknown House and a bad input without reading', async () => {
    expect((await addApAction('nowhere', form)).ok).toBe(false);
    await expect(addApAction('paulo-freire', { ...form, hours: '9:75' })).resolves.toEqual({
      ok: false,
      message: 'Escriu les hores com H:MM, entre 0:01 i 24:00.',
    });
    expect(people.findPerson).not.toHaveBeenCalled();
  });

  it('returns the rule that stopped the write', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    vi.mocked(aps.createAp).mockRejectedValueOnce(new aps.ApRuleError("Ja ha fet servir els 5 dies que permet aquest tipus d'AP."));
    await expect(addApAction('paulo-freire', form)).resolves.toEqual({
      ok: false,
      message: "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteApAction', () => {
  it('deletes and returns what is needed to undo it', async () => {
    vi.mocked(aps.findAp).mockResolvedValue(stored);
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).resolves.toEqual({
      ok: true,
      data: { removed: { personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240, house: 'paulo-freire' } },
    });
    expect(aps.deleteAp).toHaveBeenCalledWith({}, AP_ID);
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/saldos', 'page');
  });

  it('lets this House delete an AP recorded in the other House when the person belongs here', async () => {
    vi.mocked(aps.findAp).mockResolvedValue({ ...stored, house: 'carme-aymerich' });
    vi.mocked(people.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    const result = await deleteApAction('paulo-freire', { apId: AP_ID });
    expect(result).toMatchObject({ ok: true, data: { removed: { house: 'carme-aymerich' } } });
  });

  it('rejects an AP of a person of the other House', async () => {
    vi.mocked(aps.findAp).mockResolvedValue(stored);
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    expect((await deleteApAction('carme-aymerich', { apId: AP_ID })).ok).toBe(false);
    expect(aps.deleteAp).not.toHaveBeenCalled();
  });

  it('says so when the AP is already gone', async () => {
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).resolves.toEqual({ ok: false, message: 'Aquest AP ja no existeix.' });
  });
});

describe('restoreApAction', () => {
  const snapshot = { personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240, house: 'carme-aymerich' };

  it('records the same AP again with its original House', async () => {
    vi.mocked(people.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    await expect(restoreApAction('paulo-freire', snapshot)).resolves.toEqual({ ok: true, data: { id: 'new-ap' } });
    expect(aps.createAp).toHaveBeenCalledWith({}, { personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240, house: 'carme-aymerich' });
  });

  it('fails with the rule when the allowance filled up meanwhile', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    vi.mocked(aps.createAp).mockRejectedValueOnce(new aps.ApRuleError("Ja ha fet servir els 5 dies que permet aquest tipus d'AP."));
    await expect(restoreApAction('paulo-freire', { ...snapshot, house: 'paulo-freire' })).resolves.toEqual({
      ok: false,
      message: "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.",
    });
  });

  it('rejects a tampered snapshot', async () => {
    expect((await restoreApAction('paulo-freire', { ...snapshot, minutes: 5000 })).ok).toBe(false);
    expect(aps.createAp).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(app)/[house]/saldos/actions.test.ts"`
Expected: FAIL with "Failed to resolve import "./actions"".

- [ ] **Step 3: Write the implementation**

```ts
// src/app/(app)/[house]/saldos/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import type { ActionFailure, ActionResult } from '@/lib/action-result';
import { addApSchema, apIdSchema, restoreApSchema, type ApSnapshot } from '@/lib/ap-schemas';
import { requireDirector } from '@/lib/auth';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import { prisma } from '@/lib/prisma';
import { belongsTo } from '@/lib/team';
import * as aps from '@/server/aps-store';
import { findPerson } from '@/server/people-store';

// AP writes (design D7). Server Functions are reachable by direct POST, so each
// one checks the director, validates the House from the route, re-parses its
// input with the form's own schema and checks the person belongs here.

const INVALID = "No s'ha pogut desar: revisa les dades.";
const NOT_HERE = "Aquesta persona no és d'aquesta casa.";
const GONE = 'Aquest AP ja no existeix.';

const fail = (message: string): ActionFailure => ({ ok: false, message });

/** The person, if they belong to `house` or to a shared post. Former members can still be corrected. */
async function belongsHere(house: HouseSlug, personId: string): Promise<boolean> {
  const person = await findPerson(prisma, personId);
  return person !== null && belongsTo(person, house);
}

/** Runs a write; a broken rule becomes its Catalan message. Both Houses show shared people. */
async function write<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | ActionFailure> {
  try {
    const data = await fn();
    revalidatePath('/[house]/saldos', 'page');
    return { ok: true, data };
  } catch (error) {
    if (error instanceof aps.ApRuleError) return fail(error.message);
    throw error;
  }
}

export async function addApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = addApSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
  if (!(await belongsHere(houseSlug, parsed.data.personId))) return fail(NOT_HERE);
  return write(async () => ({ id: await aps.createAp(prisma, { ...parsed.data, house: houseSlug }) }));
}

export async function deleteApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ removed: ApSnapshot }>> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = apIdSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? INVALID);
  const ap = await aps.findAp(prisma, parsed.data.apId);
  if (!ap) return fail(GONE);
  // The person decides, not the House where the AP was recorded (design D7).
  if (!(await belongsHere(houseSlug, ap.personId))) return fail(NOT_HERE);
  return write(async () => {
    await aps.deleteAp(prisma, ap.id);
    const { personId, kind, year, date, minutes, house } = ap;
    return { removed: { personId, kind, year, date, minutes, house } };
  });
}

/** "Desfés" after a delete: the same AP again, with its original House, after checking the rules again (design D6). */
export async function restoreApAction(houseSlug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireDirector();
  if (!isHouseSlug(houseSlug)) return fail(INVALID);
  const parsed = restoreApSchema.safeParse(input);
  if (!parsed.success) return fail(INVALID);
  if (!(await belongsHere(houseSlug, parsed.data.personId))) return fail(NOT_HERE);
  return write(async () => ({ id: await aps.createAp(prisma, parsed.data) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(app)/[house]/saldos/actions.test.ts" && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/[house]/saldos/actions.ts" "src/app/(app)/[house]/saldos/actions.test.ts"
git commit -m "feat(saldos): add the Server Functions to record, delete and restore APs"
```

---

### Task 9: The app's `Dialog`

**tasks.md:** 4.1

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/dialog.tsx`
- Test: `src/components/dialog.test.tsx`

**Interfaces:**
- Consumes: `@base-ui/react/dialog` (`Root`, `Portal`, `Backdrop`, `Popup` with `initialFocus`, `Title`, `Description`, `Close`); `Button`; the existing `Sheet` (test only).
- Produces: `Dialog({ open, onClose, title, description?, children })`. Children render in a scrollable body with no padding (the form adds its own padding and footer). The backdrop has `data-slot="dialog-overlay"`; the close button is labelled "Tanca"; `[data-autofocus]` gets the initial focus.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/dialog.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';
import { Sheet } from './sheet';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={() => {}} title="Apuntar AP">x</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled dialog that closes with Escape, the button and the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Apuntar AP" description="Saldos 2026">
        contingut
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Apuntar AP' });
    expect(dialog).toHaveAccessibleDescription('Saldos 2026');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await userEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('focuses the marked field', async () => {
    render(
      <Dialog open onClose={() => {}} title="Apuntar AP">
        <input aria-label="Dia" data-autofocus />
      </Dialog>,
    );
    await waitFor(() => expect(screen.getByLabelText('Dia')).toHaveFocus());
  });

  // The Saldos board renders the Dialog next to the person Sheet, not inside it.
  it('opens over a Sheet, and Escape closes only the dialog', async () => {
    function Harness() {
      const [sheet, setSheet] = useState(true);
      const [dialog, setDialog] = useState(false);
      return (
        <>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Laia Puig">
            <button type="button" onClick={() => setDialog(true)}>
              Obre el formulari
            </button>
          </Sheet>
          <Dialog open={dialog} onClose={() => setDialog(false)} title="Apuntar AP">
            formulari
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(await screen.findByRole('button', { name: 'Obre el formulari' }));
    expect(await screen.findByRole('dialog', { name: 'Apuntar AP' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Apuntar AP' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Laia Puig' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dialog.test.tsx`
Expected: FAIL with "Failed to resolve import "./dialog"".

- [ ] **Step 3: Write the primitives**

```tsx
// src/components/ui/dialog.tsx
// shadcn/ui Dialog, Base UI flavour (adapted like drawer.tsx): imports `cn`
// from @/lib/utils, the overlay uses the espresso token and the popup fades in
// 200ms (DESIGN.md: 150-200ms). Wrapped by src/components/dialog.tsx; prefer
// that wrapper in app code.
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[70] min-h-dvh bg-foreground/30 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed z-[70] flex flex-col bg-popover text-popover-foreground outline-none transition-[opacity,translate,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-base font-medium text-foreground", className)} {...props} />
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Dialog, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogTitle, DialogDescription }
```

- [ ] **Step 4: Write the app wrapper**

```tsx
// src/components/dialog.tsx
'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogDescription, Dialog as DialogRoot, DialogTitle } from '@/components/ui/dialog';

/**
 * The app's dialog for short forms (SPEC-004 design D10): centred on desktop,
 * a bottom sheet on mobile, always titled, and above an open Sheet. Base UI
 * gives the focus trap, Escape, outside press and focus return.
 * `[data-autofocus]` inside gets the initial focus, else the panel. Use `Sheet`
 * for detail panels.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: Readonly<{ open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }>) {
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        ref={popupRef}
        initialFocus={() => popupRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? popupRef.current}
        className="max-h-[94dvh] bg-card text-[0.9375rem] text-card-foreground shadow-sheet max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:data-ending-style:translate-y-4 max-md:data-starting-style:translate-y-4 md:left-1/2 md:top-1/2 md:w-[32.5rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:data-ending-style:scale-95 md:data-starting-style:scale-95"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 pb-4 pt-5 md:px-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-xl font-semibold">{title}</DialogTitle>
            {description && <DialogDescription className="text-[0.8125rem] tabular-nums">{description}</DialogDescription>}
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Tanca" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </DialogContent>
    </DialogRoot>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/dialog.test.tsx src/components/sheet.test.tsx && npm run typecheck`
Expected: PASS (both files); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/dialog.tsx src/components/dialog.test.tsx
git commit -m "feat(ui): add a centred Dialog for short forms (Base UI)"
```

---

### Task 10: Undo toast and message callout

**tasks.md:** 4.2

**Files:**
- Create: `src/components/undo-toast.tsx`
- Create: `src/components/callout.tsx`
- Test: `src/components/undo-toast.test.tsx`
- Test: `src/components/callout.test.tsx`

**Interfaces:**
- Consumes: `ActionFailure` (Task 7); `SAVE_FAILED_MESSAGE` (`src/components/team/use-server-action.ts`).
- Produces:
  - `TOAST_MS = 6000`; `type ToastMessage = { key: number; text: string; error?: boolean; undo?: () => Promise<{ ok: true } | ActionFailure> }`; `UndoToast({ toast, onDismiss })`. Render it as `<UndoToast key={toast.key} … />` so every message starts fresh.
  - `Callout({ tone: 'error' | 'warning' | 'success', children })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/undo-toast.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_MS, UndoToast } from './undo-toast';

const RULE = "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.";

afterEach(() => vi.useRealTimers());

describe('UndoToast', () => {
  it('shows the message and goes away after 6 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: 1, text: 'Esborrat.' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('Esborrat.');
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('undoes once, even when "Desfés" is pressed twice, and goes away', async () => {
    let resolve!: (result: { ok: true }) => void;
    const undo = vi.fn(() => new Promise<{ ok: true }>((r) => (resolve = r)));
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: 1, text: 'Esborrat.', undo }} onDismiss={onDismiss} />);
    const button = screen.getByRole('button', { name: 'Desfés' });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(undo).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows why an undo failed, with an icon, and stays', async () => {
    const undo = vi.fn(async () => ({ ok: false as const, message: RULE }));
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: 1, text: 'Esborrat.', undo }} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Desfés' }));
    expect(await screen.findByText(RULE)).toBeInTheDocument();
    expect(screen.getByRole('status').querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows an error message without "Desfés"', () => {
    render(<UndoToast toast={{ key: 1, text: 'Aquest AP ja no existeix.', error: true }} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Aquest AP ja no existeix.');
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
  });
});
```

```tsx
// src/components/callout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Callout } from './callout';

describe('Callout', () => {
  it('announces an error, with an icon', () => {
    render(<Callout tone="error">La data ha de ser entre el 01/01/2026 i el 31/01/2027.</Callout>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('La data ha de ser entre el 01/01/2026 i el 31/01/2027.');
    expect(alert.querySelector('svg')).not.toBeNull();
  });

  it('shows a warning with an icon and no alert role', () => {
    const { container } = render(<Callout tone="warning">És festiu (Nadal).</Callout>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/undo-toast.test.tsx src/components/callout.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/callout.tsx
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

// Text stays readable on each background: the warning and success inks are
// too light for small text on their tints, so they only colour the icon.
const TONES = {
  error: { Icon: CircleAlert, box: 'bg-error-bg text-error', icon: '' },
  warning: { Icon: TriangleAlert, box: 'bg-warning-bg text-foreground', icon: 'text-warning' },
  success: { Icon: CircleCheck, box: 'bg-success-bg text-foreground', icon: 'text-success' },
} as const;

/**
 * A message with an icon (DESIGN.md: errors always carry an icon; warnings that
 * need no decision use the warning tokens, never honey).
 */
export function Callout({ tone, children }: Readonly<{ tone: keyof typeof TONES; children: React.ReactNode }>) {
  const { Icon, box, icon } = TONES[tone];
  return (
    <p role={tone === 'error' ? 'alert' : undefined} className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', box)}>
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', icon)} />
      <span>{children}</span>
    </p>
  );
}
```

```tsx
// src/components/undo-toast.tsx
'use client';

import { useEffect, useEffectEvent, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { unstable_rethrow } from 'next/navigation';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { SAVE_FAILED_MESSAGE } from '@/components/team/use-server-action';
import type { ActionFailure } from '@/lib/action-result';

export const TOAST_MS = 6000;

export type ToastMessage = {
  /** A new number for every message: render with `key={toast.key}` so each one starts fresh. */
  key: number;
  text: string;
  error?: boolean;
  undo?: () => Promise<{ ok: true } | ActionFailure>;
};

/** "Desfés" right after a change (docs/domain.md §10, SPEC-004 design D11). */
export function UndoToast({ toast, onDismiss }: Readonly<{ toast: ToastMessage; onDismiss: () => void }>) {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dismiss = useEffectEvent(onDismiss);

  // A failed undo restarts the countdown so its message can be read.
  useEffect(() => {
    const timer = setTimeout(() => dismiss(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [failure]);

  const { undo } = toast;
  const isError = failure !== null || toast.error === true;

  function runUndo() {
    if (!undo) return;
    startTransition(async () => {
      try {
        const result = await undo();
        if (result.ok) onDismiss();
        else setFailure(result.message);
      } catch (error) {
        // Let redirect() (for example to /no-access) keep working.
        unstable_rethrow(error);
        console.error(error);
        setFailure(SAVE_FAILED_MESSAGE);
      }
    });
  }

  // Portalled into <body>: rendered next to an open Sheet it would sit inside
  // the content Base UI hides from screen readers (aria-hidden) while the
  // sheet is open, and "Desfés" right after deleting from the sheet would be
  // unreachable. It only mounts after a user action, so `document` exists.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex justify-center px-4 md:bottom-8">
      <div role="status" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-sheet">
        {isError ? (
          <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-error-bg" />
        ) : (
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-sage" />
        )}
        <p className="flex-1 text-sm">{failure ?? toast.text}</p>
        {undo && failure === null && (
          <button
            type="button"
            onClick={runUndo}
            disabled={pending}
            className="cursor-pointer text-sm font-semibold underline underline-offset-2 disabled:cursor-default disabled:opacity-60"
          >
            Desfés
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass, and lint**

Run: `npx vitest run src/components/undo-toast.test.tsx src/components/callout.test.tsx && npx eslint src/components/undo-toast.tsx src/components/callout.tsx`
Expected: PASS; no lint errors. (`useEffectEvent` is stable in React 19.2 and known to `eslint-plugin-react-hooks` 7: `dismiss` stays out of the effect's dependencies.)

- [ ] **Step 5: Commit**

```bash
git add src/components/undo-toast.tsx src/components/undo-toast.test.tsx src/components/callout.tsx src/components/callout.test.tsx
git commit -m "feat(ui): add the undo toast and a message callout with icons"
```

---

### Task 11: Saldos page, list and navigation

**tasks.md:** 5.1, 5.2, 5.3

**Files:**
- Modify: `src/lib/dates.ts` (+ `parseYearParam`), `src/lib/dates.test.ts`
- Modify: `src/app/(app)/[house]/team/page.tsx` (use `parseYearParam`)
- Modify: `src/lib/sections.ts`, `src/lib/sections.test.ts`, `src/app/(app)/[house]/page.tsx` (comment), `src/app/(app)/[house]/page.test.tsx`
- Create: `src/app/(app)/[house]/saldos/page.tsx`, `src/app/(app)/[house]/saldos/saldos-content.tsx`
- Create: `src/components/saldos/year-switcher.tsx`, `saldos-stats.tsx`, `saldos-toolbar.tsx`, `saldos-table.tsx`, `saldos-board.tsx`
- Test: `src/app/(app)/[house]/saldos/saldos-content.test.tsx`, `src/components/saldos/saldos-board.test.tsx`

**Interfaces:**
- Consumes: `getSaldos` (Task 7); `SaldosView`, `SaldoRow`, `matchesName`, `initials`, `vacationLabel`, `saldosHref`, `buildSaldosView` (Task 4); `formatDuration`; `HousePageHeader`; `Input`.
- Produces:
  - `parseYearParam(value: string | string[] | undefined): number | null`.
  - `SaldosContent({ params, searchParams })` (async Server Component).
  - `SaldosBoard({ houseSlug, houseName, currentYear, view, personId })` (client). Task 13 replaces this file with the full version.
  - `SaldosTable({ houseSlug, year, rows })`, `SurplusValue({ minutes })`, `SaldosStats({ totals, oweOnly, onToggleOwe })`, `SaldosToolbar({ oweOnly, onOweOnlyChange, query, onQueryChange })`, `YearSwitcher({ houseSlug, year, currentYear })`.

- [ ] **Step 1: Write the failing tests**

Add `parseYearParam` to the existing import from `./dates` at the top of `src/lib/dates.test.ts`, then append:

```ts
describe('parseYearParam', () => {
  it('reads a four-digit year from 2000 to 2100', () => {
    expect(parseYearParam('2025')).toBe(2025);
    expect(parseYearParam('2100')).toBe(2100);
  });

  it.each([undefined, '', 'abcd', '1999', '2101', '20250', ['2025', '2027']])('ignores %o', (value) => {
    expect(parseYearParam(value)).toBeNull();
  });
});
```

In `src/lib/sections.test.ts` replace the "opens Equip first until Saldos ships" test with:

```ts
  it('opens Saldos first', () => {
    expect(firstAvailableSection().segment).toBe('saldos');
  });
```

In `src/app/(app)/[house]/page.test.tsx` change the expected redirect to `expect(redirect).toHaveBeenCalledWith('/carme-aymerich/saldos');`.

Create the content test:

```tsx
// src/app/(app)/[house]/saldos/saldos-content.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { getSaldos } from '@/server/saldos';
import { SaldosContent } from './saldos-content';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/server/saldos', () => ({
  getSaldos: vi.fn(async (_house: string, year: number) => ({
    year,
    rows: [],
    former: [],
    totals: { apnrUsedMinutes: 0, apnrCapMinutes: 0, owePeople: 0, oweMinutes: 0 },
  })),
}));
vi.mock('@/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dates')>()),
  todayInMadrid: () => '2026-10-15',
}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

const props = (house: string, searchParams: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ house }),
  searchParams: Promise.resolve(searchParams),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
});

describe('SaldosContent', () => {
  it('rejects a non-director before reading any balance', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(SaldosContent(props('paulo-freire'))).rejects.toThrow('NEXT_REDIRECT');
    expect(getSaldos).not.toHaveBeenCalled();
  });

  it('404s an unknown House without reading', async () => {
    await expect(SaldosContent(props('nowhere'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getSaldos).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 2026],
    [{ year: '2025' }, 2025],
    [{ year: 'abcd' }, 2026],
    [{ year: '1999' }, 2026],
    [{ year: ['2025', '2027'] }, 2026],
  ])('reads %o as the year %i', async (searchParams, year) => {
    await SaldosContent(props('paulo-freire', searchParams));
    expect(getSaldos).toHaveBeenCalledWith('paulo-freire', year);
  });
});
```

Create the board test (its mocks also serve Task 13):

```tsx
// src/components/saldos/saldos-board.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import type { PersonRecord } from '@/lib/team';
import { SaldosBoard } from './saldos-board';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), unstable_rethrow: vi.fn() }));
vi.mock('@/app/(app)/[house]/saldos/actions', () => ({
  addApAction: vi.fn(),
  deleteApAction: vi.fn(),
  restoreApAction: vi.fn(),
}));

const ROGER = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const MERITXELL = '2d8b4c74-3e6a-4b9c-9c73-4f5a9e3a0cb2';
const NURIA = '3e9c5d85-4f7b-4cad-8d84-5a6b0f4b1dc3';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';

const person = (id: string, fullName: string, house: PersonRecord['house'], postKey: string, active = true): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active,
});

const aps: ApRecord[] = [
  { id: AP_ID, personId: DAVID, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-03-18', minutes: 660 },
  { id: 'n1', personId: NURIA, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-02-06', minutes: 480 },
];

const view = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [
    person(ROGER, 'Roger Beltrán Camps', 'paulo-freire', 'et'),
    person(DAVID, 'David Valls Medina', 'paulo-freire', 'en'),
    person(MERITXELL, 'Meritxell Torres Vila', null, 'pdg'),
    person(NURIA, 'Núria Roca Ferrer', 'paulo-freire', 'tfm', false),
  ],
  openings: new Map([
    [ROGER, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }],
    [DAVID, { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 }],
  ]),
  aps,
});

function renderBoard(personId: string | null = null) {
  return render(<SaldosBoard houseSlug="paulo-freire" houseName="Paulo Freire" currentYear={2026} view={view} personId={personId} />);
}

const tableNames = () => within(screen.getAllByRole('table')[0]).getAllByRole('link').map((link) => link.textContent);

beforeEach(() => vi.clearAllMocks());

describe('SaldosBoard list', () => {
  it('shows the House, the year and the year switcher', () => {
    renderBoard();
    expect(screen.getByRole('heading', { level: 1, name: 'Saldos 2026' })).toBeInTheDocument();
    expect(screen.getByText('Paulo Freire')).toBeInTheDocument();
    const years = screen.getByRole('navigation', { name: 'Any' });
    expect(within(years).getByRole('link', { name: '2025' })).toHaveAttribute('href', '/paulo-freire/saldos?year=2025');
    expect(within(years).getByRole('link', { name: '2026' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists each active person with their balances, and who owes hours', () => {
    renderBoard();
    expect(tableNames()).toEqual(['David Valls Medina', 'Meritxell Torres Vila', 'Roger Beltrán Camps']);
    const table = screen.getAllByRole('table')[0];
    const roger = within(table).getByRole('link', { name: 'Roger Beltrán Camps' }).closest('tr')!;
    expect(roger).toHaveTextContent('33 dies (2 AA)');
    expect(roger).toHaveTextContent('Deu 4 h');
    expect(within(table).getByRole('link', { name: 'David Valls Medina' })).toHaveAttribute('href', `/paulo-freire/saldos?year=2026&person=${DAVID}`);
  });

  it('totals the AP hours used and who owes hours', () => {
    renderBoard();
    expect(screen.getByText('AP no recuperables usats').closest('div')).toHaveTextContent('11 hde 72 h de tot l\'equip');
    expect(screen.getByRole('button', { name: /Han de retornar hores/ })).toHaveTextContent('2 persones13 h 15 min en total');
  });

  it('filters the people who owe hours from the stat card and the segmented control', async () => {
    renderBoard();
    await userEvent.click(screen.getByRole('button', { name: /Han de retornar hores/ }));
    expect(tableNames()).toEqual(['David Valls Medina', 'Roger Beltrán Camps']);
    expect(screen.getByRole('button', { name: 'Deuen hores' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Tothom' }));
    expect(tableNames()).toHaveLength(3);
  });

  it('searches ignoring accents and case', async () => {
    renderBoard();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca una persona' }), 'BELTRAN');
    expect(tableNames()).toEqual(['Roger Beltrán Camps']);
  });

  it('says so when nobody matches', async () => {
    renderBoard();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca una persona' }), 'zzz');
    expect(screen.getByText('Ningú coincideix amb aquest filtre.')).toBeInTheDocument();
  });

  it('keeps former members with data apart, under "Antics membres"', () => {
    renderBoard();
    const group = screen.getByText('Antics membres').closest('details')!;
    expect(within(group).getAllByText('Núria Roca Ferrer').length).toBeGreaterThan(0);
    expect(tableNames()).not.toContain('Núria Roca Ferrer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dates.test.ts src/lib/sections.test.ts "src/app/(app)/[house]" src/components/saldos`
Expected: FAIL: `parseYearParam` is not exported; `firstAvailableSection()` is still `team`; the House home still redirects to `/team`; `./saldos-content` and `./saldos-board` cannot be resolved.

- [ ] **Step 3: Add `parseYearParam` and use it on Equip**

Append to `src/lib/dates.ts`:

```ts
/** A `?year=` value: four digits from 2000 to 2100, or null so the page falls back to the current year. */
export function parseYearParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}
```

In `src/app/(app)/[house]/team/page.tsx`: delete the local `parseYear` function, change the dates import to `import { parseYearParam, todayInMadrid } from '@/lib/dates';`, and change `parseYear(yearParam)` to `parseYearParam(yearParam)`.

- [ ] **Step 4: Make Saldos available**

In `src/lib/sections.ts` change the Saldos entry to `{ segment: 'saldos', label: 'Saldos', available: true },`. `src/components/section-nav.tsx` already maps `saldos` to the `Scale` icon (as in the prototypes); leave it. In `src/app/(app)/[house]/page.tsx` change the comment to `// The House home has no screen of its own: it opens the first available section (Saldos).`

- [ ] **Step 5: Write the page and its content child**

```tsx
// src/app/(app)/[house]/saldos/page.tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SaldosContent } from './saldos-content';

export const metadata: Metadata = {
  title: "Saldos · Casa d'Infants",
};

// The frame renders at once; everything that reads the request (params,
// searchParams, the director check and the balances) is inside <Suspense>, so
// the page survives Cache Components (AGENTS.md).
export default function SaldosPage(
  props: Readonly<{
    params: Promise<{ house: string }>;
    searchParams: Promise<{ year?: string | string[]; person?: string | string[] }>;
  }>,
) {
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-8">
      <Suspense fallback={<p className="text-muted-foreground">Carregant els saldos…</p>}>
        <SaldosContent {...props} />
      </Suspense>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/saldos/saldos-content.tsx
import { notFound } from 'next/navigation';
import { SaldosBoard } from '@/components/saldos/saldos-board';
import { requireDirector } from '@/lib/auth';
import { parseYearParam, todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getSaldos } from '@/server/saldos';

/** `?year=<yyyy>` picks the year (default: this year in Madrid); `?person=<id>` opens a person's details. */
export async function SaldosContent({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ house: string }>;
  searchParams: Promise<{ year?: string | string[]; person?: string | string[] }>;
}>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  const { year: yearParam, person } = await searchParams;
  const currentYear = Number(todayInMadrid().slice(0, 4));
  const year = parseYearParam(yearParam) ?? currentYear;
  const view = await getSaldos(house.slug, year);

  return (
    <SaldosBoard
      houseSlug={house.slug}
      houseName={house.name}
      currentYear={currentYear}
      view={view}
      personId={typeof person === 'string' ? person : null}
    />
  );
}
```

- [ ] **Step 6: Write the list components**

```tsx
// src/components/saldos/year-switcher.tsx
import Link from 'next/link';
import type { HouseSlug } from '@/lib/houses';
import { saldosHref } from '@/lib/saldos';
import { cn } from '@/lib/utils';

/** Previous, current and next year, kept in the URL (`?year=`). */
export function YearSwitcher({ houseSlug, year, currentYear }: Readonly<{ houseSlug: HouseSlug; year: number; currentYear: number }>) {
  return (
    <nav aria-label="Any" className="inline-flex self-start rounded-lg border border-border bg-background p-0.5">
      {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
        <Link
          key={y}
          href={saldosHref(houseSlug, y)}
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
  );
}
```

```tsx
// src/components/saldos/saldos-stats.tsx
import { Clock, Hourglass } from 'lucide-react';
import { formatDuration } from '@/lib/duration';
import type { SaldosTotals } from '@/lib/saldos';
import { cn } from '@/lib/utils';

const label = 'flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground';
const value = 'mt-1 block text-[1.5rem] font-[650] leading-tight tabular-nums sm:text-[1.875rem]';
const sub = 'block text-[0.8125rem] tabular-nums text-muted-foreground';

/** Two totals for the active people listed; the second one toggles the "Deuen hores" filter. */
export function SaldosStats({
  totals,
  oweOnly,
  onToggleOwe,
}: Readonly<{ totals: SaldosTotals; oweOnly: boolean; onToggleOwe: () => void }>) {
  const { apnrUsedMinutes, apnrCapMinutes, owePeople, oweMinutes } = totals;
  return (
    <section aria-label="Resum" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:gap-4">
      <div className="rounded-xl bg-card p-4 shadow-clay">
        <p className={label}>
          <Clock aria-hidden="true" className="size-4" />
          AP no recuperables usats
        </p>
        <p className={value}>{formatDuration(apnrUsedMinutes)}</p>
        <p className={sub}>de {formatDuration(apnrCapMinutes)} de tot l&apos;equip</p>
      </div>
      <button
        type="button"
        aria-pressed={oweOnly}
        onClick={onToggleOwe}
        className={cn(
          'rounded-xl bg-card p-4 text-left shadow-clay transition-colors duration-150 ease-out hover:bg-hover',
          oweOnly && 'ring-2 ring-primary',
        )}
      >
        <span className={label}>
          <Hourglass aria-hidden="true" className="size-4" />
          Han de retornar hores
        </span>
        <span className={value}>
          {owePeople} {owePeople === 1 ? 'persona' : 'persones'}
        </span>
        <span className={sub}>
          {owePeople ? `${formatDuration(oweMinutes)} en total, per cobrir necessitats puntuals` : "Ningú té l'excedent en negatiu"}
        </span>
      </button>
    </section>
  );
}
```

```tsx
// src/components/saldos/saldos-toolbar.tsx
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const FILTERS = [
  { oweOnly: false, label: 'Tothom' },
  { oweOnly: true, label: 'Deuen hores' },
] as const;

export function SaldosToolbar({
  oweOnly,
  onOweOnlyChange,
  query,
  onQueryChange,
}: Readonly<{ oweOnly: boolean; onOweOnlyChange: (oweOnly: boolean) => void; query: string; onQueryChange: (query: string) => void }>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <h2 id="saldos-team" className="text-xl">
        Equip
      </h2>
      <div role="group" aria-label="Filtre" className="inline-flex self-start rounded-lg border border-border bg-background p-0.5 sm:ml-4 sm:self-auto">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={oweOnly === filter.oweOnly}
            onClick={() => onOweOnlyChange(filter.oweOnly)}
            className={cn(
              'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out',
              oweOnly === filter.oweOnly ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <label className="relative sm:ml-auto sm:w-64">
        <span className="sr-only">Busca una persona</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Busca una persona" className="pl-9" />
      </label>
    </div>
  );
}
```

```tsx
// src/components/saldos/saldos-table.tsx
import Link from 'next/link';
import { ChevronRight, Hourglass } from 'lucide-react';
import { formatDuration } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { initials, saldosHref, vacationLabel, type SaldoRow } from '@/lib/saldos';
import { cn } from '@/lib/utils';

/** The current surplus: signed, or "Deu …" with an hourglass when the person owes hours (warning tokens, never honey). */
export function SurplusValue({ minutes }: Readonly<{ minutes: number }>) {
  if (minutes >= 0) return <span className="font-semibold tabular-nums">{formatDuration(minutes, { signed: true })}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warning-bg px-2 py-0.5 font-semibold tabular-nums text-foreground">
      <Hourglass aria-hidden="true" className="size-4 text-warning" />
      Deu {formatDuration(-minutes)}
    </span>
  );
}

function Avatar({ name }: Readonly<{ name: string }>) {
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-[0.8125rem] font-semibold text-sage-foreground">
      {initials(name)}
    </span>
  );
}

function Meter({ value, max }: Readonly<{ value: number; max: number }>) {
  const percent = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-sage-foreground/70" style={{ width: `${percent}%` }} />
    </div>
  );
}

function Tile({ label, value, warn = false }: Readonly<{ label: string; value: string; warn?: boolean }>) {
  return (
    <span className={cn('block rounded-lg p-2.5', warn ? 'bg-warning-bg' : 'bg-background')}>
      <span className="block text-muted-foreground">{label}</span>
      <span className="block font-semibold tabular-nums">{value}</span>
    </span>
  );
}

/** Desktop table and mobile cards (DESIGN.md: no sidebar, cards on mobile). Each person opens their details. */
export function SaldosTable({ houseSlug, year, rows }: Readonly<{ houseSlug: HouseSlug; year: number; rows: readonly SaldoRow[] }>) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl bg-card shadow-clay md:block">
        <table className="w-full text-left">
          <thead className="border-b border-border bg-background/60">
            <tr className="text-[0.8125rem] text-muted-foreground">
              <th scope="col" className="py-3 pl-5 pr-3 font-medium">Persona</th>
              <th scope="col" className="w-[16%] px-3 py-3 font-medium">Vacances</th>
              <th scope="col" className="w-[22%] px-3 py-3 font-medium">AP no recuperables</th>
              <th scope="col" className="w-[16%] px-3 py-3 font-medium">AP recuperables</th>
              <th scope="col" className="w-[16%] px-3 py-3 font-medium">Excedent calendari</th>
              <th scope="col" className="w-10 py-3 pr-4"><span className="sr-only">Obre</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, postLabel, balances: b }) => (
              <tr key={person.id} className="relative border-b border-border transition-colors duration-150 ease-out last:border-0 hover:bg-hover">
                <td className="py-3.5 pl-5 pr-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={person.fullName} />
                    <div className="min-w-0">
                      <Link href={saldosHref(houseSlug, year, person.id)} scroll={false} className="font-semibold leading-tight after:absolute after:inset-0">
                        {person.fullName}
                      </Link>
                      <p className="truncate text-[0.8125rem] text-muted-foreground">{postLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-[0.875rem] font-semibold tabular-nums">{vacationLabel(b)}</td>
                <td className="px-3 py-3.5">
                  <Meter value={b.nonRecoverable.usedMinutes} max={b.nonRecoverable.capMinutes} />
                  <p className="mt-1.5 text-[0.8125rem] tabular-nums">
                    <span className="font-semibold">Queden {formatDuration(b.nonRecoverable.leftMinutes)}</span>
                    <span className="text-muted-foreground"> · {b.nonRecoverable.count}/{b.nonRecoverable.maxCount} dies</span>
                  </p>
                </td>
                <td className="px-3 py-3.5 text-[0.875rem] tabular-nums">
                  {b.recoverable.count > 0 ? (
                    `${formatDuration(b.recoverable.usedMinutes)} usades · ${b.recoverable.count}/${b.recoverable.maxCount}`
                  ) : (
                    <span className="text-muted-foreground">Cap</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-[0.875rem]">
                  <SurplusValue minutes={b.surplusMinutes} />
                </td>
                <td className="py-3.5 pr-4 text-muted-foreground">
                  <ChevronRight aria-hidden="true" className="size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map(({ person, postLabel, balances: b }) => (
          <li key={person.id}>
            <Link href={saldosHref(houseSlug, year, person.id)} scroll={false} className="block rounded-xl bg-card p-4 shadow-clay active:bg-hover">
              <span className="flex items-center gap-3">
                <Avatar name={person.fullName} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{person.fullName}</span>
                  <span className="block truncate text-[0.8125rem] text-muted-foreground">{postLabel}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </span>
              <span className="mt-3.5 grid grid-cols-3 gap-2 text-[0.8125rem]">
                <Tile label="Vacances" value={`${b.vacationTotal} dies`} />
                <Tile label="AP no rec." value={formatDuration(b.nonRecoverable.leftMinutes)} />
                <Tile
                  label="Excedent"
                  value={b.surplusMinutes < 0 ? `Deu ${formatDuration(-b.surplusMinutes)}` : formatDuration(b.surplusMinutes, { signed: true })}
                  warn={b.surplusMinutes < 0}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
```

```tsx
// src/components/saldos/saldos-board.tsx
'use client';

import { useState } from 'react';
import { HousePageHeader } from '@/components/house-page-header';
import type { HouseSlug } from '@/lib/houses';
import { matchesName, type SaldoRow, type SaldosView } from '@/lib/saldos';
import { SaldosStats } from './saldos-stats';
import { SaldosTable } from './saldos-table';
import { SaldosToolbar } from './saldos-toolbar';
import { YearSwitcher } from './year-switcher';

/** The Saldos page body (design D9): totals, filter, search, the list and former members. */
export function SaldosBoard({
  houseSlug,
  houseName,
  currentYear,
  view,
}: Readonly<{ houseSlug: HouseSlug; houseName: string; currentYear: number; view: SaldosView; personId: string | null }>) {
  const [oweOnly, setOweOnly] = useState(false);
  const [query, setQuery] = useState('');
  const keep = (row: SaldoRow) => (!oweOnly || row.balances.surplusMinutes < 0) && matchesName(row.person.fullName, query);
  const rows = view.rows.filter(keep);
  const former = view.former.filter(keep);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <HousePageHeader houseName={houseName} title={`Saldos ${view.year}`} />
          <p className="max-w-prose text-muted-foreground">Vacances i hores d&apos;AP de cada persona.</p>
        </div>
        <YearSwitcher houseSlug={houseSlug} year={view.year} currentYear={currentYear} />
      </div>

      <SaldosStats totals={view.totals} oweOnly={oweOnly} onToggleOwe={() => setOweOnly((value) => !value)} />

      <section aria-labelledby="saldos-team" className="flex flex-col gap-3">
        <SaldosToolbar oweOnly={oweOnly} onOweOnlyChange={setOweOnly} query={query} onQueryChange={setQuery} />
        {rows.length > 0 ? (
          <SaldosTable houseSlug={houseSlug} year={view.year} rows={rows} />
        ) : (
          <p className="rounded-2xl bg-card p-8 text-center text-muted-foreground shadow-clay">Ningú coincideix amb aquest filtre.</p>
        )}
      </section>

      {former.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer font-display text-xl">
            Antics membres <span className="font-sans text-[0.8125rem] tabular-nums text-muted-foreground">({former.length})</span>
          </summary>
          <div className="mt-3">
            <SaldosTable houseSlug={houseSlug} year={view.year} rows={former} />
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib "src/app/(app)/[house]" src/components/saldos && npm run typecheck && npm run lint`
Expected: PASS, including `sections.test.ts` ("saldos has a route only when available" now finds `saldos/page.tsx`); typecheck and lint clean. If the stat-card text assertions fail only on whitespace between nodes, keep the copy and adjust the expected strings to the rendered `textContent`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/sections.ts src/lib/sections.test.ts "src/app/(app)/[house]/page.tsx" "src/app/(app)/[house]/page.test.tsx" "src/app/(app)/[house]/team/page.tsx" "src/app/(app)/[house]/saldos/page.tsx" "src/app/(app)/[house]/saldos/saldos-content.tsx" "src/app/(app)/[house]/saldos/saldos-content.test.tsx" src/components/saldos
git commit -m "feat(saldos): list balances per House with totals, filter, search and year"
```

---

### Task 12: "Apuntar AP" form

**tasks.md:** 5.5 (form)

**Files:**
- Create: `src/components/saldos/ap-form.tsx`
- Test: `src/components/saldos/ap-form.test.tsx`

**Interfaces:**
- Consumes: `addApAction` (Task 8); `addApSchema`, `HOURS_MESSAGE` (Task 3); `AP_KINDS`, `AP_KIND_LABELS`, `MAX_REQUEST_MINUTES`, `checkNewAp`, `remainingFor`, `ApKind`, `PersonBalances` (Task 2); `AP_RULES`; `SaldoRow` (Task 4); `Callout` (Task 10); `useServerAction`, `Field`, `ErrorText`, `DateInput`, `DurationInput`, `NativeSelect`, `Button`; `parseDateDdMmYyyy`; `formatDuration`, `parseDuration`, `toDurationText`.
- Produces: `ApForm({ houseSlug, year, rows, initialPersonId, onSaved, onCancel })`, where `onSaved({ id, text })` receives the new AP's id and the toast text ("Apuntat AP no recuperable de 6 h a Meritxell Torres Vila.").

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/saldos/ap-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addApAction } from '@/app/(app)/[house]/saldos/actions';
import { HOURS_MESSAGE } from '@/lib/ap-schemas';
import type { ApKind, ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import type { PersonRecord } from '@/lib/team';
import { ApForm } from './ap-form';

vi.mock('@/app/(app)/[house]/saldos/actions', () => ({
  addApAction: vi.fn(async () => ({ ok: true, data: { id: 'new-ap' } })),
}));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));

const CARLA = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const MERITXELL = '2d8b4c74-3e6a-4b9c-9c73-4f5a9e3a0cb2';
const ROGER = '3e9c5d85-4f7b-4cad-8d84-5a6b0f4b1dc3';
const POL = '4fad6e96-5a8c-4dbe-9e95-6b7c1a5c2ed4';

const person = (id: string, fullName: string, postKey: string): PersonRecord => ({
  id,
  fullName,
  house: 'paulo-freire',
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active: true,
});
let n = 0;
const ap = (personId: string, kind: ApKind, minutes: number): ApRecord => ({
  id: `ap-${(n += 1)}`,
  personId,
  house: 'paulo-freire',
  kind,
  year: 2026,
  date: '2026-02-02',
  minutes,
});

const { rows } = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [
    person(CARLA, 'Carla Ribas Solé', 'er'),
    person(DAVID, 'David Valls Medina', 'en'),
    person(MERITXELL, 'Meritxell Torres Vila', 'tfm'),
    person(ROGER, 'Roger Beltrán Camps', 'et'),
    person(POL, 'Pol Jiménez Alcover', 'ct'),
  ],
  openings: new Map([[ROGER, { vacationDays: 31, carriedDays: 0, surplusMinutes: 120 }]]),
  aps: [
    ...Array.from({ length: 5 }, () => ap(CARLA, 'non_recoverable', 240)),
    ...Array.from({ length: 4 }, () => ap(DAVID, 'non_recoverable', 270)),
    ...Array.from({ length: 3 }, () => ap(MERITXELL, 'non_recoverable', 240)),
    ap(POL, 'recoverable', 480),
  ],
});

const onSaved = vi.fn();
function renderForm(initialPersonId: string | null = null) {
  return render(<ApForm houseSlug="paulo-freire" year={2026} rows={rows} initialPersonId={initialPersonId} onSaved={onSaved} onCancel={() => {}} />);
}
const submit = () => screen.getByRole('button', { name: 'Apunta-ho' });

beforeEach(() => vi.clearAllMocks());

describe('ApForm', () => {
  it('records an AP after a person is chosen, with a preview of the balance', async () => {
    renderForm();
    expect(submit()).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Persona'), MERITXELL);
    expect(screen.getByText('Saldo de Meritxell')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '600');
    expect(screen.getByText("Li quedaran 6 h d'AP no recuperables (dia 4 de 5).")).toBeInTheDocument();
    await userEvent.click(submit());
    // handleSubmit validates asynchronously before the Server Function runs.
    await waitFor(() =>
      expect(addApAction).toHaveBeenCalledWith('paulo-freire', {
        personId: MERITXELL,
        kind: 'non_recoverable',
        year: 2026,
        date: '10/03/2026',
        hours: '6:00',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'new-ap', text: 'Apuntat AP no recuperable de 6 h a Meritxell Torres Vila.' }));
  });

  it('starts the last allowed request at the time left', () => {
    renderForm(DAVID);
    expect(screen.getByLabelText('Hores')).toHaveValue('6:00');
    expect(screen.getByText("És l'últim dia: li queden 6 h")).toBeInTheDocument();
  });

  it('offers the rest of the time as a shortcut', async () => {
    renderForm(POL);
    await userEvent.click(screen.getByRole('radio', { name: /^AP recuperable/ }));
    await userEvent.click(screen.getByRole('button', { name: 'La resta (16 h)' }));
    expect(screen.getByLabelText('Hores')).toHaveValue('16:00');
  });

  it('blocks a sixth AP no recuperable', () => {
    renderForm(CARLA);
    expect(screen.getByRole('alert')).toHaveTextContent("Ja ha fet servir els 5 dies que permet aquest tipus d'AP.");
    expect(submit()).toBeDisabled();
  });

  it('warns about a public holiday but allows it', async () => {
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Dia'), '25122026');
    await userEvent.type(screen.getByLabelText('Hores'), '200');
    expect(screen.getByText('És festiu (Nadal): segons la instrucció no es poden demanar AP en festius.')).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('warns when an AP recuperable takes the surplus below zero, and allows it', async () => {
    renderForm(ROGER);
    await userEvent.click(screen.getByRole('radio', { name: /^AP recuperable/ }));
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '600');
    expect(screen.getByText("L'excedent passarà de +2 h a −4 h: haurà de retornar 4 h. Es pot apuntar igualment.")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('shows an hours error with an icon when the field is left', async () => {
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Hores'), '975');
    await userEvent.tab();
    const error = await screen.findByText(HOURS_MESSAGE);
    expect(error.closest('p')?.querySelector('svg')).not.toBeNull();
  });

  it('cannot save twice while the first save is running', async () => {
    let resolve!: (result: { ok: true; data: { id: string } }) => void;
    vi.mocked(addApAction).mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '100');
    await userEvent.click(submit());
    await waitFor(() => expect(submit()).toBeDisabled());
    await userEvent.click(submit());
    expect(addApAction).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: { id: 'new-ap' } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('shows the server message when the save is refused', async () => {
    vi.mocked(addApAction).mockResolvedValueOnce({ ok: false, message: "Aquesta persona no és d'aquesta casa." });
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '100');
    await userEvent.click(submit());
    expect(await screen.findByText("Aquesta persona no és d'aquesta casa.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/saldos/ap-form.test.tsx`
Expected: FAIL with "Failed to resolve import "./ap-form"".

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/saldos/ap-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Hourglass } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { addApAction } from '@/app/(app)/[house]/saldos/actions';
import { Callout } from '@/components/callout';
import { DateInput } from '@/components/date-input';
import { DurationInput } from '@/components/duration-input';
import { ErrorText, Field } from '@/components/field';
import { useServerAction } from '@/components/team/use-server-action';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { addApSchema } from '@/lib/ap-schemas';
import {
  AP_KINDS,
  AP_KIND_LABELS,
  MAX_REQUEST_MINUTES,
  checkNewAp,
  remainingFor,
  type ApKind,
  type PersonBalances,
} from '@/lib/balances';
import { parseDateDdMmYyyy } from '@/lib/dates';
import { formatDuration, parseDuration, toDurationText } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { AP_RULES } from '@/lib/rules';
import type { SaldoRow } from '@/lib/saldos';
import { cn } from '@/lib/utils';

const DESCRIPTIONS: Record<ApKind, string> = {
  non_recoverable: `Fins a ${formatDuration(AP_RULES.nonRecoverable.minutes)} l'any, en ${AP_RULES.nonRecoverable.maxDays} dies com a màxim.`,
  recoverable: `Es descompta de l'excedent de calendari. Fins a ${formatDuration(AP_RULES.recoverable.minutes)} en ${AP_RULES.recoverable.maxDays} dies.`,
};

type FormInput = z.input<typeof addApSchema>;
type FormOutput = z.output<typeof addApSchema>;

/** The hours a request starts with: the time left when it is the last one allowed (design D4), else nothing. */
function prefillHours(row: SaldoRow | undefined, kind: ApKind): string | null {
  const rest = row ? remainingFor(row.balances, kind) : null;
  return rest?.last ? toDurationText(rest.minutes) : null;
}

/** Minutes only when they make a valid request, so the live check does not repeat the field's own error. */
function requestMinutes(text: string): number | null {
  const minutes = parseDuration(text);
  return minutes !== null && minutes >= 1 && minutes <= MAX_REQUEST_MINUTES ? minutes : null;
}

function BalanceTiles({ name, balances: b, kind }: Readonly<{ name: string; balances: PersonBalances; kind: ApKind }>) {
  const tiles = [
    { key: 'vac', label: 'Vacances', value: `${b.vacationTotal} dies`, sub: b.carriedDays ? `inclou ${b.carriedDays} AA` : 'aquest any', on: false, warn: false },
    {
      key: 'apnr',
      label: 'AP no recuperables',
      value: formatDuration(b.nonRecoverable.leftMinutes),
      sub: `queden · ${b.nonRecoverable.count}/${b.nonRecoverable.maxCount} dies`,
      on: kind === 'non_recoverable',
      warn: false,
    },
    {
      key: 'apr',
      label: 'Excedent calendari',
      value: formatDuration(b.surplusMinutes, { signed: true }),
      sub: `AP rec.: ${b.recoverable.count}/${b.recoverable.maxCount} dies`,
      on: kind === 'recoverable',
      warn: b.surplusMinutes < 0,
    },
  ];
  return (
    <div className="-mt-2 flex flex-col gap-1.5">
      <p className="text-[0.8125rem] text-muted-foreground">Saldo de {name.split(' ')[0]}</p>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={cn('rounded-lg p-2.5 transition-colors duration-150 ease-out', tile.on ? 'bg-secondary ring-1 ring-sage' : 'bg-background')}
          >
            <dt className="text-[0.75rem] leading-tight text-muted-foreground">{tile.label}</dt>
            <dd className="mt-1 flex items-center gap-1 font-semibold leading-tight tabular-nums">
              {tile.warn && <Hourglass aria-hidden="true" className="size-3.5 text-warning" />}
              {tile.value}
            </dd>
            <dd className="mt-0.5 text-[0.6875rem] leading-snug tabular-nums text-muted-foreground">{tile.sub}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Records an AP for the year shown (design D10). Rules are checked live and again on the server. */
export function ApForm({
  houseSlug,
  year,
  rows,
  initialPersonId,
  onSaved,
  onCancel,
}: Readonly<{
  houseSlug: HouseSlug;
  year: number;
  rows: readonly SaldoRow[];
  initialPersonId: string | null;
  onSaved: (saved: { id: string; text: string }) => void;
  onCancel: () => void;
}>) {
  const { error, pending, run } = useServerAction();
  const initialRow = rows.find((row) => row.person.id === initialPersonId);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(addApSchema),
    mode: 'onTouched',
    defaultValues: {
      personId: initialRow?.person.id ?? '',
      kind: 'non_recoverable',
      year,
      date: '',
      hours: prefillHours(initialRow, 'non_recoverable') ?? '',
    },
  });
  const { errors } = form.formState;
  const [personId, kind, dateText, hoursText] = useWatch({ control: form.control, name: ['personId', 'kind', 'date', 'hours'] });
  const row = rows.find((r) => r.person.id === personId);
  const rest = row ? remainingFor(row.balances, kind) : null;
  const check = row ? checkNewAp(row.balances, { kind, year, date: parseDateDdMmYyyy(dateText), minutes: requestMinutes(hoursText) }) : null;
  const blocked = !row || (check?.errors.length ?? 0) > 0;

  function prefill(nextPersonId: string, nextKind: ApKind) {
    const hours = prefillHours(
      rows.find((r) => r.person.id === nextPersonId),
      nextKind,
    );
    if (hours) form.setValue('hours', hours);
  }

  const onSubmit = form.handleSubmit((data) => {
    const name = row?.person.fullName ?? '';
    let id = '';
    run(
      async () => {
        const result = await addApAction(houseSlug, form.getValues());
        if (result.ok) id = result.data.id;
        return result;
      },
      () => onSaved({ id, text: `Apuntat ${AP_KIND_LABELS[data.kind]} de ${formatDuration(data.minutes)} a ${name}.` }),
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-5 px-5 py-5 md:px-6">
        <Field id="ap-person" label="Persona" error={errors.personId?.message}>
          <Controller
            control={form.control}
            name="personId"
            render={({ field }) => (
              <NativeSelect
                id="ap-person"
                data-autofocus={initialRow ? undefined : true}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  prefill(event.target.value, kind);
                }}
                aria-invalid={errors.personId ? true : undefined}
                aria-describedby={errors.personId ? 'ap-person-error' : undefined}
              >
                <option value="" disabled>
                  Tria una persona
                </option>
                {rows.map((r) => (
                  <option key={r.person.id} value={r.person.id}>
                    {r.person.fullName}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
        </Field>

        {row && <BalanceTiles name={row.person.fullName} balances={row.balances} kind={kind} />}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-foreground">Què apuntes?</legend>
          {AP_KINDS.map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors duration-150 ease-out',
                kind === value ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-hover',
              )}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  form.setValue('kind', value);
                  prefill(personId, value);
                }}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block font-semibold">{AP_KIND_LABELS[value]}</span>
                <span className="text-[0.8125rem] text-muted-foreground">{DESCRIPTIONS[value]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field id="ap-date" label="Dia" error={errors.date?.message}>
            <Controller
              control={form.control}
              name="date"
              render={({ field }) => (
                <DateInput
                  id="ap-date"
                  data-autofocus={initialRow ? true : undefined}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={errors.date ? 'ap-date-error' : undefined}
                />
              )}
            />
          </Field>
          <Field
            id="ap-hours"
            label="Hores"
            hint={rest?.last ? `És l'últim dia: li queden ${formatDuration(rest.minutes)}` : undefined}
            error={errors.hours?.message}
          >
            <Controller
              control={form.control}
              name="hours"
              render={({ field }) => (
                <DurationInput
                  id="ap-hours"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.hours}
                  describedBy={errors.hours ? 'ap-hours-error' : undefined}
                />
              )}
            />
            {rest && !rest.last && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start tabular-nums"
                onClick={() => form.setValue('hours', toDurationText(rest.minutes), { shouldValidate: true })}
              >
                La resta ({formatDuration(rest.minutes)})
              </Button>
            )}
          </Field>
        </div>

        <div aria-live="polite" className="flex flex-col gap-2">
          {check?.errors.map((message) => (
            <Callout key={message} tone="error">
              {message}
            </Callout>
          ))}
          {check && check.errors.length === 0 && check.notices.map((message) => (
            <Callout key={message} tone="warning">
              {message}
            </Callout>
          ))}
          {check && check.errors.length === 0 && check.preview && <Callout tone="success">{check.preview}</Callout>}
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border bg-background/50 px-5 py-4 sm:flex-row sm:justify-end md:px-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel·la
        </Button>
        <Button type="submit" disabled={pending || blocked}>
          Apunta-ho
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes, and lint**

Run: `npx vitest run src/components/saldos/ap-form.test.tsx && npx eslint src/components/saldos/ap-form.tsx && npm run typecheck`
Expected: PASS; lint and typecheck clean. Notes for the implementer: the "blocks a sixth" test finds exactly one `alert` because nothing else in the form errors at mount; the date and hours fields mask digits as typed (`10032026` → `10/03/2026`, `600` → `6:00`, `975` → `9:75`).

- [ ] **Step 5: Commit**

```bash
git add src/components/saldos/ap-form.tsx src/components/saldos/ap-form.test.tsx
git commit -m "feat(saldos): add the AP form with live rule checks and the last-request prefill"
```

---

### Task 13: Person sheet, recording, deleting and undo on the board

**tasks.md:** 5.4, 5.5 (wiring)

**Files:**
- Create: `src/components/saldos/person-saldo-sheet.tsx`
- Modify (replace): `src/components/saldos/saldos-board.tsx`
- Test: `src/components/saldos/person-saldo-sheet.test.tsx`, `src/components/saldos/saldos-board.actions.test.tsx`

**Interfaces:**
- Consumes: `ApForm` (Task 12); `Dialog` (Task 9); `UndoToast`, `ToastMessage`, `Callout` (Task 10); `deleteApAction`, `restoreApAction` (Task 8); `Sheet`; `personHref` (`src/components/team/post-card.tsx`); `describePerson` (`team.ts`); `apDateLabel`, `saldosHref`, `vacationLabel`, `SaldoRow` (Task 4); `SAVE_FAILED_MESSAGE`.
- Produces:
  - `PersonSaldoSheet({ houseSlug, year, row, deleting, onRecord, onDelete })`: closing pushes `saldosHref(houseSlug, year)`; delete buttons are labelled `Esborra l'AP del <dc. 18/03/2026>`.
  - The final `SaldosBoard({ houseSlug, houseName, currentYear, view, personId })`: header button "Apuntar AP", the person sheet for `?person=` (only people in `view.rows` or `view.former`), the AP `Dialog`, delete with undo, record with undo.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/saldos/person-saldo-sheet.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import { PersonSaldoSheet } from './person-saldo-sheet';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const ap = (id: string, date: string, minutes: number): ApRecord => ({
  id,
  personId: DAVID,
  house: 'paulo-freire',
  kind: 'non_recoverable',
  year: 2026,
  date,
  minutes,
});
const [row] = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [{ id: DAVID, fullName: 'David Valls Medina', house: 'paulo-freire', postKey: 'en', seat: 1, startedOn: '2025-09-01', active: true }],
  openings: new Map([[DAVID, { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 }]]),
  aps: [ap('b', '2026-03-19', 660), ap('c', '2027-01-15', 120), ap('a', '2026-03-18', 660)],
}).rows;

const onRecord = vi.fn();
const onDelete = vi.fn();
async function openSheet() {
  render(<PersonSaldoSheet houseSlug="paulo-freire" year={2026} row={row} deleting={false} onRecord={onRecord} onDelete={onDelete} />);
  return screen.findByRole('dialog', { name: 'David Valls Medina' });
}
const section = (heading: RegExp) => screen.getByRole('heading', { name: heading }).closest('section')!;

beforeEach(() => vi.clearAllMocks());

describe('PersonSaldoSheet', () => {
  it('shows the balances and reminds what the person owes', async () => {
    await openSheet();
    expect(screen.getByText('Ha de retornar 9 h 15 min treballant quan calgui.')).toBeInTheDocument();
    expect(screen.getByText('Deu 9 h 15 min')).toBeInTheDocument();
    expect(screen.getByText(/31 dies · /)).toHaveTextContent("31 dies · Els períodes s'apuntaran a Vacances.");
  });

  it('lists the APs by date with the weekday, and labels next January', async () => {
    await openSheet();
    const items = within(section(/^AP no recuperables/)).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['dc. 18/03/202611 h', 'dj. 19/03/202611 h', 'dv. 15/01/2027 (gener 2027)2 h']);
    expect(within(section(/^AP recuperables/)).getByText('Cap AP recuperable aquest any.')).toBeInTheDocument();
  });

  it('shows the opening surplus with a link to edit it on Equip', async () => {
    await openSheet();
    expect(screen.getByText(/Excedent a l'inici de l'any/)).toHaveTextContent("Excedent a l'inici de l'any: −9 h 15 min");
    expect(screen.getByRole('link', { name: "Edita'l a Equip" })).toHaveAttribute('href', `/paulo-freire/team?person=${DAVID}&year=2026`);
  });

  it('asks to record an AP and to delete one', async () => {
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar AP' }));
    expect(onRecord).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: "Esborra l'AP del dc. 18/03/2026" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', date: '2026-03-18' }));
  });

  it('closes back to Saldos of the same year', async () => {
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/paulo-freire/saldos?year=2026', { scroll: false }));
  });
});
```

```tsx
// src/components/saldos/saldos-board.actions.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addApAction, deleteApAction, restoreApAction } from '@/app/(app)/[house]/saldos/actions';
import type { ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import type { PersonRecord } from '@/lib/team';
import { SaldosBoard } from './saldos-board';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), unstable_rethrow: vi.fn() }));
vi.mock('@/app/(app)/[house]/saldos/actions', () => ({
  addApAction: vi.fn(),
  deleteApAction: vi.fn(),
  restoreApAction: vi.fn(),
}));

const ROGER = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const LAIA = '2d8b4c74-3e6a-4b9c-9c73-4f5a9e3a0cb2';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';

const person = (id: string, fullName: string, house: PersonRecord['house'], postKey: string): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active: true,
});
const aps: ApRecord[] = [{ id: AP_ID, personId: DAVID, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-03-18', minutes: 660 }];
const view = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [
    person(ROGER, 'Roger Beltrán Camps', 'paulo-freire', 'et'),
    person(DAVID, 'David Valls Medina', 'paulo-freire', 'en'),
    person(LAIA, 'Laia Vidal Mas', 'carme-aymerich', 'er'),
  ],
  openings: new Map([[ROGER, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]]),
  aps,
});
const removed = { personId: DAVID, kind: 'non_recoverable' as const, year: 2026, date: '2026-03-18', minutes: 660, house: 'paulo-freire' as const };

function renderBoard(personId: string | null = null) {
  return render(<SaldosBoard houseSlug="paulo-freire" houseName="Paulo Freire" currentYear={2026} view={view} personId={personId} />);
}

beforeEach(() => vi.clearAllMocks());

describe('SaldosBoard person details', () => {
  it('opens the person named in the URL', async () => {
    renderBoard(DAVID);
    expect(await screen.findByRole('dialog', { name: 'David Valls Medina' })).toBeInTheDocument();
  });

  it.each([LAIA, 'not-an-id'])('opens nothing for a person who is not listed here (%s)', (personId) => {
    renderBoard(personId);
    expect(screen.getByRole('heading', { level: 1, name: 'Saldos 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('SaldosBoard delete and undo', () => {
  it('deletes an AP from the sheet and undoes it from the toast', async () => {
    vi.mocked(deleteApAction).mockResolvedValue({ ok: true, data: { removed } });
    vi.mocked(restoreApAction).mockResolvedValue({ ok: true, data: { id: 'restored' } });
    renderBoard(DAVID);
    const sheet = await screen.findByRole('dialog', { name: 'David Valls Medina' });
    await userEvent.click(within(sheet).getByRole('button', { name: "Esborra l'AP del dc. 18/03/2026" }));
    expect(deleteApAction).toHaveBeenCalledWith('paulo-freire', { apId: AP_ID });
    // The toast is reachable while the sheet is open (portalled, design D11).
    expect(await screen.findByRole('status')).toHaveTextContent('Esborrat.');
    await userEvent.click(screen.getByRole('button', { name: 'Desfés' }));
    expect(restoreApAction).toHaveBeenCalledWith('paulo-freire', removed);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByRole('dialog', { name: 'David Valls Medina' })).toBeInTheDocument();
  });

  it('shows why a delete failed', async () => {
    vi.mocked(deleteApAction).mockResolvedValue({ ok: false, message: 'Aquest AP ja no existeix.' });
    renderBoard(DAVID);
    const sheet = await screen.findByRole('dialog', { name: 'David Valls Medina' });
    await userEvent.click(within(sheet).getByRole('button', { name: "Esborra l'AP del dc. 18/03/2026" }));
    expect(await screen.findByRole('status')).toHaveTextContent('Aquest AP ja no existeix.');
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
  });
});

describe('SaldosBoard recording', () => {
  it('records an AP from the header and undoes it', async () => {
    vi.mocked(addApAction).mockResolvedValue({ ok: true, data: { id: 'new-ap' } });
    vi.mocked(deleteApAction).mockResolvedValue({ ok: true, data: { removed } });
    renderBoard();
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar AP' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apuntar AP' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Persona'), ROGER);
    await userEvent.type(within(dialog).getByLabelText('Dia'), '10032026');
    await userEvent.type(within(dialog).getByLabelText('Hores'), '400');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apunta-ho' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Apuntar AP' })).toBeNull());
    expect(await screen.findByRole('status')).toHaveTextContent('Apuntat AP no recuperable de 4 h a Roger Beltrán Camps.');
    await userEvent.click(screen.getByRole('button', { name: 'Desfés' }));
    expect(deleteApAction).toHaveBeenCalledWith('paulo-freire', { apId: 'new-ap' });
  });

  it('records from the person sheet with the person already chosen', async () => {
    renderBoard(ROGER);
    const sheet = await screen.findByRole('dialog', { name: 'Roger Beltrán Camps' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Apuntar AP' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apuntar AP' });
    expect(within(dialog).getByLabelText('Persona')).toHaveValue(ROGER);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/saldos/person-saldo-sheet.test.tsx src/components/saldos/saldos-board.actions.test.tsx`
Expected: FAIL: `./person-saldo-sheet` cannot be resolved, and the board has no "Apuntar AP" button or sheet yet.

- [ ] **Step 3: Write the person sheet**

```tsx
// src/components/saldos/person-saldo-sheet.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Callout } from '@/components/callout';
import { Sheet } from '@/components/sheet';
import { personHref } from '@/components/team/post-card';
import { Button } from '@/components/ui/button';
import type { ApKind, ApRecord, KindBalance } from '@/lib/balances';
import { formatDuration } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { apDateLabel, saldosHref, vacationLabel, type SaldoRow } from '@/lib/saldos';
import { describePerson } from '@/lib/team';
import { cn } from '@/lib/utils';

function Tile({ label, value, warn = false }: Readonly<{ label: string; value: string; warn?: boolean }>) {
  return (
    <div className={cn('rounded-xl p-3', warn ? 'bg-warning-bg' : 'bg-background')}>
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ApList({
  title,
  kind,
  balance,
  aps,
  year,
  deleting,
  onDelete,
  empty,
}: Readonly<{
  title: string;
  kind: ApKind;
  balance: KindBalance;
  aps: readonly ApRecord[];
  year: number;
  deleting: boolean;
  onDelete: (ap: ApRecord) => void;
  empty: string;
}>) {
  const own = aps.filter((ap) => ap.kind === kind);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
        {title}
        <span className="text-[0.8125rem] font-normal tabular-nums text-muted-foreground">
          {formatDuration(balance.usedMinutes)} de {formatDuration(balance.capMinutes)} · {balance.count}/{balance.maxCount} dies
        </span>
      </h3>
      {own.length === 0 ? (
        <p className="rounded-xl border border-border px-3.5 py-3 text-[0.875rem] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {own.map((ap) => {
            const label = apDateLabel(ap.date, year);
            return (
              <li key={ap.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span aria-hidden="true" className={cn('w-1.5 self-stretch rounded-full', kind === 'recoverable' ? 'bg-sage' : 'bg-sage-foreground/60')} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {label.text}
                    {label.note && <span className="text-[0.8125rem] font-normal text-muted-foreground"> ({label.note})</span>}
                  </p>
                  {kind === 'recoverable' && <p className="text-[0.8125rem] text-muted-foreground">Descomptat de l&apos;excedent</p>}
                </div>
                <span className="text-[0.875rem] font-semibold tabular-nums">{formatDuration(ap.minutes)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={deleting}
                  aria-label={`Esborra l'AP del ${label.text}`}
                  onClick={() => onDelete(ap)}
                  className="text-muted-foreground hover:text-error"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A person's balances and APs of the year, opened from Saldos with `?person=<id>` (design D9). */
export function PersonSaldoSheet({
  houseSlug,
  year,
  row,
  deleting,
  onRecord,
  onDelete,
}: Readonly<{
  houseSlug: HouseSlug;
  year: number;
  row: SaldoRow;
  deleting: boolean;
  onRecord: () => void;
  onDelete: (ap: ApRecord) => void;
}>) {
  const router = useRouter();
  // Starts closed and opens on the next frame: Base UI only animates a drawer
  // that goes from closed to open. Closing animates first, then leaves the URL.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const { person, balances: b, aps } = row;
  const owes = b.surplusMinutes < 0;

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onClosed={() => router.push(saldosHref(houseSlug, year), { scroll: false })}
      title={person.fullName}
      description={describePerson(person)}
    >
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-3 gap-2">
          <Tile label="Vacances" value={vacationLabel(b)} />
          <Tile label="AP no recuperables" value={`Queden ${formatDuration(b.nonRecoverable.leftMinutes)}`} />
          <Tile
            label="Excedent calendari"
            value={owes ? `Deu ${formatDuration(-b.surplusMinutes)}` : formatDuration(b.surplusMinutes, { signed: true })}
            warn={owes}
          />
        </dl>
        {owes && <Callout tone="warning">Ha de retornar {formatDuration(-b.surplusMinutes)} treballant quan calgui.</Callout>}
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onRecord}>
          <Plus aria-hidden="true" />
          Apuntar AP
        </Button>
        <section className="flex flex-col gap-2">
          <h3 className="text-[0.9375rem]">Vacances</h3>
          <p className="text-[0.875rem] tabular-nums">
            {vacationLabel(b)} · <span className="text-muted-foreground">Els períodes s&apos;apuntaran a Vacances.</span>
          </p>
        </section>
        <ApList
          title="AP no recuperables"
          kind="non_recoverable"
          balance={b.nonRecoverable}
          aps={aps}
          year={year}
          deleting={deleting}
          onDelete={onDelete}
          empty="Cap AP no recuperable aquest any."
        />
        <ApList
          title="AP recuperables"
          kind="recoverable"
          balance={b.recoverable}
          aps={aps}
          year={year}
          deleting={deleting}
          onDelete={onDelete}
          empty="Cap AP recuperable aquest any."
        />
        <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
          Excedent a l&apos;inici de l&apos;any: {formatDuration(b.openingSurplusMinutes, { signed: true })} ·{' '}
          <Link href={personHref(houseSlug, person.id, year)} className="font-medium text-primary underline-offset-4 hover:underline">
            Edita&apos;l a Equip
          </Link>
        </p>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Replace the board with the full version**

```tsx
// src/components/saldos/saldos-board.tsx
'use client';

import { useState, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Plus } from 'lucide-react';
import { deleteApAction, restoreApAction } from '@/app/(app)/[house]/saldos/actions';
import { Dialog } from '@/components/dialog';
import { HousePageHeader } from '@/components/house-page-header';
import { SAVE_FAILED_MESSAGE } from '@/components/team/use-server-action';
import { Button } from '@/components/ui/button';
import { UndoToast, type ToastMessage } from '@/components/undo-toast';
import type { ApRecord } from '@/lib/balances';
import type { HouseSlug } from '@/lib/houses';
import { matchesName, type SaldoRow, type SaldosView } from '@/lib/saldos';
import { ApForm } from './ap-form';
import { PersonSaldoSheet } from './person-saldo-sheet';
import { SaldosStats } from './saldos-stats';
import { SaldosTable } from './saldos-table';
import { SaldosToolbar } from './saldos-toolbar';
import { YearSwitcher } from './year-switcher';

// `open` and the content are kept apart so the dialog can animate out with its
// content; `key` gives every opening a fresh form.
type DialogState = { open: boolean; personId: string | null; key: number };

/** The Saldos page body (design D9): totals, filter, search, the list, a person's sheet, the AP form and "Desfés". */
export function SaldosBoard({
  houseSlug,
  houseName,
  currentYear,
  view,
  personId,
}: Readonly<{ houseSlug: HouseSlug; houseName: string; currentYear: number; view: SaldosView; personId: string | null }>) {
  const [oweOnly, setOweOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false, personId: null, key: 0 });
  const [deleting, startDelete] = useTransition();

  const keep = (row: SaldoRow) => (!oweOnly || row.balances.surplusMinutes < 0) && matchesName(row.person.fullName, query);
  const rows = view.rows.filter(keep);
  const former = view.former.filter(keep);
  const everyone = [...view.rows, ...view.former];
  // Only people listed here: a person of the other House or a stale id opens nothing.
  const personRow = personId ? (everyone.find((row) => row.person.id === personId) ?? null) : null;

  const showToast = (message: Omit<ToastMessage, 'key'>) => setToast((previous) => ({ ...message, key: (previous?.key ?? 0) + 1 }));
  const openDialog = (forPersonId: string | null) => setDialog((current) => ({ open: true, personId: forPersonId, key: current.key + 1 }));
  const closeDialog = () => setDialog((current) => ({ ...current, open: false }));

  function deleteAp(ap: ApRecord) {
    startDelete(async () => {
      try {
        const result = await deleteApAction(houseSlug, { apId: ap.id });
        if (!result.ok) {
          showToast({ text: result.message, error: true });
          return;
        }
        const { removed } = result.data;
        showToast({ text: 'Esborrat.', undo: () => restoreApAction(houseSlug, removed) });
      } catch (error) {
        // Let redirect() (for example to /no-access) keep working.
        unstable_rethrow(error);
        console.error(error);
        showToast({ text: SAVE_FAILED_MESSAGE, error: true });
      }
    });
  }

  function recorded({ id, text }: { id: string; text: string }) {
    closeDialog();
    showToast({ text, undo: () => deleteApAction(houseSlug, { apId: id }) });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <HousePageHeader houseName={houseName} title={`Saldos ${view.year}`} />
          <p className="max-w-prose text-muted-foreground">Vacances i hores d&apos;AP de cada persona.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <YearSwitcher houseSlug={houseSlug} year={view.year} currentYear={currentYear} />
          <Button type="button" onClick={() => openDialog(null)}>
            <Plus aria-hidden="true" />
            Apuntar AP
          </Button>
        </div>
      </div>

      <SaldosStats totals={view.totals} oweOnly={oweOnly} onToggleOwe={() => setOweOnly((value) => !value)} />

      <section aria-labelledby="saldos-team" className="flex flex-col gap-3">
        <SaldosToolbar oweOnly={oweOnly} onOweOnlyChange={setOweOnly} query={query} onQueryChange={setQuery} />
        {rows.length > 0 ? (
          <SaldosTable houseSlug={houseSlug} year={view.year} rows={rows} />
        ) : (
          <p className="rounded-2xl bg-card p-8 text-center text-muted-foreground shadow-clay">Ningú coincideix amb aquest filtre.</p>
        )}
      </section>

      {former.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer font-display text-xl">
            Antics membres <span className="font-sans text-[0.8125rem] tabular-nums text-muted-foreground">({former.length})</span>
          </summary>
          <div className="mt-3">
            <SaldosTable houseSlug={houseSlug} year={view.year} rows={former} />
          </div>
        </details>
      )}

      {personRow && (
        <PersonSaldoSheet
          key={personRow.person.id}
          houseSlug={houseSlug}
          year={view.year}
          row={personRow}
          deleting={deleting}
          onRecord={() => openDialog(personRow.person.id)}
          onDelete={deleteAp}
        />
      )}

      {/* Next to the Sheet, not inside it: Escape and outside press close only the dialog (checked in dialog.test.tsx). */}
      <Dialog open={dialog.open} onClose={closeDialog} title="Apuntar AP" description={`Saldos ${view.year}`}>
        <ApForm
          key={dialog.key}
          houseSlug={houseSlug}
          year={view.year}
          rows={everyone}
          initialPersonId={dialog.personId}
          onSaved={recorded}
          onCancel={closeDialog}
        />
      </Dialog>

      {toast && <UndoToast key={toast.key} toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
```

- [ ] **Step 5: Run the Saldos tests, typecheck and lint**

Run: `npx vitest run src/components/saldos src/components/undo-toast.test.tsx src/components/dialog.test.tsx && npm run typecheck && npm run lint`
Expected: PASS (including the Task 11 board tests, which still hold with the full board); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/saldos
git commit -m "feat(saldos): open a person's APs, record and delete them with undo"
```

---

### Task 14: Seed fictional APs

**tasks.md:** 2.3

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `createAp` (Task 6), so every seeded AP passes the same rules as the app; `ApKind` (Task 2).

- [ ] **Step 1: Restructure the seed**

Add the imports next to the existing ones:

```ts
import type { ApKind } from '../src/lib/balances';
import { createAp } from '../src/server/aps-store';
```

Rename the current `main` function to `seedPeople`, change its early return message to `'People skipped: people already exist.'`, and add after it:

```ts
type SeedAp = { fullName: string; house: HouseSlug; kind: ApKind; date: IsoDate; minutes: number; year?: number };

// 2026 APs (SPEC-004), fictional. Paulo Freire: two people owe hours (Roger
// Beltrán Camps −4 h from his opening balance, David Valls Medina −9 h 15 min);
// Carla Ribas Solé has used her 5 APs no recuperables; Mireia Santos Rovira has a
// January 2027 AP counted toward 2026; Núria Roca Ferrer (inactive) shows under
// "Antics membres". Carme Aymerich: Júlia Romero Bosch owes hours after an AP
// recuperable; the shared Pedagoga has an AP recorded there.
const APS: readonly SeedAp[] = [
  ...['2026-02-20', '2026-05-15', '2026-06-12', '2026-09-25', '2026-10-09'].map(
    (date): SeedAp => ({ fullName: 'Carla Ribas Solé', house: 'paulo-freire', kind: 'non_recoverable', date, minutes: 240 }),
  ),
  { fullName: 'David Valls Medina', house: 'paulo-freire', kind: 'non_recoverable', date: '2026-03-18', minutes: 660 },
  { fullName: 'David Valls Medina', house: 'paulo-freire', kind: 'non_recoverable', date: '2026-03-19', minutes: 660 },
  { fullName: 'Mireia Santos Rovira', house: 'paulo-freire', kind: 'recoverable', date: '2026-06-19', minutes: 585 },
  { fullName: 'Mireia Santos Rovira', house: 'paulo-freire', kind: 'non_recoverable', date: '2027-01-15', minutes: 120, year: 2026 },
  { fullName: 'Núria Roca Ferrer', house: 'paulo-freire', kind: 'non_recoverable', date: '2026-02-06', minutes: 480 },
  ...['2026-03-02', '2026-06-12', '2026-10-15'].map(
    (date): SeedAp => ({ fullName: 'Laia Vidal Mas', house: 'carme-aymerich', kind: 'non_recoverable', date, minutes: 240 }),
  ),
  { fullName: 'Júlia Romero Bosch', house: 'carme-aymerich', kind: 'recoverable', date: '2026-09-29', minutes: 390 },
  { fullName: 'Meritxell Torres Vila', house: 'carme-aymerich', kind: 'non_recoverable', date: '2026-01-05', minutes: 90 },
];

async function seedAps() {
  if ((await db.ap.count()) > 0) {
    console.log('APs skipped: APs already exist.');
    return;
  }
  for (const ap of APS) {
    const person = await db.person.findFirst({ where: { fullName: ap.fullName }, select: { id: true } });
    if (!person) throw new Error(`Seed person ${ap.fullName} is missing.`);
    await createAp(db, { personId: person.id, house: ap.house, kind: ap.kind, year: ap.year ?? 2026, date: ap.date, minutes: ap.minutes });
  }
  console.log(`Seeded ${APS.length} fictional APs.`);
}

async function main() {
  await seedPeople();
  await seedAps();
}
```

Keep the existing `main().catch(…).finally(() => db.$disconnect())` call at the end of the file. Update the header comment's last sentence to: `Safe to re-run: people and APs are each added only when none exist.`

- [ ] **Step 2: Run the seed twice on the local Postgres**

With the local Postgres running and migrated (Task 5):

Run: `npx prisma db seed && npx prisma db seed`
Expected: first run `Seeded 20 fictional people (3 inactive).` and `Seeded 16 fictional APs.`; second run `People skipped: people already exist.` and `APs skipped: APs already exist.`

Check the Paulo Freire numbers the spec uses:

```bash
psql -h localhost -p 54329 -U postgres -d casa -c "SELECT p.full_name, a.kind, a.year, a.date, a.minutes, h.slug AS recorded_in FROM aps a JOIN people p ON p.id = a.person_id JOIN houses h ON h.id = a.house_id ORDER BY p.full_name, a.date;"
```

Expected: 16 rows; Mireia Santos Rovira's 2027-01-15 AP has year 2026; Meritxell Torres Vila's AP is recorded in `carme-aymerich`.

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck`
Expected: clean.

```bash
git add prisma/seed.ts
git commit -m "feat(db): seed fictional 2026 APs through the AP rules"
```

---

### Task 15: Documentation

**tasks.md:** 6.1, 6.2

**Files:**
- Modify: `docs/domain.md`, `AGENTS.md`, `README.md`

- [ ] **Step 1: `docs/domain.md`**

1. In the "Sources" list, add after the director's answers bullet:

```markdown
- FASI's instruction **FPOL32 núm. 04** (17/12/2019, "gestió i organització del temps de treball i
  de descans a partir del dia 01/01/2020"), shared by the product owner. Summarised in §13; the
  PDF is not committed (internal FASI document).
```

2. In §4, replace the bullet "The spreadsheet notes "Es pot demanar en una sola petició la nit+REE": a night shift plus the following team meeting (REE) can be one request." with:

```markdown
- A night shift plus the following team meeting (REE) can be one request: the spreadsheet notes
  "Es pot demanar en una sola petició la nit+REE", and FPOL32 §2 says an AP on the Monday night
  shift includes Tuesday's REE. One request is at most 24 h.
- **The year closes on 31 January** (FPOL32 §1): APs of a year can be taken until 31 January of
  the next year and count toward that year's allowance and surplus. Each AP stores the year it
  counts toward (SPEC-004).
- APs need **5 days' notice** (FPOL32 §2). The director records only APs she approved; the app
  does not check the notice.
- **(open)** APs on public holidays: FPOL32 §2 says "No es podran demanar AP en els 14 festius
  anuals" but also that whoever asks for an AP on a holiday they were scheduled to work gets
  another holiday assigned. The app warns and allows it.
- **(built, SPEC-004)** Saldos records APs: rules in `src/lib/balances.ts`, table `aps`.
```

3. In §5, after the bullet "Owed hours are given back …", add:

```markdown
- FPOL32 §1 and §2: hours worked below the agreed year are regularised with occasional cover of
  holidays or other shifts, communicated with 5 days' notice; hours above it are compensated with
  rest. Neither is recorded in the app yet: the director adjusts the opening surplus on Equip.
```

4. In §7 under "FASI's period rule", add:

```markdown
- **(open)** FPOL32 §4 says blocks of 7 days apply "si es volen fraccionar en més de dos
  períodes": with two periods, any split of at least 7 days might be allowed (for example
  12 + 19), which is looser than the table above. To confirm with the director (SPEC-006).
```

5. In §8, after the bullet about days with more people off than the House limit, add:

```markdown
- FPOL32 §3 lists which posts cannot be absent at the same time (see §13). It answers the open
  question "which posts may overlap" for El mes and Vacances.
```

6. In §9, add at the end: `2026 is coded in `src/lib/holidays.ts` (SPEC-004 warns when an AP falls on one).`

7. In §11, change the Saldos row's Spec and Status cells to `SPEC-004 `saldos`` and `Built`.

8. Append a new section:

```markdown
## 13. FASI instruction FPOL32 (summary)

"Instrucció relativa a gestió i organització del temps de treball i de descans a partir del dia
01/01/2020", núm. 04, 17/12/2019, from Direcció Persones and Direcció Tècnica to the Houses. The
rules that matter to the app, by spec:

| Rule | Where | Spec |
|---|---|---|
| Annual working time 1,701 h; the calendar closes on 31 January of the next year | §1 | SPEC-004 (AP year) |
| 12 h rest between shifts; weekly rest of 36 h, accumulable over two weeks; never more than 10 days of work in two weeks | §1 | SPEC-005 |
| APs depend on the person; 5 days' notice; no APs on the 14 annual holidays (see §4, open) | §2 | SPEC-004 |
| AP no recuperable counts as worked time and can be joined to vacations; AP recuperable does not count, must be recovered and **cannot be joined to vacations** | §2 | SPEC-004, SPEC-006 |
| An AP on the Monday night shift includes Tuesday's REE | §2 | SPEC-004 |
| Absence incompatibilities between posts (table below) | §3 | SPEC-005, SPEC-006 |
| Vacation calendar closed on 15 February; periods fixed for the year; cancelling needs Direcció de Persones' approval, at least two months before | §4 | SPEC-006 |
| Vacations in periods of at least 7 days; blocks of 7 when split in more than two periods; 10 days to reach 31 | §4 | SPEC-006 |
| Choosing order: EIF (DS, ER, then PSI/PDG/TS) and EE (CT first, then the six educators) by seniority, then rotating | §4 | SPEC-006 |
| A vacation starting on a night shift counts from 22:00 that day; ending on Monday, Tuesday's REE is a working day | §4 | SPEC-006 |
| Holidays shared out in December; the CT picks two holidays off; 12 h holiday shifts; a holiday hour counts 1.5 | §5 | SPEC-005 |

Absence incompatibilities (§3, "Incompatibilitats absències"; "Cobertures previstes" in brackets):

| Post | Cannot be absent at the same time as | Planned cover |
|---|---|---|
| Direcció | PSI, PDG, ER | EIF |
| Psicòleg (PSI) | Direcció, PDG, ER | none |
| Pedagog / TS (PDG) | Direcció, PSI, ER | none |
| ER | ES Tarda, ES CS, ES Nits, ES CT, TF Tarda, TF Matí, Direcció, PSI, PDG, TS | ES CT, EE |
| ES Tarda (ET) | ER, TF Tarda, ES Nit | ES CT |
| ES Cap de setmana (ECS) | ER | ES CT |
| ES Nit 1 (EN) | ER, ES Nit 2, ES Tarda | ES CT |
| ES Nit 2 (EN) | ER, ES Nit 1, ES Tarda | ES CT |
| TF Matí (TFM) | ER, TF Tarda | discretionary, external |
| TF Tarda (TFT) | ER, ES Tarda, TF Matí | ES CT |
```

- [ ] **Step 2: `AGENTS.md`**

1. Replace "people per post. Saldos, El mes and Vacances (SPEC-004 to SPEC-006) are next: **before working on
them, read" with "people per post. Saldos (SPEC-004, change `openspec/changes/saldos/`) records APs and shows balances. El mes and Vacances (SPEC-005, SPEC-006) are next: **before working on
them, read".
2. Change "Models: `House`, `Person`, `PersonYear`." to "Models: `House`, `Person`, `PersonYear`, `Ap`."
3. After the line "- `[house]/team/`: Equip page; `actions.ts` holds its Server Functions." add:

```markdown
  - `[house]/saldos/`: Saldos page (the House home); `saldos-content.tsx` is the async child
    that reads the request; `actions.ts` records, deletes and restores APs.
```

4. After the `src/lib/posts.ts` bullet (the one ending "zod schemas shared by forms and Server Functions."), add:

```markdown
- `src/lib/balances.ts`: AP kinds and limits, balances of a person and year, `checkNewAp` (errors
  block, notices warn). `src/lib/holidays.ts`: public holidays per year. `src/lib/ap-schemas.ts`:
  AP form schemas. `src/lib/saldos.ts`: the Saldos view and its labels. *Why:* one implementation
  of the rules for the page, the live form and the server.
```

5. Change "- `src/server/people.ts`: director-gated reads." to "- `src/server/people.ts`, `src/server/saldos.ts`: director-gated reads." and "`src/server/people-store.ts`: Prisma persistence without auth" to "`src/server/people-store.ts`, `src/server/aps-store.ts`: Prisma persistence without auth (`createAp` checks the AP limits under a lock on the person row)".
6. Change "- `src/components/team/`: Equip UI." to "- `src/components/team/`: Equip UI. `src/components/saldos/`: Saldos UI. `src/components/callout.tsx`: error, warning and success messages with an icon. `src/components/undo-toast.tsx`: \"Desfés\" toast (portalled, so it stays reachable over an open Sheet)."
7. After the `src/components/sheet.tsx` bullet add:

```markdown
- `src/components/dialog.tsx`: the app's dialog for short forms, wrapping the shadcn Dialog
  (`src/components/ui/dialog.tsx`, Base UI): centred on desktop, a bottom sheet on mobile. Use
  `Sheet` for detail panels and `Dialog` for short forms, rendered next to the Sheet, not inside it.
```

- [ ] **Step 3: `README.md`**

Replace "2. Seed fictional people (dev only): `npx prisma db seed` (20 people, 3 inactive). Re-running does
   nothing once people exist." with:

```markdown
2. Seed fictional people and APs (dev only): `npx prisma db seed` (20 people, 3 inactive, 16 APs of
   2026). Re-running adds nothing once people (or APs) exist. After pulling SPEC-004 (`saldos`) run
   `npm run db:migrate` and the seed again: it adds the APs.
```

- [ ] **Step 4: Commit**

```bash
git add docs/domain.md AGENTS.md README.md
git commit -m "docs: document Saldos, the AP rules and FASI's instruction FPOL32"
```

---

### Task 16: Verification

**tasks.md:** 5.6, 6.3

- [ ] **Step 1: Full checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all clean; the test count grows from 209 by the tests added in Tasks 1 to 13.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: success when Clerk and database variables are available (`.env.local`). In a container without them the build stops on the missing variables before compiling: record that in `db-check.md` and rely on CI and the Vercel preview build instead.

- [ ] **Step 3: Browser check (desktop and mobile, both Houses)**

Against the local Postgres with the seed (needs the Clerk development keys in `.env.local` and a user with the director flag; otherwise the product owner does it on the Vercel preview): `npm run dev`, open `/paulo-freire` and check:

1. `/paulo-freire` opens `/paulo-freire/saldos?…` Saldos 2026; the navigation shows Saldos as a link.
2. Totals: "2 persones · 13 h 15 min en total" (Roger and David); the card filters them.
3. Search "nuria" finds nothing in the list but "Antics membres" shows Núria Roca Ferrer.
4. Carla Ribas Solé: "Apuntar AP" shows "Ja ha fet servir els 5 dies…" and "Apunta-ho" is disabled.
5. David Valls Medina: record an AP no recuperable of 2:00 on 25/12/2026: the holiday notice shows, saving works, "Desfés" removes it.
6. Mireia Santos Rovira's sheet shows "dv. 15/01/2027 (gener 2027)"; on Saldos 2027 that AP is not listed.
7. Delete an AP from a sheet, then "Desfés": it comes back with the same date and hours.
8. Carme Aymerich: the shared Pedagoga's AP shows on both Houses; Júlia Romero Bosch shows "Deu 6 h 30 min".
9. Mobile width (390 px): cards with three tiles, the form opens as a bottom sheet, the toast sits above the tab bar.

Append the results to `openspec/changes/saldos/db-check.md` under `## 3. Browser check (task 5.6)`, one line per item with what was seen. If the session has no Clerk keys, write that the check is pending for the product owner and mark task 5.6 as `[~]` in `tasks.md`.

- [ ] **Step 4: Tick `tasks.md` and commit**

Tick every task done in `openspec/changes/saldos/tasks.md` (and `[~]` for any deferred check, with the reason), then:

```bash
git add openspec/changes/saldos/tasks.md openspec/changes/saldos/db-check.md
git commit -m "docs(openspec): record the saldos checks and tick the tasks"
```

- [ ] **Step 5: Stop the local Postgres**

Run: `runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/casa-pg/data stop`
