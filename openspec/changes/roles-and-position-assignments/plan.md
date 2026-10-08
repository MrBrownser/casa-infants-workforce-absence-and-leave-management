# Roles and Position Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task, tick the matching `tasks.md` items listed under **Covers**.

**Goal:** Let the director manage both Houses' staffing in the app (roles, positions, dated assignments, people, membership periods, transfers, history) with invariants enforced by Postgres, and replace the Clerk metadata gate with application grants.

**Architecture:** Same layering as SPEC-001. Pure rules live in `src/lib/` (`staffing.ts` plans every write as "closes then opens"). A Prisma store without auth (`src/server/staffing-store.ts`, `staffing-queries.ts`) runs each write through one transaction template: operation receipt first, per-employee row lock, re-read, plan, write. Postgres backs every rule with exclusion constraints, a composite FK, a deferred containment trigger and a position trigger. Server Functions in `src/app/(app)/[house]/team/actions.ts` call `requireDirector()` (now grant-based) before anything else, and the UI is server pages plus small react-hook-form client forms.

**Tech Stack:** Next.js 16 App Router, React 19 (`useActionState`), TypeScript, Prisma 7 (`prisma-client` generator, `PrismaPg` adapter) on Supabase Postgres (EU), Clerk (`@clerk/nextjs`, plus `@clerk/backend` for operator scripts, new direct dependency), react-hook-form 7 + `@hookform/resolvers` 5 + zod 4, Tailwind v4 tokens, lucide-react, Vitest 4 + Testing Library, local Homebrew Postgres (14+) for `npm run test:db`.

**Spec:** `openspec/changes/roles-and-position-assignments/`: `design.md` (D1 to D14), `specs/staffing-positions`, `specs/staffing-operations`, `specs/team-views`, `specs/application-access`, `specs/house-context`, `specs/house-membership`, and the product source `SPEC-002-roles-and-position-assignments.md`. Read `design.md` and the specs before starting.

## Global Constraints

- UI copy is Catalan. Code, identifiers, routes, query values, comments and commit messages are English.
- No em-dashes in code comments, commit messages or logs.
- Conventional commits. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- npm only. Node 24.
- Honey (`accent`, `bg-accent`, `text-accent`, `border-accent`) is never used in this change. Selected states use `bg-secondary` with `text-foreground`. Vacancies and "Futur" tags are neutral (`text-muted-foreground`, `bg-secondary`).
- Fraunces only via `h1`/`h2`/`.font-display` at 20px or more (`h2` must be at least `text-xl`). Dates use `tabular-nums`. Mobile side gutter `px-4`. Touch targets at least 44px on mobile (`h-11`, `md:h-10`).
- Errors carry an icon and text (`Alert variant="error"`, field errors with `CircleAlert`).
- Radii: `rounded-2xl` panels, `rounded-xl` cards, `rounded-lg` buttons/inputs, `rounded-md` dense. Panels use `shadow-clay`. Transitions 150 to 200ms.
- Dates are `IsoDate` strings (`YYYY-MM-DD`). "Today" is always `todayInMadrid()`. Convert with `isoDateToDate` / `dateToIsoDate` at the Prisma boundary.
- Every page under `[house]`, every function in `src/server/houses.ts` and `src/server/staffing.ts`, and every Server Function calls `requireDirector()` first. The House always comes from the route slug, never from a cookie or a submitted field.
- Logs never contain SQL text, Postgres messages or names. The only staffing log line is `[staffing] <kind> failed: unexpected`.
- The hand-written SQL in `prisma/migrations/*_house_context` and `*_staffing` must never be removed. Never run `prisma migrate dev` or `prisma migrate reset` against Supabase in this plan; Task 25 is the only task that touches the dev Supabase DB, and only with the user's go-ahead.
- Read the relevant guide in `node_modules/next/dist/docs/` before using a Next API this plan does not show (AGENTS.md).
- **Secrets and where tasks run:** Tasks 1 to 24 need no secrets and no `.env.local`: `npm ci`, `npm test`, `npm run test:db` (throwaway local Postgres) and `npm run build` all work without environment variables (checked on 2026-10-08 in a clean checkout). They can run in a Claude Code cloud session (Ubuntu 24.04, root, PostgreSQL 16 preinstalled under `/usr/lib/postgresql/16/bin`, which the harness finds; do not start the system `postgresql` service). Never add Supabase or Clerk credentials to a cloud environment for this plan. Tasks 25 and 26 need the dev Supabase database, the Clerk dev keys and a browser: run them on the developer's machine with `.env.local`.
- **Worktree setup:** run `npm install` (runs `prisma generate`) in a fresh worktree. On a local machine, also copy `.env.local` from the main checkout before Task 25 or 26 (`cp ../<main-checkout>/.env.local .env.local`).
- **DB tests and one-off database work:** `npm run test:db` and `npx tsx test/db/with-postgres.ts -- <command>` start a throwaway Postgres (14 or newer) on `localhost` and never touch Supabase. Binaries come from `PG_BIN`, the directory of the `postgres` binary (macOS Homebrew), or `/usr/lib/postgresql/<version>/bin` (Debian/Ubuntu, e.g. a cloud sandbox after `apt-get install -y postgresql`). As root, the server tools run as the `postgres` OS user. On macOS the first `initdb` on `PATH` may be libpq's client-only copy; the harness avoids it.

## Review Focus

1. **Non-UUID IDs in URLs and forms** (`/paulo-freire/team/abc`, a hidden `positionId` of `x`): pages must 404 and actions must answer "not found", never a 500 from Postgres `22P02`. Tests in Task 13 (`isUuid` guard in queries) and Task 6 (schemas reject non-UUIDs).
2. **Invalid query values** (`?date=2026-02-30`, `?date=yesterday`, `?view=admin`, repeated `?view=`): fall back to today and `people`. Test in Task 19 (`parseTeamSearchParams`).
3. **A confirm retried after it already succeeded** (double click on "Confirma", or a network retry with the same operation ID): reports "already applied", not "stale" or a conflict. Test in Task 10 (handover DB test).
4. **The incoming person already holds that same position** (assign Ana to "ER 1" when she already occupies it): explicit `employee-has-position`, not a silent close-and-reopen. Test in Task 4.
5. **Labels that differ only by case, accents' case or spaces** (`" ct NIT "` vs `"CT nit"`, `"Àrea"` vs `"àrea"`): rejected as `label-taken` in the same House, accepted in the other House. Test in Task 7 (DB) and Task 9 (store).

---

## Task 1: Real-database test harness

**Covers:** tasks.md 1.1, 1.2

**Files:**
- Create: `vitest.db.config.ts`, `test/db/local-postgres.ts`, `test/db/with-postgres.ts`, `test/db/global-setup.ts`, `test/db/helpers.ts`
- Create (test): `src/server/membership-constraints.db.test.ts`
- Modify: `vitest.config.ts`, `package.json` (script `test:db`)

**Interfaces:**
- Consumes: the existing `house_context` migration; `PrismaClient` from `@/generated/prisma/client`; `isoDateToDate` from `@/lib/dates`.
- Produces:
  - `startLocalPostgres(database?: string): Promise<{ url: string; bin: string; stop: () => void }>` (`test/db/local-postgres.ts`, migrations applied)
  - `npx tsx test/db/with-postgres.ts -- <command> [args...]`: runs one command with `DATABASE_URL`/`DIRECT_URL` pointing at a throwaway database (used by Tasks 7 and 12)
  - `inject('databaseUrl')`, `inject('pgBin')` in DB tests
  - In `test/db/helpers.ts`:
  - `createTestClient(): PrismaClient` (local URL only)
  - `resetData(db: PrismaClient): Promise<void>` (truncates every table except `houses`, `occupational_roles`, `_prisma_migrations`)
  - `houseIds(db: PrismaClient): Promise<{ pf: string; ca: string }>`
  - `insertEmployee(db, fullName?: string): Promise<string>`
  - `insertMembership(db, employeeId: string, houseId: string, startsOn: IsoDate, endsOn?: IsoDate | null): Promise<string>`
  - `pgCodeOf(error: unknown): string | undefined`
  - `expectPgError(promise: Promise<unknown>, code: string): Promise<void>`
  - `npm run test:db` runs `src/**/*.db.test.ts` only; `npm test` excludes them.

- [ ] **Step 1: Write the failing DB test**

```ts
// src/server/membership-constraints.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestClient,
  expectPgError,
  houseIds,
  insertEmployee,
  insertMembership,
  resetData,
} from '../../test/db/helpers';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

describe('SPEC-001 membership constraints on a real database', () => {
  it('has both Houses after the migrations', async () => {
    const houses = await db.house.findMany({ orderBy: { slug: 'asc' } });
    expect(houses.map((h) => h.slug)).toEqual(['carme-aymerich', 'paulo-freire']);
  });

  it('rejects an overlapping membership inserted with SQL', async () => {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01', '2026-06-30');
    await expectPgError(
      db.$executeRaw`INSERT INTO "house_memberships" ("employee_id", "house_id", "starts_on") VALUES (${ana}::uuid, ${ca}::uuid, '2026-06-15')`,
      '23P01',
    );
  });

  it('rejects an end before the start', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await expectPgError(insertMembership(db, ana, pf, '2026-03-01', '2026-02-01'), '23514');
  });

  it('accepts adjacent periods', async () => {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01', '2026-06-30');
    await insertMembership(db, ana, ca, '2026-07-01');
    expect(await db.houseMembership.count({ where: { employeeId: ana } })).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config vitest.db.config.ts`
Expected: FAIL (the config file and `test/db/helpers` do not exist).

- [ ] **Step 3: Add the harness**

```ts
// vitest.db.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Real-database tests (`npm run test:db`): test/db/global-setup.ts starts a
// throwaway local Postgres, applies the Prisma migrations and tears it down.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.db.test.ts'],
    globalSetup: ['./test/db/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./vitest.server-only-stub.ts', import.meta.url)),
    },
  },
});
```

```ts
// test/db/local-postgres.ts
//
// A throwaway local Postgres for tests and one-off checks (never Supabase):
// initdb into a temp directory, TCP only on a free localhost port (temp paths
// can be too long for a Unix socket on macOS), then `prisma migrate deploy`.
// Server binaries come from PG_BIN, the directory of the `postgres` binary
// (macOS Homebrew; the first `initdb` on PATH can be libpq's client-only copy),
// or Debian's /usr/lib/postgresql/<version>/bin. Postgres refuses to run as
// root, so in root containers the server tools run as the `postgres` OS user.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type LocalPostgres = { url: string; bin: string; stop: () => void };

const asRoot = process.getuid?.() === 0;

function pgBinDir(): string {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const which = spawnSync('which', ['postgres'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return dirname(realpathSync(which.stdout.trim()));
  const debian = '/usr/lib/postgresql';
  if (existsSync(debian)) {
    const versions = readdirSync(debian)
      .filter((version) => existsSync(join(debian, version, 'bin', 'initdb')))
      .sort((a, b) => Number(b) - Number(a));
    if (versions[0]) return join(debian, versions[0], 'bin');
  }
  throw new Error('Postgres server binaries not found: install PostgreSQL 14 or newer, or set PG_BIN.');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** Runs a server tool (initdb, pg_ctl); as root, as the `postgres` OS user. */
function serverTool(bin: string, tool: string, args: string[]): void {
  const file = join(bin, tool);
  if (asRoot) execFileSync('runuser', ['-u', 'postgres', '--', file, ...args], { stdio: 'pipe' });
  else execFileSync(file, args, { stdio: 'pipe' });
}

export async function startLocalPostgres(database = 'casa_test'): Promise<LocalPostgres> {
  const bin = pgBinDir();
  const dir = mkdtempSync(join(tmpdir(), 'casa-pg-'));
  if (asRoot) execFileSync('chown', ['-R', 'postgres', dir]);
  const data = join(dir, 'data');
  const port = await freePort();

  // en_US.UTF-8 matches Supabase for lower(); minimal containers may only have C.UTF-8.
  const initdb = (locale: string) =>
    serverTool(bin, 'initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', `--locale=${locale}`]);
  try {
    initdb('en_US.UTF-8');
  } catch {
    rmSync(data, { recursive: true, force: true });
    initdb('C.UTF-8');
  }
  serverTool(bin, 'pg_ctl', [
    '-D', data,
    '-o', `-p ${port} -c listen_addresses=localhost -c unix_socket_directories=''`,
    '-l', join(dir, 'postgres.log'),
    '-w', 'start',
  ]);

  const stop = () => {
    try {
      serverTool(bin, 'pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    } catch {
      // Already stopped.
    }
    rmSync(dir, { recursive: true, force: true });
  };

  try {
    execFileSync(join(bin, 'createdb'), ['-h', 'localhost', '-p', String(port), '-U', 'postgres', database], { stdio: 'pipe' });
    const url = `postgresql://postgres@localhost:${port}/${database}`;
    // dotenv in prisma.config.ts does not override variables that are already set.
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
    return { url, bin, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
```

```ts
// test/db/global-setup.ts
import type { TestProject } from 'vitest/node';
import { startLocalPostgres } from './local-postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    pgBin: string;
  }
}

/** One throwaway database per `npm run test:db` run, removed afterwards. */
export default async function setup(project: TestProject) {
  const postgres = await startLocalPostgres();
  project.provide('databaseUrl', postgres.url);
  project.provide('pgBin', postgres.bin);
  return postgres.stop;
}
```

```ts
// test/db/with-postgres.ts
//
// Runs one command against a throwaway local Postgres with the migrations
// applied, then deletes it. DATABASE_URL and DIRECT_URL point at it:
//   npx tsx test/db/with-postgres.ts -- <command> [args...]
import { spawnSync } from 'node:child_process';
import { startLocalPostgres } from './local-postgres';

async function main() {
  const separator = process.argv.indexOf('--');
  const [command, ...args] = separator >= 0 ? process.argv.slice(separator + 1) : process.argv.slice(2);
  if (!command) throw new Error('Usage: npx tsx test/db/with-postgres.ts -- <command> [args...]');
  const postgres = await startLocalPostgres('scratch');
  try {
    const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: postgres.url, DIRECT_URL: postgres.url } });
    process.exitCode = result.status ?? 1;
  } finally {
    postgres.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

```ts
// test/db/helpers.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { expect, inject } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { isoDateToDate, type IsoDate } from '@/lib/dates';

const LOCAL_TEST_URL = /^postgresql:\/\/postgres@localhost:\d+\/casa_test$/;

/** A client for the throwaway test database. Refuses anything that is not the local test DB. */
export function createTestClient(): PrismaClient {
  const url = inject('databaseUrl');
  if (!LOCAL_TEST_URL.test(url)) throw new Error('DB tests only run against the local test database.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Empties every data table; keeps the Houses and roles inserted by the migrations. */
export async function resetData(db: PrismaClient): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('houses', 'occupational_roles', '_prisma_migrations')`;
  if (rows.length === 0) return;
  await db.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
}

export async function houseIds(db: PrismaClient): Promise<{ pf: string; ca: string }> {
  const houses = await db.house.findMany();
  const id = (slug: string) => {
    const house = houses.find((h) => h.slug === slug);
    if (!house) throw new Error(`House ${slug} missing`);
    return house.id;
  };
  return { pf: id('paulo-freire'), ca: id('carme-aymerich') };
}

export async function insertEmployee(db: PrismaClient, fullName = 'Ana Puig'): Promise<string> {
  return (await db.employee.create({ data: { fullName } })).id;
}

export async function insertMembership(
  db: PrismaClient,
  employeeId: string,
  houseId: string,
  startsOn: IsoDate,
  endsOn: IsoDate | null = null,
): Promise<string> {
  const row = await db.houseMembership.create({
    data: { employeeId, houseId, startsOn: isoDateToDate(startsOn), endsOn: endsOn ? isoDateToDate(endsOn) : null },
  });
  return row.id;
}

/** The Postgres SQLSTATE behind a Prisma 7 driver-adapter error, if any. */
export function pgCodeOf(error: unknown): string | undefined {
  const e = error as { name?: string; cause?: { originalCode?: string }; meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } };
  return e?.name === 'DriverAdapterError' ? e.cause?.originalCode : e?.meta?.driverAdapterError?.cause?.originalCode;
}

export async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected Postgres error ${code}`).not.toBeNull();
  expect(pgCodeOf(error)).toBe(code);
}
```

In `vitest.config.ts`, import `configDefaults` and exclude DB tests from the default run:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
// ...
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Real-database tests run with `npm run test:db` (vitest.db.config.ts).
    exclude: [...configDefaults.exclude, '**/*.db.test.ts'],
  },
```

In `package.json` `scripts`, after `"test:watch"`, add:

```json
    "test:db": "vitest run --config vitest.db.config.ts",
```

- [ ] **Step 4: Run the DB tests and the default suite**

Run: `npm run test:db`
Expected: PASS, 4 tests in `membership-constraints.db.test.ts`.

Run: `npx tsx test/db/with-postgres.ts -- npx prisma migrate status`
Expected: Prisma reports the database schema is up to date, and the throwaway database is removed afterwards.

Run: `npm test`
Expected: PASS, and `membership-constraints.db.test.ts` is not collected.

- [ ] **Step 5: Commit**

```bash
git add vitest.db.config.ts vitest.config.ts test/db package.json src/server/membership-constraints.db.test.ts
git commit -m "test(db): add an ephemeral Postgres harness for real-database tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Role catalogue and the StaffingError type

**Covers:** tasks.md 2.1, 2.2

**Files:**
- Create: `src/lib/roles.ts`, `src/lib/roles.test.ts`, `src/lib/staffing-error.ts`, `src/lib/staffing-error.test.ts`
- Modify: `src/lib/house-membership.ts` (drop `TransferError`), `src/lib/house-membership.test.ts`, `src/server/membership-store.ts`, `src/server/membership-store.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ROLES` (nine `{ code, label }` in catalogue order), `type Role`, `type RoleCode = 'PDG' | 'PSI' | 'ER' | 'TFM' | 'TFT' | 'ET' | 'ECS' | 'EN' | 'CT'`, `ROLE_CODES: [RoleCode, ...RoleCode[]]`, `isRoleCode(value: unknown): value is RoleCode`, `findRole(code: string): Role | undefined`, `roleOrder(code: RoleCode): number`
  - `type StaffingErrorReason` (13 values below), `class StaffingError extends Error { reason }`, `isStaffingError(error: unknown): error is StaffingError`
  - `planTransfer` now throws `StaffingError('not-ongoing' | 'same-house' | 'starts-too-early')`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/roles.test.ts
import { describe, expect, it } from 'vitest';
import { ROLES, ROLE_CODES, findRole, isRoleCode, roleOrder } from './roles';

describe('ROLES', () => {
  it('is the SPEC-002 catalogue in order', () => {
    expect(ROLES).toEqual([
      { code: 'PDG', label: 'Pedagoga' },
      { code: 'PSI', label: 'Psicòloga' },
      { code: 'ER', label: 'Educadora referent' },
      { code: 'TFM', label: 'Treballadora familiar de matins' },
      { code: 'TFT', label: 'Treballadora familiar de tardes' },
      { code: 'ET', label: 'Educadora de tardes' },
      { code: 'ECS', label: 'Educadora de cap de setmana' },
      { code: 'EN', label: 'Educadora de nit' },
      { code: 'CT', label: 'Corretor' },
    ]);
    expect(ROLE_CODES).toEqual(['PDG', 'PSI', 'ER', 'TFM', 'TFT', 'ET', 'ECS', 'EN', 'CT']);
  });

  it('recognises codes exactly', () => {
    expect(isRoleCode('CT')).toBe(true);
    expect(isRoleCode('ct')).toBe(false);
    expect(isRoleCode('director')).toBe(false);
    expect(isRoleCode(undefined)).toBe(false);
    expect(findRole('EN')?.label).toBe('Educadora de nit');
    expect(findRole('XX')).toBeUndefined();
  });

  it('orders roles as in the catalogue', () => {
    expect(roleOrder('PDG')).toBeLessThan(roleOrder('CT'));
  });
});
```

```ts
// src/lib/staffing-error.test.ts
import { describe, expect, it } from 'vitest';
import { StaffingError, isStaffingError } from './staffing-error';

describe('StaffingError', () => {
  it('carries a reason and mentions it in the message', () => {
    const error = new StaffingError('position-occupied');
    expect(error.reason).toBe('position-occupied');
    expect(error.message).toMatch(/position-occupied/);
    expect(error.name).toBe('StaffingError');
    expect(isStaffingError(error)).toBe(true);
    expect(isStaffingError(new Error('x'))).toBe(false);
  });
});
```

In `src/lib/house-membership.test.ts`:
- Replace `TransferError,` in the import list with nothing, and add `import { StaffingError } from './staffing-error';`.
- In `it('rejects a transfer to the same House')`, replace both `TransferError` references with `StaffingError`.
- Replace `toThrow(/already-ending/)` with `toThrow(/not-ongoing/)`.

In `src/server/membership-store.test.ts`, replace `import { TransferError } from '@/lib/house-membership';` with `import { StaffingError } from '@/lib/staffing-error';` and `.rejects.toThrow(TransferError)` with `.rejects.toThrow(StaffingError)`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/roles.test.ts src/lib/staffing-error.test.ts src/lib/house-membership.test.ts src/server/membership-store.test.ts`
Expected: FAIL (`./roles` and `./staffing-error` do not exist).

- [ ] **Step 3: Implement**

```ts
// src/lib/roles.ts
// Occupational roles (SPEC-002 FR-001), shared by both Houses. Keep in sync
// with the rows inserted by the staffing migration (a test checks it). Roles
// carry no schedule and no application permission.
export const ROLES = [
  { code: 'PDG', label: 'Pedagoga' },
  { code: 'PSI', label: 'Psicòloga' },
  { code: 'ER', label: 'Educadora referent' },
  { code: 'TFM', label: 'Treballadora familiar de matins' },
  { code: 'TFT', label: 'Treballadora familiar de tardes' },
  { code: 'ET', label: 'Educadora de tardes' },
  { code: 'ECS', label: 'Educadora de cap de setmana' },
  { code: 'EN', label: 'Educadora de nit' },
  { code: 'CT', label: 'Corretor' },
] as const;

export type Role = (typeof ROLES)[number];
export type RoleCode = Role['code'];

export const ROLE_CODES = ROLES.map((role) => role.code) as [RoleCode, ...RoleCode[]];

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === 'string' && ROLES.some((role) => role.code === value);
}

export function findRole(code: string): Role | undefined {
  return ROLES.find((role) => role.code === code);
}

/** Catalogue position, for grouping positions by role. */
export function roleOrder(code: RoleCode): number {
  return ROLE_CODES.indexOf(code);
}
```

```ts
// src/lib/staffing-error.ts
/**
 * Why a staffing operation was rejected. The domain plans, the store's
 * database error mapping and the Catalan messages share this vocabulary.
 */
export type StaffingErrorReason =
  | 'invalid-dates'
  | 'not-ongoing'
  | 'same-house'
  | 'starts-too-early'
  | 'membership-overlap'
  | 'employee-has-position'
  | 'position-occupied'
  | 'outside-membership'
  | 'future-assignment-blocks'
  | 'label-taken'
  | 'stale'
  | 'not-found'
  | 'operation-conflict';

export class StaffingError extends Error {
  readonly reason: StaffingErrorReason;

  constructor(reason: StaffingErrorReason) {
    super(`Invalid staffing operation: ${reason}`);
    this.name = 'StaffingError';
    this.reason = reason;
  }
}

export function isStaffingError(error: unknown): error is StaffingError {
  return error instanceof StaffingError;
}
```

In `src/lib/house-membership.ts`:
- Add `import { StaffingError } from './staffing-error';`.
- Delete `TransferErrorReason` and the `TransferError` class.
- In `planTransfer`, throw `new StaffingError('not-ongoing')` instead of `'already-ending'`, and `new StaffingError('same-house')` / `new StaffingError('starts-too-early')` for the other two checks.

In `src/server/membership-store.ts`, import `StaffingError` from `@/lib/staffing-error`, drop `TransferError` from the `@/lib/house-membership` import, and throw `new StaffingError('not-ongoing')` when there is no current membership.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib src/server && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.ts src/lib/roles.test.ts src/lib/staffing-error.ts src/lib/staffing-error.test.ts src/lib/house-membership.ts src/lib/house-membership.test.ts src/server/membership-store.ts src/server/membership-store.test.ts
git commit -m "feat(staffing): add the role catalogue and a shared StaffingError

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Staffing queries (pure)

**Covers:** tasks.md 2.3

**Files:**
- Create: `src/lib/staffing.ts`, `src/lib/staffing.test.ts`

**Interfaces:**
- Consumes: `isActiveOn`, `Membership` from `./house-membership`; `RoleCode` from `./roles`; `StaffingError` from `./staffing-error`; `IsoDate` from `./dates`.
- Produces (Tasks 4, 5, 12 extend or use them):
  - `type Period = { startsOn: IsoDate; endsOn: IsoDate | null }`
  - `type Position = { id: string; houseId: string; roleCode: RoleCode; label: string }`
  - `type Assignment = Period & { id: string; employeeId: string; positionId: string; houseId: string }`
  - `periodsOverlap(a: Period, b: Period): boolean`, `periodContains(outer: Period, inner: Period): boolean`, `assertValidPeriod(period: Period): void`
  - `type Occupancy = { position: Position; assignment: Assignment | null }`, `occupancyOn(positions, assignments, date): Occupancy[]`
  - `type TeamRow = { membership: Membership; assignment: Assignment | null }`, `teamOn(memberships, assignments, houseId, date): TeamRow[]`
  - `formerMembers(memberships, houseId, today): Membership[]`
  - `ctOccupantsOn(positions, assignments, houseId, date): Occupancy[]`
  - `type AssignmentConflict = { reason: 'employee-has-position' | 'position-occupied'; assignment: Assignment }`, `findAssignmentConflict(existing, candidate: Period & { employeeId: string; positionId: string }): AssignmentConflict | null`
  - `findContainingMembership(memberships, candidate: Period & { employeeId: string; houseId: string }): Membership | undefined`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/staffing.test.ts
import { describe, expect, it } from 'vitest';
import type { Membership } from './house-membership';
import {
  assertValidPeriod,
  ctOccupantsOn,
  findAssignmentConflict,
  findContainingMembership,
  formerMembers,
  occupancyOn,
  periodContains,
  periodsOverlap,
  teamOn,
  type Assignment,
  type Position,
} from './staffing';

const PF = 'house-pf';
const CA = 'house-ca';

const m = (id: string, employeeId: string, houseId: string, startsOn: string, endsOn: string | null = null): Membership => ({
  id, employeeId, houseId, startsOn, endsOn,
});
const a = (id: string, employeeId: string, positionId: string, houseId: string, startsOn: string, endsOn: string | null = null): Assignment => ({
  id, employeeId, positionId, houseId, startsOn, endsOn,
});
const p = (id: string, houseId: string, roleCode: Position['roleCode'], label: string): Position => ({ id, houseId, roleCode, label });

const er1 = p('er1', PF, 'ER', 'ER 1');
const er2 = p('er2', PF, 'ER', 'ER 2');
const ct1 = p('ct1', PF, 'CT', 'CT 1');
const ct2 = p('ct2', PF, 'CT', 'CT 2');
const ctA = p('ctA', CA, 'CT', 'CT A');

describe('periods', () => {
  it('overlap with inclusive bounds and open ends', () => {
    expect(periodsOverlap({ startsOn: '2026-01-01', endsOn: '2026-06-30' }, { startsOn: '2026-06-30', endsOn: null })).toBe(true);
    expect(periodsOverlap({ startsOn: '2026-01-01', endsOn: '2026-06-30' }, { startsOn: '2026-07-01', endsOn: null })).toBe(false);
    expect(periodsOverlap({ startsOn: '2026-01-01', endsOn: null }, { startsOn: '2030-01-01', endsOn: '2030-01-02' })).toBe(true);
  });

  it('contain only when the whole inner period fits', () => {
    expect(periodContains({ startsOn: '2026-01-01', endsOn: null }, { startsOn: '2026-02-01', endsOn: null })).toBe(true);
    expect(periodContains({ startsOn: '2026-01-01', endsOn: '2026-06-30' }, { startsOn: '2026-02-01', endsOn: null })).toBe(false);
    expect(periodContains({ startsOn: '2026-02-01', endsOn: null }, { startsOn: '2026-01-01', endsOn: '2026-03-01' })).toBe(false);
  });

  it('rejects an end before the start', () => {
    expect(() => assertValidPeriod({ startsOn: '2026-05-01', endsOn: '2026-04-30' })).toThrow(/invalid-dates/);
    expect(() => assertValidPeriod({ startsOn: '2026-05-01', endsOn: '2026-05-01' })).not.toThrow();
  });
});

describe('occupancyOn', () => {
  it('shows a future occupant only from its start (AC-008)', () => {
    const assignments = [a('a1', 'marta', 'er1', PF, '2026-09-01')];
    expect(occupancyOn([er1], assignments, '2026-08-15')[0].assignment).toBeNull();
    expect(occupancyOn([er1], assignments, '2026-09-01')[0].assignment?.employeeId).toBe('marta');
  });

  it('keeps one position across successive occupants (AC-004)', () => {
    const assignments = [a('a1', 'marta', 'er1', PF, '2026-01-01', '2026-06-30'), a('a2', 'ana', 'er1', PF, '2026-07-01')];
    expect(occupancyOn([er1], assignments, '2026-06-30')[0].assignment?.employeeId).toBe('marta');
    expect(occupancyOn([er1], assignments, '2026-07-01')[0].assignment?.employeeId).toBe('ana');
  });
});

describe('teamOn', () => {
  const memberships = [
    m('m1', 'ana', PF, '2026-01-01', '2026-06-30'),
    m('m2', 'ana', CA, '2026-07-01'),
    m('m3', 'nuria', PF, '2025-09-01'),
  ];
  const assignments = [a('a1', 'ana', 'er1', PF, '2026-01-01', '2026-06-30')];

  it('lists members with their position or none', () => {
    const rows = teamOn(memberships, assignments, PF, '2026-03-01');
    expect(rows.map((r) => [r.membership.employeeId, r.assignment?.positionId ?? null])).toEqual([
      ['ana', 'er1'],
      ['nuria', null],
    ]);
  });

  it('follows the dated records before and after a transfer (AC-014)', () => {
    expect(teamOn(memberships, assignments, PF, '2026-06-30').map((r) => r.membership.employeeId)).toEqual(['ana', 'nuria']);
    expect(teamOn(memberships, assignments, PF, '2026-07-01').map((r) => r.membership.employeeId)).toEqual(['nuria']);
    expect(teamOn(memberships, assignments, CA, '2026-07-01').map((r) => r.membership.employeeId)).toEqual(['ana']);
  });

  it('shows a returning employee once (AC-024)', () => {
    const returning = [m('r1', 'pau', PF, '2025-01-01', '2025-06-30'), m('r2', 'pau', PF, '2026-03-01')];
    expect(teamOn(returning, [], PF, '2026-04-01')).toHaveLength(1);
  });

  it('ignores an assignment in another House on the same date', () => {
    const other = [a('x', 'nuria', 'ctA', CA, '2026-01-01')];
    expect(teamOn(memberships, other, PF, '2026-03-01').find((r) => r.membership.employeeId === 'nuria')?.assignment).toBeNull();
  });
});

describe('formerMembers', () => {
  it('lists people with a completed period who are not members today', () => {
    const memberships = [
      m('m1', 'ana', PF, '2025-01-01', '2025-06-30'),
      m('m2', 'ana', PF, '2026-01-01', '2026-06-30'),
      m('m3', 'nuria', PF, '2025-09-01'),
      m('m4', 'pau', PF, '2025-01-01', '2025-12-31'),
      m('m5', 'pau', PF, '2026-03-01'),
      m('m6', 'joan', PF, '2027-01-01', '2027-02-01'),
    ];
    expect(formerMembers(memberships, PF, '2026-08-01').map((x) => [x.employeeId, x.id])).toEqual([['ana', 'm2']]);
  });
});

describe('ctOccupantsOn', () => {
  it('keeps vacant CT positions and stays inside the House (FR-007)', () => {
    const assignments = [a('a1', 'jordi', 'ct1', PF, '2025-09-01', '2026-06-30'), a('a2', 'pau', 'ctA', CA, '2025-09-01')];
    const pf = ctOccupantsOn([er1, ct1, ct2, ctA], assignments, PF, '2026-06-30');
    expect(pf.map((o) => [o.position.id, o.assignment?.employeeId ?? null])).toEqual([
      ['ct1', 'jordi'],
      ['ct2', null],
    ]);
    expect(ctOccupantsOn([ct1, ct2], assignments, PF, '2026-07-01').every((o) => o.assignment === null)).toBe(true);
  });
});

describe('findAssignmentConflict', () => {
  const existing = [a('a1', 'marta', 'er1', PF, '2026-01-01', '2026-06-30')];

  it('reports an occupied position (AC-005)', () => {
    expect(findAssignmentConflict(existing, { employeeId: 'ana', positionId: 'er1', startsOn: '2026-06-30', endsOn: null })?.reason).toBe('position-occupied');
  });

  it('allows the adjacent day', () => {
    expect(findAssignmentConflict(existing, { employeeId: 'ana', positionId: 'er1', startsOn: '2026-07-01', endsOn: null })).toBeNull();
  });

  it('reports a second position for the same employee', () => {
    expect(findAssignmentConflict(existing, { employeeId: 'marta', positionId: 'er2', startsOn: '2026-03-01', endsOn: null })?.reason).toBe('employee-has-position');
  });
});

describe('findContainingMembership', () => {
  const memberships = [m('m1', 'ana', PF, '2026-01-01', '2026-06-30')];

  it('finds the single membership that covers the interval', () => {
    expect(findContainingMembership(memberships, { employeeId: 'ana', houseId: PF, startsOn: '2026-02-01', endsOn: '2026-06-30' })?.id).toBe('m1');
  });

  it('rejects an open assignment on a finite membership and another House (AC-007)', () => {
    expect(findContainingMembership(memberships, { employeeId: 'ana', houseId: PF, startsOn: '2026-06-01', endsOn: null })).toBeUndefined();
    expect(findContainingMembership(memberships, { employeeId: 'ana', houseId: CA, startsOn: '2026-02-01', endsOn: '2026-03-01' })).toBeUndefined();
  });
});

// Keep the fixtures referenced so TypeScript does not flag unused positions.
void er2;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/staffing.test.ts`
Expected: FAIL (`./staffing` does not exist).

- [ ] **Step 3: Implement**

```ts
// src/lib/staffing.ts
//
// Pure staffing rules (SPEC-002): positions, dated assignments, the team and
// occupancy on a date, and the plans for every staffing write. No Prisma here.
// The database enforces the same rules (staffing migration) and
// src/server/staffing-store.ts runs these plans inside transactions.
import type { IsoDate } from './dates';
import { isActiveOn, type Membership } from './house-membership';
import type { RoleCode } from './roles';
import { StaffingError } from './staffing-error';

/** Inclusive calendar dates; `endsOn: null` means ongoing. */
export type Period = { startsOn: IsoDate; endsOn: IsoDate | null };

/** A stable staffing slot. House and role never change after creation. */
export type Position = { id: string; houseId: string; roleCode: RoleCode; label: string };

/** A dated occupancy of a position. Its House is stored at creation (BR-005). */
export type Assignment = Period & { id: string; employeeId: string; positionId: string; houseId: string };

const OPEN_END: IsoDate = '9999-12-31';

function lastDay(period: Period): IsoDate {
  return period.endsOn ?? OPEN_END;
}

export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startsOn <= lastDay(b) && b.startsOn <= lastDay(a);
}

export function periodContains(outer: Period, inner: Period): boolean {
  return outer.startsOn <= inner.startsOn && lastDay(outer) >= lastDay(inner);
}

export function assertValidPeriod(period: Period): void {
  if (period.endsOn !== null && period.endsOn < period.startsOn) throw new StaffingError('invalid-dates');
}

export type Occupancy = { position: Position; assignment: Assignment | null };

/** Each position with its occupant on `date`, or none (vacant). Future occupants do not fill it early. */
export function occupancyOn(positions: readonly Position[], assignments: readonly Assignment[], date: IsoDate): Occupancy[] {
  return positions.map((position) => ({
    position,
    assignment: assignments.find((a) => a.positionId === position.id && isActiveOn(a, date)) ?? null,
  }));
}

export type TeamRow = { membership: Membership; assignment: Assignment | null };

/**
 * Members of `houseId` on `date` with their position that day, or none.
 * Memberships never overlap, so each employee appears at most once.
 */
export function teamOn(
  memberships: readonly Membership[],
  assignments: readonly Assignment[],
  houseId: string,
  date: IsoDate,
): TeamRow[] {
  return memberships
    .filter((m) => m.houseId === houseId && isActiveOn(m, date))
    .map((membership) => ({
      membership,
      assignment:
        assignments.find((a) => a.employeeId === membership.employeeId && a.houseId === houseId && isActiveOn(a, date)) ?? null,
    }));
}

/**
 * Employees with a completed membership in `houseId` who are not members of it
 * on `today`, each with their latest completed period there.
 */
export function formerMembers(memberships: readonly Membership[], houseId: string, today: IsoDate): Membership[] {
  const inHouse = memberships.filter((m) => m.houseId === houseId);
  const current = new Set(inHouse.filter((m) => isActiveOn(m, today)).map((m) => m.employeeId));
  const latest = new Map<string, Membership>();
  for (const m of inHouse) {
    if (current.has(m.employeeId) || m.endsOn === null || m.endsOn >= today) continue;
    const seen = latest.get(m.employeeId);
    if (!seen || seen.startsOn < m.startsOn) latest.set(m.employeeId, m);
  }
  return [...latest.values()];
}

/** The House's CT positions with their occupant on `date` (FR-007). Vacant CT positions stay listed. */
export function ctOccupantsOn(
  positions: readonly Position[],
  assignments: readonly Assignment[],
  houseId: string,
  date: IsoDate,
): Occupancy[] {
  return occupancyOn(
    positions.filter((p) => p.houseId === houseId && p.roleCode === 'CT'),
    assignments,
    date,
  );
}

export type AssignmentConflict = { reason: 'employee-has-position' | 'position-occupied'; assignment: Assignment };

/** Mirrors the two exclusion constraints on assignments (one occupant per position, one position per employee). */
export function findAssignmentConflict(
  existing: readonly Assignment[],
  candidate: Period & { employeeId: string; positionId: string },
): AssignmentConflict | null {
  for (const assignment of existing) {
    if (!periodsOverlap(assignment, candidate)) continue;
    if (assignment.positionId === candidate.positionId) return { reason: 'position-occupied', assignment };
    if (assignment.employeeId === candidate.employeeId) return { reason: 'employee-has-position', assignment };
  }
  return null;
}

/** Mirrors the containment trigger: the one membership of the same employee and House covering the whole interval. */
export function findContainingMembership(
  memberships: readonly Membership[],
  candidate: Period & { employeeId: string; houseId: string },
): Membership | undefined {
  return memberships.find(
    (m) => m.employeeId === candidate.employeeId && m.houseId === candidate.houseId && periodContains(m, candidate),
  );
}
```

Delete the trailing `void er2;` line from the test if `er2` ends up used; it is only there to keep the fixture list complete.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/staffing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staffing.ts src/lib/staffing.test.ts
git commit -m "feat(staffing): add pure occupancy, team and former-member queries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Handover and end-assignment plans

**Covers:** tasks.md 2.4

**Files:**
- Modify: `src/lib/staffing.ts`
- Create: `src/lib/staffing-plans.test.ts`

**Interfaces:**
- Consumes: Task 3 types and helpers; `addDays` from `./dates`.
- Produces:
  - `type PlanClose = { kind: 'assignment' | 'membership'; id: string; employeeId: string; houseId: string; positionId: string | null; endsOn: IsoDate }`
  - `type PlanOpenMembership = { kind: 'membership'; employeeId: string; houseId: string; startsOn: IsoDate; endsOn: IsoDate | null }`
  - `type PlanOpenAssignment = { kind: 'assignment'; employeeId: string; positionId: string; houseId: string; startsOn: IsoDate; endsOn: IsoDate | null }`
  - `type PlanOpen = PlanOpenMembership | PlanOpenAssignment`
  - `type StaffingPlan = { closes: PlanClose[]; opens: PlanOpen[] }` (closes run first; then memberships open, then assignments)
  - `type HandoverInput = { position: Position; incomingEmployeeId: string; startsOn: IsoDate; endsOn: IsoDate | null; positionAssignments: readonly Assignment[]; incomingAssignments: readonly Assignment[]; incomingMemberships: readonly Membership[] }`
  - `planHandover(input: HandoverInput): StaffingPlan`
  - `planEndAssignment(assignment: Assignment, endsOn: IsoDate): StaffingPlan`
  - internal helpers `closeAssignment`, `closeMembership`, `closeBefore` (used again in Task 5)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/staffing-plans.test.ts
import { describe, expect, it } from 'vitest';
import type { Membership } from './house-membership';
import { planEndAssignment, planHandover, type Assignment, type Position } from './staffing';

const PF = 'house-pf';
const er1: Position = { id: 'er1', houseId: PF, roleCode: 'ER', label: 'ER 1' };
const er2: Position = { id: 'er2', houseId: PF, roleCode: 'ER', label: 'ER 2' };
const m = (id: string, employeeId: string, startsOn: string, endsOn: string | null = null): Membership => ({
  id, employeeId, houseId: PF, startsOn, endsOn,
});
const a = (id: string, employeeId: string, positionId: string, startsOn: string, endsOn: string | null = null): Assignment => ({
  id, employeeId, positionId, houseId: PF, startsOn, endsOn,
});

describe('planHandover', () => {
  const memberships = [m('mA', 'ana', '2026-01-01'), m('mM', 'marta', '2025-09-01')];

  it('replaces the occupant on the same position (AC-004)', () => {
    const marta = a('aM', 'marta', 'er1', '2025-09-01');
    const plan = planHandover({
      position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
      positionAssignments: [marta], incomingAssignments: [], incomingMemberships: memberships,
    });
    expect(plan).toEqual({
      closes: [{ kind: 'assignment', id: 'aM', employeeId: 'marta', houseId: PF, positionId: 'er1', endsOn: '2026-06-30' }],
      opens: [{ kind: 'assignment', employeeId: 'ana', positionId: 'er1', houseId: PF, startsOn: '2026-07-01', endsOn: null }],
    });
  });

  it('assigns a vacant position', () => {
    const plan = planHandover({
      position: er2, incomingEmployeeId: 'ana', startsOn: '2026-03-01', endsOn: '2026-05-31',
      positionAssignments: [], incomingAssignments: [], incomingMemberships: memberships,
    });
    expect(plan.closes).toEqual([]);
    expect(plan.opens).toHaveLength(1);
  });

  it('moves an employee within the House and leaves membership alone', () => {
    const ana = a('aA', 'ana', 'er1', '2026-01-01');
    const plan = planHandover({
      position: er2, incomingEmployeeId: 'ana', startsOn: '2026-04-01', endsOn: null,
      positionAssignments: [], incomingAssignments: [ana], incomingMemberships: memberships,
    });
    expect(plan.closes).toEqual([{ kind: 'assignment', id: 'aA', employeeId: 'ana', houseId: PF, positionId: 'er1', endsOn: '2026-03-31' }]);
    expect(plan.closes.some((c) => c.kind === 'membership')).toBe(false);
  });

  it('rejects a handover blocked by a future assignment', () => {
    const future = a('aF', 'marta', 'er1', '2026-09-01');
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
        positionAssignments: [future], incomingAssignments: [], incomingMemberships: memberships,
      }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects an outgoing assignment that starts on D', () => {
    const sameDay = a('aS', 'marta', 'er1', '2026-07-01');
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
        positionAssignments: [sameDay], incomingAssignments: [], incomingMemberships: memberships,
      }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects assigning someone to the position they already hold', () => {
    const ana = a('aA', 'ana', 'er1', '2026-01-01');
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: null,
        positionAssignments: [ana], incomingAssignments: [ana], incomingMemberships: memberships,
      }),
    ).toThrow(/employee-has-position/);
  });

  it('rejects an assignment beyond the membership (AC-007)', () => {
    const finite = [m('mA', 'ana', '2026-01-01', '2026-06-30')];
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-06-01', endsOn: null,
        positionAssignments: [], incomingAssignments: [], incomingMemberships: finite,
      }),
    ).toThrow(/outside-membership/);
  });

  it('rejects an end before the start', () => {
    expect(() =>
      planHandover({
        position: er1, incomingEmployeeId: 'ana', startsOn: '2026-07-01', endsOn: '2026-06-01',
        positionAssignments: [], incomingAssignments: [], incomingMemberships: memberships,
      }),
    ).toThrow(/invalid-dates/);
  });
});

describe('planEndAssignment', () => {
  it('closes an ongoing assignment', () => {
    expect(planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01'), '2026-08-31').closes).toEqual([
      { kind: 'assignment', id: 'a1', employeeId: 'ana', houseId: PF, positionId: 'er1', endsOn: '2026-08-31' },
    ]);
  });

  it('allows a one-day assignment', () => {
    expect(planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01'), '2026-05-01').closes[0].endsOn).toBe('2026-05-01');
  });

  it('rejects an end before the start', () => {
    expect(() => planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01'), '2026-04-30')).toThrow(/invalid-dates/);
  });

  it('rejects an assignment that already ended', () => {
    expect(() => planEndAssignment(a('a1', 'ana', 'er1', '2026-05-01', '2026-06-30'), '2026-07-31')).toThrow(/not-ongoing/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/staffing-plans.test.ts`
Expected: FAIL (`planHandover` is not exported).

- [ ] **Step 3: Implement (append to `src/lib/staffing.ts`)**

Change the dates import at the top to `import { addDays, type IsoDate } from './dates';`, then append:

```ts
// ── Plans ─────────────────────────────────────────────────────────────────────

export type PlanClose = {
  kind: 'assignment' | 'membership';
  id: string;
  employeeId: string;
  houseId: string;
  positionId: string | null;
  endsOn: IsoDate;
};

export type PlanOpenMembership = {
  kind: 'membership';
  employeeId: string;
  houseId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
};

export type PlanOpenAssignment = {
  kind: 'assignment';
  employeeId: string;
  positionId: string;
  houseId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
};

export type PlanOpen = PlanOpenMembership | PlanOpenAssignment;

/** Closes run first, then new memberships, then new assignments. Nothing is ever deleted. */
export type StaffingPlan = { closes: PlanClose[]; opens: PlanOpen[] };

function closeAssignment(assignment: Assignment, endsOn: IsoDate): PlanClose {
  return {
    kind: 'assignment',
    id: assignment.id,
    employeeId: assignment.employeeId,
    houseId: assignment.houseId,
    positionId: assignment.positionId,
    endsOn,
  };
}

function closeMembership(membership: Membership, endsOn: IsoDate): PlanClose {
  return {
    kind: 'membership',
    id: membership.id,
    employeeId: membership.employeeId,
    houseId: membership.houseId,
    positionId: null,
    endsOn,
  };
}

/**
 * Assignments overlapping a period that starts on D are closed on D-1. One
 * that starts on or after D could only be cancelled, so the whole operation is
 * rejected instead (FR-004, AC-013).
 */
function closeBefore(assignments: readonly Assignment[], period: Period): PlanClose[] {
  return assignments
    .filter((assignment) => periodsOverlap(assignment, period))
    .map((assignment) => {
      if (assignment.startsOn >= period.startsOn) throw new StaffingError('future-assignment-blocks');
      return closeAssignment(assignment, addDays(period.startsOn, -1));
    });
}

export type HandoverInput = {
  position: Position;
  incomingEmployeeId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  /** Every assignment of the position. */
  positionAssignments: readonly Assignment[];
  /** Every assignment of the incoming employee, in any House. */
  incomingAssignments: readonly Assignment[];
  /** Every membership of the incoming employee. */
  incomingMemberships: readonly Membership[];
};

/**
 * Assign a vacant position, replace its occupant, or move someone to another
 * position (FR-004). On D the position's occupant and the incoming employee's
 * own position are both closed on D-1, then the incoming assignment opens.
 * Membership never changes.
 */
export function planHandover(input: HandoverInput): StaffingPlan {
  const period: Period = { startsOn: input.startsOn, endsOn: input.endsOn };
  assertValidPeriod(period);
  const candidate = {
    ...period,
    employeeId: input.incomingEmployeeId,
    positionId: input.position.id,
    houseId: input.position.houseId,
  };
  const holdsIt = input.positionAssignments.some(
    (a) => a.employeeId === input.incomingEmployeeId && periodsOverlap(a, period),
  );
  if (holdsIt) throw new StaffingError('employee-has-position');
  if (!findContainingMembership(input.incomingMemberships, candidate)) throw new StaffingError('outside-membership');

  const closes = [
    ...closeBefore(input.positionAssignments, period),
    ...closeBefore(input.incomingAssignments.filter((a) => a.positionId !== input.position.id), period),
  ];
  return { closes, opens: [{ kind: 'assignment', ...candidate }] };
}

/** Ends an ongoing assignment; closed assignments are never edited. */
export function planEndAssignment(assignment: Assignment, endsOn: IsoDate): StaffingPlan {
  if (assignment.endsOn !== null) throw new StaffingError('not-ongoing');
  if (endsOn < assignment.startsOn) throw new StaffingError('invalid-dates');
  return { closes: [closeAssignment(assignment, endsOn)], opens: [] };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/staffing.test.ts src/lib/staffing-plans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staffing.ts src/lib/staffing-plans.test.ts
git commit -m "feat(staffing): plan handovers and the end of an assignment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Membership and House-transfer plans

**Covers:** tasks.md 2.5, 2.6

**Files:**
- Modify: `src/lib/staffing.ts`, `src/lib/staffing-plans.test.ts`

**Interfaces:**
- Consumes: Task 4 plan types and `closeAssignment`, `closeMembership`, `closeBefore`; `planTransfer` from `./house-membership`.
- Produces:
  - `type NewMembershipInput = { employeeId: string; houseId: string; startsOn: IsoDate; endsOn: IsoDate | null; position: Position | null; employeeMemberships: readonly Membership[]; employeeAssignments: readonly Assignment[]; positionAssignments: readonly Assignment[] }`, `planNewMembership(input): StaffingPlan`
  - `type EndMembershipInput = { membership: Membership; endsOn: IsoDate; assignments: readonly Assignment[] }`, `planEndMembership(input): StaffingPlan`
  - `type HouseTransferInput = { source: Membership; toHouseId: string; startsOn: IsoDate; destinationPosition: Position | null; employeeMemberships: readonly Membership[]; employeeAssignments: readonly Assignment[]; destinationPositionAssignments: readonly Assignment[] }`, `planHouseTransfer(input): StaffingPlan`

- [ ] **Step 1: Write the failing tests (append to `src/lib/staffing-plans.test.ts`)**

Add `planEndMembership, planHouseTransfer, planNewMembership` to the import from `./staffing`, then append:

```ts
const CA = 'house-ca';
const erA: Position = { id: 'erA', houseId: CA, roleCode: 'ER', label: 'ER A' };

describe('planNewMembership', () => {
  it('opens a membership and an assignment over the same interval (AC-001)', () => {
    const plan = planNewMembership({
      employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null, position: er1,
      employeeMemberships: [], employeeAssignments: [], positionAssignments: [],
    });
    expect(plan).toEqual({
      closes: [],
      opens: [
        { kind: 'membership', employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null },
        { kind: 'assignment', employeeId: 'ana', positionId: 'er1', houseId: PF, startsOn: '2026-01-01', endsOn: null },
      ],
    });
  });

  it('rejects an occupied initial position (AC-002)', () => {
    expect(() =>
      planNewMembership({
        employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null, position: er1,
        employeeMemberships: [], employeeAssignments: [], positionAssignments: [a('aM', 'marta', 'er1', '2025-09-01')],
      }),
    ).toThrow(/position-occupied/);
  });

  it('rejects a position of another House', () => {
    expect(() =>
      planNewMembership({
        employeeId: 'ana', houseId: PF, startsOn: '2026-01-01', endsOn: null, position: erA,
        employeeMemberships: [], employeeAssignments: [], positionAssignments: [],
      }),
    ).toThrow(/not-found/);
  });

  it('accepts a return after a gap and rejects an overlap (AC-024)', () => {
    const past = [m('m1', 'pau', '2025-01-01', '2025-12-31')];
    expect(
      planNewMembership({
        employeeId: 'pau', houseId: PF, startsOn: '2026-03-01', endsOn: null, position: null,
        employeeMemberships: past, employeeAssignments: [], positionAssignments: [],
      }).opens,
    ).toHaveLength(1);
    expect(() =>
      planNewMembership({
        employeeId: 'pau', houseId: PF, startsOn: '2025-12-31', endsOn: null, position: null,
        employeeMemberships: past, employeeAssignments: [], positionAssignments: [],
      }),
    ).toThrow(/membership-overlap/);
  });

  it('rejects an end before the start', () => {
    expect(() =>
      planNewMembership({
        employeeId: 'ana', houseId: PF, startsOn: '2026-03-01', endsOn: '2026-02-01', position: null,
        employeeMemberships: [], employeeAssignments: [], positionAssignments: [],
      }),
    ).toThrow(/invalid-dates/);
  });
});

describe('planEndMembership', () => {
  const laia = m('mL', 'laia', '2025-09-01');

  it('closes the crossing assignment with the membership (AC-016)', () => {
    const plan = planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2025-09-01')] });
    expect(plan.closes).toEqual([
      { kind: 'assignment', id: 'aL', employeeId: 'laia', houseId: PF, positionId: 'er1', endsOn: '2026-08-31' },
      { kind: 'membership', id: 'mL', employeeId: 'laia', houseId: PF, positionId: null, endsOn: '2026-08-31' },
    ]);
  });

  it('leaves an assignment that already ends before the date', () => {
    const plan = planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2025-09-01', '2026-01-31')] });
    expect(plan.closes.map((c) => c.id)).toEqual(['mL']);
  });

  it('closes an assignment that starts on the end date', () => {
    const plan = planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2026-08-31')] });
    expect(plan.closes[0]).toMatchObject({ id: 'aL', endsOn: '2026-08-31' });
  });

  it('is blocked by an assignment that starts after the end', () => {
    expect(() =>
      planEndMembership({ membership: laia, endsOn: '2026-08-31', assignments: [a('aL', 'laia', 'er1', '2026-09-15')] }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects a membership that already ended or an end before its start', () => {
    expect(() => planEndMembership({ membership: m('x', 'laia', '2025-09-01', '2026-01-01'), endsOn: '2026-08-31', assignments: [] })).toThrow(/not-ongoing/);
    expect(() => planEndMembership({ membership: laia, endsOn: '2025-08-31', assignments: [] })).toThrow(/invalid-dates/);
  });
});

describe('planHouseTransfer', () => {
  const source = m('mA', 'ana', '2026-01-01');
  const anaEr1 = a('aA', 'ana', 'er1', '2026-01-01');

  it('closes source membership and assignment on D-1 and opens the destination (AC-009)', () => {
    const plan = planHouseTransfer({
      source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: erA,
      employeeMemberships: [source], employeeAssignments: [anaEr1], destinationPositionAssignments: [],
    });
    expect(plan).toEqual({
      closes: [
        { kind: 'assignment', id: 'aA', employeeId: 'ana', houseId: PF, positionId: 'er1', endsOn: '2026-06-30' },
        { kind: 'membership', id: 'mA', employeeId: 'ana', houseId: PF, positionId: null, endsOn: '2026-06-30' },
      ],
      opens: [
        { kind: 'membership', employeeId: 'ana', houseId: CA, startsOn: '2026-07-01', endsOn: null },
        { kind: 'assignment', employeeId: 'ana', positionId: 'erA', houseId: CA, startsOn: '2026-07-01', endsOn: null },
      ],
    });
  });

  it('transfers without a destination position (AC-011)', () => {
    const plan = planHouseTransfer({
      source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: null,
      employeeMemberships: [source], employeeAssignments: [], destinationPositionAssignments: [],
    });
    expect(plan.opens).toEqual([{ kind: 'membership', employeeId: 'ana', houseId: CA, startsOn: '2026-07-01', endsOn: null }]);
  });

  it('rejects an occupied destination, same House, early date and a non-ongoing source (AC-010)', () => {
    const base = {
      source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: erA,
      employeeMemberships: [source], employeeAssignments: [], destinationPositionAssignments: [] as Assignment[],
    };
    expect(() => planHouseTransfer({ ...base, destinationPositionAssignments: [{ ...a('x', 'pau', 'erA', '2025-01-01'), houseId: CA }] })).toThrow(/position-occupied/);
    expect(() => planHouseTransfer({ ...base, toHouseId: PF, destinationPosition: null })).toThrow(/same-house/);
    expect(() => planHouseTransfer({ ...base, startsOn: '2026-01-01' })).toThrow(/starts-too-early/);
    expect(() => planHouseTransfer({ ...base, source: { ...source, endsOn: '2026-06-30' } })).toThrow(/not-ongoing/);
  });

  it('rejects a future source assignment instead of cancelling it (AC-013)', () => {
    expect(() =>
      planHouseTransfer({
        source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: null,
        employeeMemberships: [source], employeeAssignments: [a('aF', 'ana', 'er2', '2026-07-15')], destinationPositionAssignments: [],
      }),
    ).toThrow(/future-assignment-blocks/);
  });

  it('rejects a destination that overlaps another planned membership', () => {
    const later = { ...m('mL', 'ana', '2027-01-01'), houseId: CA };
    expect(() =>
      planHouseTransfer({
        source: { ...source, endsOn: null }, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: null,
        employeeMemberships: [source, later], employeeAssignments: [], destinationPositionAssignments: [],
      }),
    ).toThrow(/membership-overlap/);
  });

  it('rejects a destination position from the source House', () => {
    expect(() =>
      planHouseTransfer({
        source, toHouseId: CA, startsOn: '2026-07-01', destinationPosition: er2,
        employeeMemberships: [source], employeeAssignments: [], destinationPositionAssignments: [],
      }),
    ).toThrow(/not-found/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/staffing-plans.test.ts`
Expected: FAIL (`planNewMembership` is not exported).

- [ ] **Step 3: Implement (append to `src/lib/staffing.ts`)**

Change the membership import to `import { isActiveOn, planTransfer, type Membership } from './house-membership';`, then append:

```ts
export type NewMembershipInput = {
  employeeId: string;
  houseId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  /** Optional position for the same interval; must belong to `houseId`. */
  position: Position | null;
  employeeMemberships: readonly Membership[];
  employeeAssignments: readonly Assignment[];
  positionAssignments: readonly Assignment[];
};

/** A new membership period (past, current or future) with an optional position (FR-002, FR-003). */
export function planNewMembership(input: NewMembershipInput): StaffingPlan {
  const period: Period = { startsOn: input.startsOn, endsOn: input.endsOn };
  assertValidPeriod(period);
  if (input.employeeMemberships.some((m) => periodsOverlap(m, period))) throw new StaffingError('membership-overlap');
  const opens: PlanOpen[] = [{ kind: 'membership', employeeId: input.employeeId, houseId: input.houseId, ...period }];
  if (input.position) {
    if (input.position.houseId !== input.houseId) throw new StaffingError('not-found');
    const conflict = findAssignmentConflict([...input.positionAssignments, ...input.employeeAssignments], {
      ...period,
      employeeId: input.employeeId,
      positionId: input.position.id,
    });
    if (conflict) throw new StaffingError(conflict.reason);
    opens.push({ kind: 'assignment', employeeId: input.employeeId, positionId: input.position.id, houseId: input.houseId, ...period });
  }
  return { closes: [], opens };
}

export type EndMembershipInput = {
  membership: Membership;
  endsOn: IsoDate;
  /** Every assignment of the employee. */
  assignments: readonly Assignment[];
};

/**
 * Ends an ongoing membership (FR-003). Its assignments that run past the end
 * close on the same day; one that starts after the end blocks the operation
 * rather than being deleted.
 */
export function planEndMembership(input: EndMembershipInput): StaffingPlan {
  const { membership, endsOn } = input;
  if (membership.endsOn !== null) throw new StaffingError('not-ongoing');
  if (endsOn < membership.startsOn) throw new StaffingError('invalid-dates');
  const closes = input.assignments
    .filter(
      (a) =>
        a.employeeId === membership.employeeId &&
        a.houseId === membership.houseId &&
        a.startsOn >= membership.startsOn &&
        lastDay(a) > endsOn,
    )
    .map((a) => {
      if (a.startsOn > endsOn) throw new StaffingError('future-assignment-blocks');
      return closeAssignment(a, endsOn);
    });
  return { closes: [...closes, closeMembership(membership, endsOn)], opens: [] };
}

export type HouseTransferInput = {
  /** The employee's ongoing membership in the House the transfer starts from. */
  source: Membership;
  toHouseId: string;
  startsOn: IsoDate;
  destinationPosition: Position | null;
  employeeMemberships: readonly Membership[];
  employeeAssignments: readonly Assignment[];
  destinationPositionAssignments: readonly Assignment[];
};

/**
 * House transfer (FR-006): SPEC-001's rule (close the membership on D-1, open
 * the destination on D) plus the source assignment crossing D closed on D-1
 * and an optional destination assignment from D, as one plan.
 */
export function planHouseTransfer(input: HouseTransferInput): StaffingPlan {
  const membershipPlan = planTransfer(input.source, input.toHouseId, input.startsOn);
  const fromD: Period = { startsOn: input.startsOn, endsOn: null };
  if (input.employeeMemberships.some((m) => m.id !== input.source.id && periodsOverlap(m, fromD))) {
    throw new StaffingError('membership-overlap');
  }
  const sourceAssignments = input.employeeAssignments.filter((a) => a.houseId === input.source.houseId);
  const closes = [...closeBefore(sourceAssignments, fromD), closeMembership(input.source, membershipPlan.close.endsOn)];
  const opens: PlanOpen[] = [
    { kind: 'membership', employeeId: input.source.employeeId, houseId: input.toHouseId, startsOn: input.startsOn, endsOn: null },
  ];
  if (input.destinationPosition) {
    if (input.destinationPosition.houseId !== input.toHouseId) throw new StaffingError('not-found');
    if (input.destinationPositionAssignments.some((a) => periodsOverlap(a, fromD))) throw new StaffingError('position-occupied');
    opens.push({
      kind: 'assignment',
      employeeId: input.source.employeeId,
      positionId: input.destinationPosition.id,
      houseId: input.toHouseId,
      ...fromD,
    });
  }
  return { closes, opens };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staffing.ts src/lib/staffing-plans.test.ts
git commit -m "feat(staffing): plan new and ended memberships and House transfers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Form schemas, Catalan messages and period formatting

**Covers:** tasks.md 2.8

**Files:**
- Create: `src/lib/staffing-schemas.ts`, `src/lib/staffing-schemas.test.ts`, `src/lib/staffing-messages.ts`, `src/lib/staffing-messages.test.ts`, `src/lib/ids.ts`, `src/lib/ids.test.ts`
- Modify: `src/lib/dates.ts`, `src/lib/dates.test.ts` (add `formatPeriodCa`)

**Interfaces:**
- Consumes: `isIsoDate`, `formatDateCa` from `./dates`; `ROLE_CODES` from `./roles`; `HOUSES` from `./houses`; `StaffingErrorReason`; `StaffingPlan` from `./staffing`.
- Produces:
  - `isUuid(value: string): boolean` (`src/lib/ids.ts`)
  - `formatPeriodCa(period: { startsOn: IsoDate; endsOn: IsoDate | null }): string`
  - Form schemas (react-hook-form): `createPositionSchema`, `relabelPositionSchema`, `createPersonSchema`, `addMembershipSchema`, `editNameSchema`, `handoverSchema`, `endAssignmentSchema`, `endMembershipSchema`, `transferSchema`
  - Request schemas (Server Functions; two-step ones add `intent` and `planToken`): `handoverRequestSchema`, `endMembershipRequestSchema`, `transferRequestSchema`
  - `type FormInput<S> = z.input<S>`, `type FormOutput<S> = z.output<S>`
  - `errorMessage(reason: StaffingErrorReason): string`, `INVALID_FORM: string`, `UNEXPECTED_ERROR: string`
  - `type PlanNames = { employees: Record<string, string>; positions: Record<string, string>; houses: Record<string, string> }`, `describePlan(plan: StaffingPlan, names: PlanNames): string[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ids.test.ts
import { describe, expect, it } from 'vitest';
import { isUuid } from './ids';

describe('isUuid', () => {
  it('accepts canonical UUIDs only', () => {
    expect(isUuid('6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f')).toBe(true);
    expect(isUuid('6F1C2E7A-0B3D-4C5E-8F90-1A2B3C4D5E6F')).toBe(true);
    expect(isUuid('abc')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f/x')).toBe(false);
  });
});
```

Append to `src/lib/dates.test.ts` (add `formatPeriodCa` to its import):

```ts
describe('formatPeriodCa', () => {
  it('writes closed and open periods in Catalan', () => {
    expect(formatPeriodCa({ startsOn: '2026-01-01', endsOn: '2026-06-30' })).toBe('Del 1 de gener del 2026 al 30 de juny del 2026');
    expect(formatPeriodCa({ startsOn: '2026-07-01', endsOn: null })).toBe('Des del 1 de juliol del 2026');
  });
});
```

```ts
// src/lib/staffing-schemas.test.ts
import { describe, expect, it } from 'vitest';
import {
  createPersonSchema,
  createPositionSchema,
  editNameSchema,
  handoverRequestSchema,
  transferRequestSchema,
} from './staffing-schemas';

const OP = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';
const POS = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';

describe('createPersonSchema', () => {
  it('trims the name and turns empty optional fields into null', () => {
    expect(createPersonSchema.parse({ operationId: OP, fullName: '  Ana Puig ', startsOn: '2026-01-01', endsOn: '', positionId: '' })).toEqual({
      operationId: OP, fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: null,
    });
  });

  it('accepts its own output again (the client sends parsed values)', () => {
    const once = createPersonSchema.parse({ operationId: OP, fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: POS });
    expect(createPersonSchema.parse(once)).toEqual(once);
  });

  it('rejects a blank name, an invalid date and an end before the start', () => {
    const blank = createPersonSchema.safeParse({ operationId: OP, fullName: '   ', startsOn: '2026-01-01', endsOn: '', positionId: '' });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0].message).toBe('Escriu el nom complet.');
    expect(createPersonSchema.safeParse({ operationId: OP, fullName: 'Ana', startsOn: '2026-02-30', endsOn: '', positionId: '' }).success).toBe(false);
    const backwards = createPersonSchema.safeParse({ operationId: OP, fullName: 'Ana', startsOn: '2026-03-01', endsOn: '2026-02-01', positionId: '' });
    expect(backwards.error?.issues[0].path).toEqual(['endsOn']);
  });

  it('rejects non-UUID identifiers', () => {
    expect(createPersonSchema.safeParse({ operationId: 'x', fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: '' }).success).toBe(false);
    expect(createPersonSchema.safeParse({ operationId: OP, fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: 'abc' }).success).toBe(false);
  });

  it('drops permission fields smuggled into the payload (AC-020)', () => {
    const parsed = createPersonSchema.parse({
      operationId: OP, fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: '',
      role: 'director', clerkUserId: 'user_x', houseId: 'evil',
    });
    expect(Object.keys(parsed).sort()).toEqual(['endsOn', 'fullName', 'operationId', 'positionId', 'startsOn']);
  });
});

describe('createPositionSchema', () => {
  it('accepts catalogue roles only', () => {
    expect(createPositionSchema.safeParse({ operationId: OP, roleCode: 'CT', label: 'CT nit' }).success).toBe(true);
    expect(createPositionSchema.safeParse({ operationId: OP, roleCode: 'director', label: 'X' }).success).toBe(false);
    expect(createPositionSchema.safeParse({ operationId: OP, roleCode: 'CT', label: '  ' }).success).toBe(false);
  });
});

describe('editNameSchema', () => {
  it('needs the loaded version', () => {
    expect(editNameSchema.safeParse({ operationId: OP, employeeId: POS, fullName: 'Anna', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' }).success).toBe(true);
    expect(editNameSchema.safeParse({ operationId: OP, employeeId: POS, fullName: 'Anna', expectedUpdatedAt: 'yesterday' }).success).toBe(false);
  });
});

describe('two-step requests', () => {
  const handover = { operationId: OP, positionId: POS, employeeId: POS, startsOn: '2026-07-01', endsOn: '', from: 'position' };

  it('needs a plan token to confirm', () => {
    expect(handoverRequestSchema.safeParse({ ...handover, intent: 'preview' }).success).toBe(true);
    expect(handoverRequestSchema.safeParse({ ...handover, intent: 'confirm' }).success).toBe(false);
    expect(handoverRequestSchema.safeParse({ ...handover, intent: 'confirm', planToken: 'a'.repeat(64) }).success).toBe(true);
  });

  it('accepts only known Houses as transfer destination', () => {
    const transfer = { operationId: OP, employeeId: POS, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: '', intent: 'preview' };
    expect(transferRequestSchema.safeParse(transfer).success).toBe(true);
    expect(transferRequestSchema.safeParse({ ...transfer, toHouseSlug: 'evil' }).success).toBe(false);
  });
});
```

```ts
// src/lib/staffing-messages.test.ts
import { describe, expect, it } from 'vitest';
import type { StaffingErrorReason } from './staffing-error';
import { describePlan, errorMessage } from './staffing-messages';

const ALL: StaffingErrorReason[] = [
  'invalid-dates', 'not-ongoing', 'same-house', 'starts-too-early', 'membership-overlap', 'employee-has-position',
  'position-occupied', 'outside-membership', 'future-assignment-blocks', 'label-taken', 'stale', 'not-found', 'operation-conflict',
];

describe('errorMessage', () => {
  it('has Catalan copy for every reason', () => {
    for (const reason of ALL) expect(errorMessage(reason)).toMatch(/\.$/);
    expect(errorMessage('stale')).toBe('Les dades han canviat mentrestant. Torna a carregar la pàgina.');
  });
});

describe('describePlan', () => {
  it('lists closes, then opens, with people, positions, Houses and dates', () => {
    const lines = describePlan(
      {
        closes: [
          { kind: 'assignment', id: 'a1', employeeId: 'e1', houseId: 'pf', positionId: 'p1', endsOn: '2026-06-30' },
          { kind: 'membership', id: 'm1', employeeId: 'e1', houseId: 'pf', positionId: null, endsOn: '2026-06-30' },
        ],
        opens: [
          { kind: 'membership', employeeId: 'e1', houseId: 'ca', startsOn: '2026-07-01', endsOn: null },
          { kind: 'assignment', employeeId: 'e1', positionId: 'p2', houseId: 'ca', startsOn: '2026-07-01', endsOn: '2026-12-31' },
        ],
      },
      { employees: { e1: 'Ana Puig' }, positions: { p1: 'ER 1', p2: 'ER A' }, houses: { pf: 'Paulo Freire', ca: 'Carme Aymerich' } },
    );
    expect(lines).toEqual([
      'Ana Puig: lloc ER 1 a Paulo Freire acaba el 30 de juny del 2026.',
      'Ana Puig: pertinença a Paulo Freire acaba el 30 de juny del 2026.',
      'Ana Puig: pertinença a Carme Aymerich comença el 1 de juliol del 2026.',
      'Ana Puig: lloc ER A a Carme Aymerich comença el 1 de juliol del 2026 i acaba el 31 de desembre del 2026.',
    ]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/ids.test.ts src/lib/dates.test.ts src/lib/staffing-schemas.test.ts src/lib/staffing-messages.test.ts`
Expected: FAIL (modules and `formatPeriodCa` missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/ids.ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards IDs from URLs before they reach Postgres (a malformed UUID would raise 22P02). */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
```

Append to `src/lib/dates.ts`:

```ts
/** "Del 1 de gener del 2026 al 30 de juny del 2026" or "Des del 1 de juliol del 2026". */
export function formatPeriodCa(period: { startsOn: IsoDate; endsOn: IsoDate | null }): string {
  return period.endsOn
    ? `Del ${formatDateCa(period.startsOn)} al ${formatDateCa(period.endsOn)}`
    : `Des del ${formatDateCa(period.startsOn)}`;
}
```

```ts
// src/lib/staffing-schemas.ts
//
// One schema per staffing form, shared by react-hook-form in the browser and
// by the Server Functions. z.object strips unknown keys, so smuggled fields
// (role, clerkUserId, houseId) never reach the store (FR-008, AC-020). Optional
// fields accept '' from inputs and null from already-parsed values, so the
// client can send its parsed output and the server parses it again.
import { z } from 'zod';
import { isIsoDate } from './dates';
import { HOUSES, type HouseSlug } from './houses';
import { ROLE_CODES } from './roles';

const isoDate = z.string().refine(isIsoDate, { message: 'Introdueix una data vàlida.' });
const optionalIsoDate = z.union([isoDate, z.literal(''), z.null()]).transform((value) => value || null);
const id = z.uuid({ message: 'La selecció no és vàlida.' });
const optionalId = z.union([id, z.literal(''), z.null()]).transform((value) => value || null);
const fullName = z.string().trim().min(1, 'Escriu el nom complet.').max(120, 'El nom és massa llarg.');
const label = z.string().trim().min(1, 'Escriu un nom per al lloc.').max(60, 'El nom és massa llarg.');
const planToken = z.string().regex(/^[0-9a-f]{64}$/);
const HOUSE_SLUGS = HOUSES.map((house) => house.slug) as [HouseSlug, ...HouseSlug[]];

const END_BEFORE_START = { message: "La data de final no pot ser anterior a la d'inici.", path: ['endsOn'] };
const endNotBeforeStart = (value: { startsOn: string; endsOn: string | null }) =>
  value.endsOn === null || value.endsOn >= value.startsOn;

export const createPositionSchema = z.object({
  operationId: id,
  roleCode: z.enum(ROLE_CODES, { message: 'Tria un rol.' }),
  label,
});

export const relabelPositionSchema = z.object({ operationId: id, positionId: id, label });

export const createPersonSchema = z
  .object({ operationId: id, fullName, startsOn: isoDate, endsOn: optionalIsoDate, positionId: optionalId })
  .refine(endNotBeforeStart, END_BEFORE_START);

export const addMembershipSchema = z
  .object({ operationId: id, employeeId: id, startsOn: isoDate, endsOn: optionalIsoDate, positionId: optionalId })
  .refine(endNotBeforeStart, END_BEFORE_START);

export const editNameSchema = z.object({
  operationId: id,
  employeeId: id,
  fullName,
  expectedUpdatedAt: z.iso.datetime(),
});

export const handoverSchema = z
  .object({
    operationId: id,
    positionId: id,
    employeeId: id,
    startsOn: isoDate,
    endsOn: optionalIsoDate,
    from: z.enum(['employee', 'position']),
  })
  .refine(endNotBeforeStart, END_BEFORE_START);

export const endAssignmentSchema = z.object({ operationId: id, assignmentId: id, endsOn: isoDate });

export const endMembershipSchema = z.object({ operationId: id, membershipId: id, endsOn: isoDate });

export const transferSchema = z.object({
  operationId: id,
  employeeId: id,
  toHouseSlug: z.enum(HOUSE_SLUGS),
  startsOn: isoDate,
  destinationPositionId: optionalId,
});

// Two-step operations: a preview writes nothing; a confirm must carry the
// preview's plan token (stale check in the store).
const twoStep = { intent: z.enum(['preview', 'confirm']), planToken: planToken.optional() };
const confirmHasToken = (value: { intent: 'preview' | 'confirm'; planToken?: string }) =>
  value.intent === 'preview' || value.planToken !== undefined;
const MISSING_TOKEN = { message: 'Torna a revisar els canvis abans de confirmar.', path: ['planToken'] };

export const handoverRequestSchema = handoverSchema.and(z.object(twoStep)).refine(confirmHasToken, MISSING_TOKEN);
export const endMembershipRequestSchema = endMembershipSchema.extend(twoStep).refine(confirmHasToken, MISSING_TOKEN);
export const transferRequestSchema = transferSchema.extend(twoStep).refine(confirmHasToken, MISSING_TOKEN);

export type FormInput<S extends z.ZodType> = z.input<S>;
export type FormOutput<S extends z.ZodType> = z.output<S>;
```

`handoverSchema` is refined (a `ZodPipe`-like type), so it cannot `.extend()`; `.and()` intersects it with the two-step fields. `z.object` in an intersection still strips unknown keys on each side, so smuggled fields are still dropped (the AC-020 test covers `createPersonSchema`; Task 17 covers the actions).

```ts
// src/lib/staffing-messages.ts
// Catalan copy for staffing errors and plan previews. Messages never name the
// conflicting person: the store's error type carries no personal data.
import { formatDateCa } from './dates';
import type { StaffingPlan } from './staffing';
import type { StaffingErrorReason } from './staffing-error';

const MESSAGES: Record<StaffingErrorReason, string> = {
  'invalid-dates': "La data de final no pot ser anterior a la d'inici.",
  'not-ongoing': 'Aquest període ja té data de final.',
  'same-house': "La casa de destinació ha de ser diferent de l'actual.",
  'starts-too-early': "La data del trasllat ha de ser posterior a l'inici de la pertinença actual.",
  'membership-overlap': "Aquestes dates se solapen amb un altre període d'aquesta persona.",
  'employee-has-position': 'Aquesta persona ja té un lloc assignat en aquestes dates.',
  'position-occupied': 'Aquest lloc ja està ocupat en aquestes dates.',
  'outside-membership': "El lloc ha de quedar dins d'un període de pertinença a aquesta casa.",
  'future-assignment-blocks': "Hi ha una assignació futura que hi entra en conflicte. No s'ha canviat res.",
  'label-taken': 'Ja hi ha un lloc amb aquest nom en aquesta casa.',
  stale: 'Les dades han canviat mentrestant. Torna a carregar la pàgina.',
  'not-found': 'No hem trobat aquest registre en aquesta casa.',
  'operation-conflict': "Aquest formulari ja s'ha fet servir per a una altra acció. Torna a carregar la pàgina.",
};

export const INVALID_FORM = 'Revisa les dades del formulari.';
export const UNEXPECTED_ERROR = "No s'ha pogut desar. Torna-ho a provar d'aquí a una estona.";

export function errorMessage(reason: StaffingErrorReason): string {
  return MESSAGES[reason];
}

export type PlanNames = {
  employees: Record<string, string>;
  positions: Record<string, string>;
  houses: Record<string, string>;
};

type PlanItem = { kind: 'assignment' | 'membership'; employeeId: string; houseId: string; positionId?: string | null };

/** One Catalan line per change, closes first, for the confirmation screen. */
export function describePlan(plan: StaffingPlan, names: PlanNames): string[] {
  const subject = (item: PlanItem) => {
    const house = names.houses[item.houseId] ?? '';
    return item.kind === 'assignment' && item.positionId
      ? `lloc ${names.positions[item.positionId] ?? ''} a ${house}`
      : `pertinença a ${house}`;
  };
  const who = (item: PlanItem) => names.employees[item.employeeId] ?? '';
  return [
    ...plan.closes.map((close) => `${who(close)}: ${subject(close)} acaba el ${formatDateCa(close.endsOn)}.`),
    ...plan.opens.map(
      (open) =>
        `${who(open)}: ${subject(open)} comença el ${formatDateCa(open.startsOn)}` +
        (open.endsOn ? ` i acaba el ${formatDateCa(open.endsOn)}.` : '.'),
    ),
  ];
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib && npm run typecheck`
Expected: PASS. If `z.iso.datetime()` rejects the `toISOString()` format with milliseconds, use `z.iso.datetime({ precision: 3 })` and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ids.ts src/lib/ids.test.ts src/lib/dates.ts src/lib/dates.test.ts src/lib/staffing-schemas.ts src/lib/staffing-schemas.test.ts src/lib/staffing-messages.ts src/lib/staffing-messages.test.ts
git commit -m "feat(staffing): add shared form schemas and Catalan staffing copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 7: Schema, staffing migration and database constraint tests

**Covers:** tasks.md 3.1, 3.2, 3.3, 3.4

**Files:**
- Modify: `prisma/schema.prisma`, `test/db/helpers.ts` (position and assignment fixtures)
- Create: `prisma/migrations/20261008100000_staffing/migration.sql`
- Create (tests): `src/lib/staffing-migration.test.ts`, `src/server/staffing-constraints.db.test.ts`, `src/server/staffing-upgrade.db.test.ts`

**Interfaces:**
- Consumes: Task 1 harness; `ROLES` (Task 2).
- Produces:
  - Prisma models `OccupationalRole`, `Position` (`labelKey` maintained by the database), `PositionAssignment`, `AccessGrant` (PK `clerkUserId`), `EmployeeAccountLink` (PK `employeeId`, unique `clerkUserId`), `OperationReceipt`; `Employee.updatedAt` (`@updatedAt`).
  - Constraint names the store maps (Task 8): `house_memberships_no_overlap`, `house_memberships_period_check`, `position_assignments_employee_no_overlap`, `position_assignments_position_no_overlap`, `position_assignments_period_check`, `positions_house_id_label_key_key`, `operation_receipts_pkey`; SQLSTATEs `CI001` (assignment outside membership) and `CI002` (position House/role changed).
  - Test helpers: `insertPosition(db, houseId, roleCode, label): Promise<string>`, `insertAssignment(db, employeeId, positionId, houseId, startsOn, endsOn?): Promise<string>`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/staffing-migration.test.ts
// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLES } from './roles';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function staffingMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_staffing'));
  if (!folder) throw new Error('staffing migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('staffing migration', () => {
  const sql = staffingMigration();

  it('inserts exactly the roles listed in ROLES, idempotently', () => {
    const block = sql.slice(sql.indexOf('INSERT INTO "occupational_roles"'));
    const rows = [...block.slice(0, block.indexOf(';')).matchAll(/\('([A-Z]+)', '([^']+)'\)/g)].map(([, code, label]) => ({ code, label }));
    expect(rows).toEqual(ROLES.map(({ code, label }) => ({ code, label })));
    expect(block).toMatch(/ON CONFLICT \("code"\) DO NOTHING/);
  });

  it('keeps the hand-written constraints and triggers', () => {
    for (const name of [
      '"positions_normalise_and_freeze"',
      '"positions_label_not_blank"',
      '"position_assignments_period_check"',
      '"position_assignments_employee_no_overlap"',
      '"position_assignments_position_no_overlap"',
      '"assert_assignments_within_membership"',
      '"position_assignments_within_membership"',
      '"house_memberships_keep_assignments"',
    ]) {
      expect(sql).toContain(name);
    }
    expect(sql).toContain("ERRCODE = 'CI001'");
    expect(sql).toContain("ERRCODE = 'CI002'");
    expect(sql.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(2);
    expect(sql).toContain('FOREIGN KEY ("position_id", "house_id") REFERENCES "positions"("id", "house_id")');
  });
});
```

```ts
// src/server/staffing-constraints.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isoDateToDate } from '@/lib/dates';
import {
  createTestClient,
  expectPgError,
  houseIds,
  insertAssignment,
  insertEmployee,
  insertMembership,
  insertPosition,
  resetData,
} from '../../test/db/helpers';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

describe('role catalogue', () => {
  it('has the nine roles and tolerates a re-run', async () => {
    expect(await db.occupationalRole.count()).toBe(9);
    await db.$executeRawUnsafe(`INSERT INTO "occupational_roles" ("code", "label") VALUES ('CT', 'Corretor') ON CONFLICT ("code") DO NOTHING`);
    expect(await db.occupationalRole.count()).toBe(9);
  });
});

describe('positions', () => {
  it('trims labels and keeps them unique per House ignoring case', async () => {
    const { pf, ca } = await houseIds(db);
    const id = await insertPosition(db, pf, 'CT', '  CT nit ');
    expect((await db.position.findUniqueOrThrow({ where: { id } })).label).toBe('CT nit');
    await expectPgError(insertPosition(db, pf, 'CT', ' ct NIT '), '23505');
    await expect(insertPosition(db, ca, 'CT', 'CT nit')).resolves.toBeTypeOf('string');
  });

  it('compares accented labels case-insensitively', async () => {
    const { pf } = await houseIds(db);
    await insertPosition(db, pf, 'ER', 'Àrea');
    await expectPgError(insertPosition(db, pf, 'ER', 'àrea'), '23505');
  });

  it('freezes House and role but allows relabelling', async () => {
    const { pf, ca } = await houseIds(db);
    const id = await insertPosition(db, pf, 'ER', 'ER 1');
    await expectPgError(db.position.update({ where: { id }, data: { roleCode: 'CT' } }), 'CI002');
    await expectPgError(db.position.update({ where: { id }, data: { houseId: ca } }), 'CI002');
    const relabelled = await db.position.update({ where: { id }, data: { label: 'ER matins' } });
    expect(relabelled).toMatchObject({ id, label: 'ER matins', labelKey: 'er matins', roleCode: 'ER', houseId: pf });
  });
});

describe('position assignments', () => {
  async function setup() {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    const marta = await insertEmployee(db, 'Marta Soler');
    await insertMembership(db, ana, pf, '2026-01-01');
    await insertMembership(db, marta, pf, '2025-09-01');
    const er1 = await insertPosition(db, pf, 'ER', 'ER 1');
    const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
    return { pf, ca, ana, marta, er1, er2 };
  }

  it('rejects a second occupant on overlapping dates and accepts the adjacent day (AC-005)', async () => {
    const { pf, ana, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01', '2026-06-30');
    await expectPgError(
      db.$executeRaw`INSERT INTO "position_assignments" ("employee_id", "position_id", "house_id", "starts_on") VALUES (${ana}::uuid, ${er1}::uuid, ${pf}::uuid, '2026-06-30')`,
      '23P01',
    );
    await expect(insertAssignment(db, ana, er1, pf, '2026-07-01')).resolves.toBeTypeOf('string');
  });

  it('rejects two positions for one employee on the same date', async () => {
    const { pf, ana, er1, er2 } = await setup();
    await insertAssignment(db, ana, er1, pf, '2026-01-01');
    await expectPgError(insertAssignment(db, ana, er2, pf, '2026-03-01'), '23P01');
  });

  it("rejects an assignment stored with another House than its position's", async () => {
    const { ca, ana, er2 } = await setup();
    await expectPgError(insertAssignment(db, ana, er2, ca, '2027-01-01'), '23503');
  });

  it('rejects an end before the start', async () => {
    const { pf, ana, er1 } = await setup();
    await expectPgError(insertAssignment(db, ana, er1, pf, '2026-03-01', '2026-02-01'), '23514');
  });

  it('rejects an open assignment on a finite membership (AC-007)', async () => {
    const { pf, er1 } = await setup();
    const pol = await insertEmployee(db, 'Pol Mas');
    await insertMembership(db, pol, pf, '2026-01-01', '2026-06-30');
    await expectPgError(insertAssignment(db, pol, er1, pf, '2026-06-01'), 'CI001');
  });

  it('rejects shortening a membership below its assignment, checked at commit', async () => {
    const { pf, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await expectPgError(
      db.houseMembership.updateMany({ where: { employeeId: marta }, data: { endsOn: isoDateToDate('2026-08-31') } }),
      'CI001',
    );
  });

  it('accepts closing membership and assignment in either order inside one transaction', async () => {
    const { pf, marta, er1 } = await setup();
    const assignment = await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await db.$transaction(async (tx) => {
      await tx.houseMembership.updateMany({ where: { employeeId: marta }, data: { endsOn: isoDateToDate('2026-08-31') } });
      await tx.positionAssignment.update({ where: { id: assignment }, data: { endsOn: isoDateToDate('2026-08-31') } });
    });
    expect((await db.positionAssignment.findUniqueOrThrow({ where: { id: assignment } })).endsOn).toEqual(isoDateToDate('2026-08-31'));
  });

  it('deleting an employee removes memberships, assignments and the link, and keeps positions and grants', async () => {
    const { pf, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    await db.employeeAccountLink.create({ data: { employeeId: marta, clerkUserId: 'user_marta' } });
    await db.accessGrant.create({ data: { clerkUserId: 'user_marta', role: 'director' } });
    await db.employee.delete({ where: { id: marta } });
    expect(await db.houseMembership.count({ where: { employeeId: marta } })).toBe(0);
    expect(await db.positionAssignment.count({ where: { employeeId: marta } })).toBe(0);
    expect(await db.employeeAccountLink.count()).toBe(0);
    expect(await db.position.count({ where: { id: er1 } })).toBe(1);
    expect(await db.accessGrant.count()).toBe(1);
  });
});
```

```ts
// src/server/staffing-upgrade.db.test.ts
//
// AC-022: applying the staffing migration to a database that already holds
// SPEC-001 data keeps IDs, names, dates and the membership constraints.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, inject } from 'vitest';

const url = new URL(inject('databaseUrl'));
const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
const migration = (suffix: string) => {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith(suffix));
  if (!folder) throw new Error(`${suffix} migration not found`);
  return join(migrationsDir, folder, 'migration.sql');
};

function psql(database: string, args: string[]): string {
  return execFileSync(
    join(inject('pgBin'), 'psql'),
    ['-h', 'localhost', '-p', url.port, '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q', '-tA', ...args],
    { encoding: 'utf8', stdio: 'pipe' },
  ).trim();
}

const ANA = '00000000-0000-4000-8000-0000000000a1';

describe('staffing migration over SPEC-001 data', () => {
  beforeAll(() => {
    psql('casa_test', ['-c', 'DROP DATABASE IF EXISTS casa_upgrade']);
    psql('casa_test', ['-c', 'CREATE DATABASE casa_upgrade']);
    psql('casa_upgrade', ['-f', migration('_house_context')]);
    psql('casa_upgrade', [
      '-c',
      `INSERT INTO employees (id, full_name) VALUES ('${ANA}', 'Ana Puig');
       INSERT INTO house_memberships (employee_id, house_id, starts_on, ends_on)
         SELECT '${ANA}', id, '2025-09-01', '2026-06-30' FROM houses WHERE slug = 'paulo-freire';
       INSERT INTO house_memberships (employee_id, house_id, starts_on)
         SELECT '${ANA}', id, '2026-07-01' FROM houses WHERE slug = 'carme-aymerich';`,
    ]);
    psql('casa_upgrade', ['-f', migration('_staffing')]);
  });

  it('keeps employees and membership dates, and adds no assignments', () => {
    expect(psql('casa_upgrade', ['-c', `SELECT id || '|' || full_name FROM employees`])).toBe(`${ANA}|Ana Puig`);
    expect(psql('casa_upgrade', ['-c', `SELECT starts_on || '|' || coalesce(ends_on::text, '') FROM house_memberships ORDER BY starts_on`])).toBe(
      '2025-09-01|2026-06-30\n2026-07-01|',
    );
    expect(psql('casa_upgrade', ['-c', 'SELECT count(*) FROM position_assignments'])).toBe('0');
  });

  it('still rejects overlapping memberships', () => {
    expect(() =>
      psql('casa_upgrade', [
        '-c',
        `INSERT INTO house_memberships (employee_id, house_id, starts_on) SELECT '${ANA}', id, '2026-06-01' FROM houses WHERE slug = 'paulo-freire'`,
      ]),
    ).toThrow(/house_memberships_no_overlap/);
  });
});
```

Add to `test/db/helpers.ts`:

```ts
export async function insertPosition(db: PrismaClient, houseId: string, roleCode: string, label: string): Promise<string> {
  return (await db.position.create({ data: { houseId, roleCode, label } })).id;
}

export async function insertAssignment(
  db: PrismaClient,
  employeeId: string,
  positionId: string,
  houseId: string,
  startsOn: IsoDate,
  endsOn: IsoDate | null = null,
): Promise<string> {
  const row = await db.positionAssignment.create({
    data: { employeeId, positionId, houseId, startsOn: isoDateToDate(startsOn), endsOn: endsOn ? isoDateToDate(endsOn) : null },
  });
  return row.id;
}
```


- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/staffing-migration.test.ts && npm run test:db`
Expected: FAIL (no `_staffing` migration; `db.position` does not exist on the client).

- [ ] **Step 3: Extend `prisma/schema.prisma`**

Replace the `House` and `Employee` models and append the new models:

```prisma
/// One of the two Cases d'Infants. Rows are inserted by the house_context
/// migration; keep them in sync with HOUSES in src/lib/houses.ts.
model House {
  id          String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug        String               @unique
  name        String
  memberships HouseMembership[]
  positions   Position[]
  assignments PositionAssignment[]

  @@map("houses")
}

/// Minimal on purpose (GDPR minimisation): a full name only. Staffing,
/// account links and grants live in their own tables.
model Employee {
  id          String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  fullName    String               @map("full_name")
  createdAt   DateTime             @default(now()) @map("created_at")
  /// Version for stale name edits (design D6).
  updatedAt   DateTime             @default(now()) @updatedAt @map("updated_at")
  memberships HouseMembership[]
  assignments PositionAssignment[]
  accountLink EmployeeAccountLink?

  @@map("employees")
}
```

```prisma
/// Occupational role catalogue (SPEC-002 FR-001). Rows are inserted by the
/// staffing migration; keep them in sync with ROLES in src/lib/roles.ts.
model OccupationalRole {
  code      String     @id
  label     String
  positions Position[]

  @@map("occupational_roles")
}

/// A stable staffing slot. The staffing migration adds a trigger that trims
/// `label`, derives `labelKey` (lower case) and forbids changing `houseId` or
/// `roleCode` (SQLSTATE CI002). Never write `labelKey` from the app.
model Position {
  id          String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  houseId     String               @map("house_id") @db.Uuid
  roleCode    String               @map("role_code")
  label       String
  labelKey    String               @default("") @map("label_key")
  createdAt   DateTime             @default(now()) @map("created_at")
  house       House                @relation(fields: [houseId], references: [id], onDelete: Restrict)
  role        OccupationalRole     @relation(fields: [roleCode], references: [code], onDelete: Restrict)
  assignments PositionAssignment[]

  @@unique([houseId, labelKey])
  @@unique([id, houseId])
  @@map("positions")
}

/// A dated occupancy (inclusive dates, endsOn null = ongoing). The staffing
/// migration adds what Prisma cannot express: CHECK (ends_on >= starts_on),
/// EXCLUDE constraints (one position per employee and one occupant per
/// position on any date) and a deferred trigger that keeps every assignment
/// inside one membership of the same employee and House (SQLSTATE CI001).
/// The composite relation makes the House match the position's House.
model PositionAssignment {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId String    @map("employee_id") @db.Uuid
  positionId String    @map("position_id") @db.Uuid
  houseId    String    @map("house_id") @db.Uuid
  startsOn   DateTime  @map("starts_on") @db.Date
  endsOn     DateTime? @map("ends_on") @db.Date
  createdAt  DateTime  @default(now()) @map("created_at")
  employee   Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  position   Position  @relation(fields: [positionId, houseId], references: [id, houseId], onDelete: Restrict)
  house      House     @relation(fields: [houseId], references: [id], onDelete: Restrict)

  @@index([houseId, startsOn])
  @@index([employeeId])
  @@index([positionId])
  @@map("position_assignments")
}

/// Application access (design D9). Enabled = role 'director' and no
/// revokedAt. Provisioned only by `npm run access`; never by a form.
model AccessGrant {
  clerkUserId String    @id @map("clerk_user_id")
  role        String
  grantedAt   DateTime  @default(now()) @map("granted_at")
  revokedAt   DateTime? @map("revoked_at")

  @@map("access_grants")
}

/// Optional link between an employee and a Clerk user. Grants nothing.
/// Managed only by `npm run account-link`.
model EmployeeAccountLink {
  employeeId  String   @id @map("employee_id") @db.Uuid
  clerkUserId String   @unique @map("clerk_user_id")
  linkedAt    DateTime @default(now()) @map("linked_at")
  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("employee_account_links")
}

/// One row per applied staffing write: double-submit protection and a
/// minimal "who did what, when" trail. `result` holds IDs only, never names.
model OperationReceipt {
  id               String   @id @db.Uuid
  kind             String
  actorClerkUserId String   @map("actor_clerk_user_id")
  result           Json?
  createdAt        DateTime @default(now()) @map("created_at")

  @@map("operation_receipts")
}
```

Also update the `HouseMembership` doc comment's last line to mention the staffing trigger: `/// The staffing migration adds a deferred trigger: shortening or deleting a membership must not strand an assignment (SQLSTATE CI001).`

- [ ] **Step 4: Generate the migration against a throwaway local Postgres (never Supabase)**

The helper applies the existing migrations to a fresh database, then runs the diff against it:

```bash
mkdir -p prisma/migrations/20261008100000_staffing
npx tsx test/db/with-postgres.ts -- npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/20261008100000_staffing/migration.sql
```

Check the generated file contains `ALTER TABLE "employees" ADD COLUMN "updated_at"`, six `CREATE TABLE`s and the FK `"position_assignments_position_id_house_id_fkey" FOREIGN KEY ("position_id", "house_id") REFERENCES "positions"("id", "house_id")`. Then append this block, verbatim, at the end of the file:

```sql

-- Hand-written: Prisma cannot express these. Do not remove.

-- Occupational roles (FR-001). Keep in sync with ROLES in src/lib/roles.ts.
INSERT INTO "occupational_roles" ("code", "label") VALUES
  ('PDG', 'Pedagoga'),
  ('PSI', 'Psicòloga'),
  ('ER', 'Educadora referent'),
  ('TFM', 'Treballadora familiar de matins'),
  ('TFT', 'Treballadora familiar de tardes'),
  ('ET', 'Educadora de tardes'),
  ('ECS', 'Educadora de cap de setmana'),
  ('EN', 'Educadora de nit'),
  ('CT', 'Corretor')
ON CONFLICT ("code") DO NOTHING;

-- Positions: the label is trimmed and label_key (lower case) is derived here,
-- so House-local uniqueness ignores case and spaces even for direct SQL.
-- House and role are frozen after creation (SQLSTATE CI002).
CREATE FUNCTION "positions_normalise_and_freeze"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."house_id" IS DISTINCT FROM OLD."house_id" OR NEW."role_code" IS DISTINCT FROM OLD."role_code") THEN
    RAISE EXCEPTION 'position house and role are immutable' USING ERRCODE = 'CI002';
  END IF;
  NEW."label" := btrim(NEW."label", E' \t\r\n');
  NEW."label_key" := lower(NEW."label");
  RETURN NEW;
END $$;

CREATE TRIGGER "positions_normalise_and_freeze"
  BEFORE INSERT OR UPDATE ON "positions"
  FOR EACH ROW EXECUTE FUNCTION "positions_normalise_and_freeze"();

ALTER TABLE "positions"
  ADD CONSTRAINT "positions_label_not_blank" CHECK ("label" <> '');

-- Assignments: valid period, one position per employee and one occupant per
-- position on any date (BR-004).
ALTER TABLE "position_assignments"
  ADD CONSTRAINT "position_assignments_period_check"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "position_assignments"
  ADD CONSTRAINT "position_assignments_employee_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  );

ALTER TABLE "position_assignments"
  ADD CONSTRAINT "position_assignments_position_no_overlap"
  EXCLUDE USING gist (
    "position_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  );

-- Containment (BR-003): every assignment lies inside one membership of the same
-- employee and House. Checked at commit (deferred), after locking the employee
-- row so concurrent writes for one person serialise. SQLSTATE CI001.
CREATE FUNCTION "assert_assignments_within_membership"(p_employee uuid, p_house uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  bad uuid;
BEGIN
  PERFORM 1 FROM "employees" WHERE "id" = p_employee FOR UPDATE;
  SELECT a."id" INTO bad
    FROM "position_assignments" a
   WHERE a."employee_id" = p_employee
     AND a."house_id" = p_house
     AND NOT EXISTS (
       SELECT 1 FROM "house_memberships" m
        WHERE m."employee_id" = a."employee_id"
          AND m."house_id" = a."house_id"
          AND m."starts_on" <= a."starts_on"
          AND COALESCE(m."ends_on", 'infinity'::date) >= COALESCE(a."ends_on", 'infinity'::date)
     )
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'assignment % is outside its membership', bad USING ERRCODE = 'CI001';
  END IF;
END $$;

CREATE FUNCTION "position_assignments_check_containment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "assert_assignments_within_membership"(NEW."employee_id", NEW."house_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "position_assignments_within_membership"
  AFTER INSERT OR UPDATE ON "position_assignments"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "position_assignments_check_containment"();

CREATE FUNCTION "house_memberships_check_containment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "assert_assignments_within_membership"(OLD."employee_id", OLD."house_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "house_memberships_keep_assignments"
  AFTER UPDATE OR DELETE ON "house_memberships"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "house_memberships_check_containment"();
```

Then prove there is no drift (Prisma must not try to undo the hand-written SQL). The helper now applies both migrations before running the diff:

```bash
npx tsx test/db/with-postgres.ts -- npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
npm run db:generate
```

Expected: the setup applies `20261008100000_staffing` without errors; the diff prints `-- This is an empty migration.`

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/staffing-migration.test.ts && npm run test:db && npm run typecheck`
Expected: PASS (all of `membership-constraints`, `staffing-constraints`, `staffing-upgrade`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261008100000_staffing test/db src/lib/staffing-migration.test.ts src/server/staffing-constraints.db.test.ts src/server/staffing-upgrade.db.test.ts
git commit -m "feat(db): add roles, positions, assignments, grants and receipts with hand-written constraints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Store foundation: error mapping, operation template, plan tokens, row mappers

**Covers:** tasks.md 4.1, 2.7

**Files:**
- Create: `src/server/db-errors.ts`, `src/server/db-errors.test.ts`, `src/server/operation.ts`, `src/server/plan-token.ts`, `src/server/plan-token.test.ts`, `src/server/rows.ts`, `src/server/operation.db.test.ts`
- Modify: `test/db/helpers.ts` (`ctx()`)

**Interfaces:**
- Consumes: Task 7 client and constraint names; `StaffingError`; `StaffingPlan`, `Assignment`, `Position` (Task 3/4); `Membership`.
- Produces:
  - `pgErrorOf(error: unknown): { code: string; constraint: string | null } | null`, `isReceiptConflict(error: unknown): boolean`, `toStaffingError(error: unknown): unknown`
  - `type Tx = Prisma.TransactionClient`, `type OperationContext = { operationId: string; actor: string }`, `type OperationResult = Record<string, string | null>`, `type Outcome<T extends OperationResult> = { status: 'applied' | 'already-applied'; result: T }`
  - `runOperation<T extends OperationResult>(db: PrismaClient, ctx: OperationContext, kind: string, employeeIds: readonly string[], work: (tx: Tx) => Promise<T>): Promise<Outcome<T>>`, `lockEmployees(tx: Tx, employeeIds: readonly string[]): Promise<void>`
  - `planToken(plan: StaffingPlan): string` (64 hex chars)
  - `toMembership(row)`, `toAssignment(row)`, `toPosition(row)` (Prisma rows to domain types)
  - test helper `ctx(operationId?: string): OperationContext`

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/db-errors.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { StaffingError } from '@/lib/staffing-error';
import { isReceiptConflict, pgErrorOf, toStaffingError } from './db-errors';

// Shapes observed from Prisma 7 + @prisma/adapter-pg (spike, 2026-10-08).
function adapterError(code: string, message: string) {
  return Object.assign(new Error(message), { name: 'DriverAdapterError', cause: { originalCode: code, originalMessage: message, kind: 'postgres' } });
}
function knownError(prismaCode: string, code: string, message: string) {
  return Object.assign(new Error('Invalid invocation'), {
    name: 'PrismaClientKnownRequestError',
    code: prismaCode,
    meta: { driverAdapterError: { name: 'DriverAdapterError', cause: { originalCode: code, originalMessage: message } } },
  });
}

const reason = (error: unknown) => (toStaffingError(error) as StaffingError).reason;

describe('pgErrorOf', () => {
  it('reads both error shapes', () => {
    expect(pgErrorOf(adapterError('23P01', 'conflicting key value violates exclusion constraint "position_assignments_position_no_overlap"'))).toEqual({
      code: '23P01', constraint: 'position_assignments_position_no_overlap',
    });
    expect(pgErrorOf(knownError('P2002', '23505', 'duplicate key value violates unique constraint "positions_house_id_label_key_key"'))).toEqual({
      code: '23505', constraint: 'positions_house_id_label_key_key',
    });
    expect(pgErrorOf(new Error('x'))).toBeNull();
    expect(pgErrorOf(null)).toBeNull();
  });
});

describe('toStaffingError', () => {
  it('maps constraints, custom SQLSTATEs and missing records', () => {
    expect(reason(adapterError('23P01', 'violates exclusion constraint "position_assignments_position_no_overlap"'))).toBe('position-occupied');
    expect(reason(adapterError('23P01', 'violates exclusion constraint "position_assignments_employee_no_overlap"'))).toBe('employee-has-position');
    expect(reason(adapterError('23P01', 'violates exclusion constraint "house_memberships_no_overlap"'))).toBe('membership-overlap');
    expect(reason(knownError('P2002', '23505', 'violates unique constraint "positions_house_id_label_key_key"'))).toBe('label-taken');
    expect(reason(adapterError('23514', 'violates check constraint "position_assignments_period_check"'))).toBe('invalid-dates');
    expect(reason(adapterError('CI001', 'assignment x is outside its membership'))).toBe('outside-membership');
    expect(reason(adapterError('CI002', 'position house and role are immutable'))).toBe('not-found');
    expect(reason(knownError('P2003', '23503', 'violates foreign key constraint "x"'))).toBe('not-found');
    expect(reason(Object.assign(new Error('x'), { code: 'P2025' }))).toBe('not-found');
  });

  it('keeps StaffingErrors and unknown errors as they are', () => {
    const staffing = new StaffingError('stale');
    expect(toStaffingError(staffing)).toBe(staffing);
    const unknown = new Error('boom');
    expect(toStaffingError(unknown)).toBe(unknown);
  });

  it('recognises a duplicate operation receipt', () => {
    expect(isReceiptConflict(knownError('P2002', '23505', 'violates unique constraint "operation_receipts_pkey"'))).toBe(true);
    expect(isReceiptConflict(knownError('P2002', '23505', 'violates unique constraint "positions_house_id_label_key_key"'))).toBe(false);
  });
});
```

```ts
// src/server/plan-token.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { StaffingPlan } from '@/lib/staffing';
import { planToken } from './plan-token';

const plan: StaffingPlan = {
  closes: [
    { kind: 'assignment', id: 'a1', employeeId: 'e1', houseId: 'pf', positionId: 'p1', endsOn: '2026-06-30' },
    { kind: 'membership', id: 'm1', employeeId: 'e1', houseId: 'pf', positionId: null, endsOn: '2026-06-30' },
  ],
  opens: [{ kind: 'membership', employeeId: 'e1', houseId: 'ca', startsOn: '2026-07-01', endsOn: null }],
};

describe('planToken', () => {
  it('is a stable sha256 that ignores ordering', () => {
    const token = planToken(plan);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(planToken({ ...plan, closes: [...plan.closes].reverse() })).toBe(token);
  });

  it('changes when any date or record changes', () => {
    const token = planToken(plan);
    expect(planToken({ ...plan, opens: [{ ...plan.opens[0], startsOn: '2026-07-02' }] })).not.toBe(token);
    expect(planToken({ ...plan, closes: plan.closes.slice(1) })).not.toBe(token);
  });
});
```

```ts
// src/server/operation.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { StaffingError } from '@/lib/staffing-error';
import { createTestClient, ctx, houseIds, resetData } from '../../test/db/helpers';
import { runOperation } from './operation';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

function createEmployeeOp(operation: ReturnType<typeof ctx>, name = 'Ana Puig', delayMs = 0) {
  return runOperation(db, operation, 'test-create', [], async (tx) => {
    const employee = await tx.employee.create({ data: { fullName: name } });
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { employeeId: employee.id };
  });
}

describe('runOperation', () => {
  it('applies once and returns the stored result on a retry (AC-023)', async () => {
    const operation = ctx();
    const first = await createEmployeeOp(operation);
    const second = await createEmployeeOp(operation);
    expect(first.status).toBe('applied');
    expect(second).toEqual({ status: 'already-applied', result: first.result });
    expect(await db.employee.count()).toBe(1);
    expect(await db.operationReceipt.findUniqueOrThrow({ where: { id: operation.operationId } })).toMatchObject({
      kind: 'test-create', actorClerkUserId: 'user_test', result: first.result,
    });
  });

  it('applies concurrent duplicates exactly once', async () => {
    const operation = ctx();
    const outcomes = await Promise.all([createEmployeeOp(operation, 'Ana Puig', 300), createEmployeeOp(operation, 'Ana Puig', 300)]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(['already-applied', 'applied']);
    expect(await db.employee.count()).toBe(1);
  });

  it('rejects a reused operation ID for another kind of operation', async () => {
    const operation = ctx();
    await createEmployeeOp(operation);
    await expect(runOperation(db, operation, 'other-kind', [], async () => ({}))).rejects.toMatchObject({ reason: 'operation-conflict' });
  });

  it('rolls back everything, receipt included, when the work fails', async () => {
    const operation = ctx();
    await expect(
      runOperation(db, operation, 'test-create', [], async (tx) => {
        await tx.employee.create({ data: { fullName: 'Ana Puig' } });
        throw new StaffingError('position-occupied');
      }),
    ).rejects.toMatchObject({ reason: 'position-occupied' });
    expect(await db.employee.count()).toBe(0);
    expect(await db.operationReceipt.count()).toBe(0);
    // The same form can be corrected and resubmitted with its operation ID.
    await expect(createEmployeeOp(operation)).resolves.toMatchObject({ status: 'applied' });
  });

  it('maps database errors raised inside the work', async () => {
    const { pf } = await houseIds(db);
    await db.position.create({ data: { houseId: pf, roleCode: 'CT', label: 'CT' } });
    await expect(
      runOperation(db, ctx(), 'test-position', [], async (tx) => {
        await tx.position.create({ data: { houseId: pf, roleCode: 'CT', label: 'ct' } });
        return {};
      }),
    ).rejects.toMatchObject({ reason: 'label-taken' });
  });
});
```

Add to `test/db/helpers.ts`:

```ts
import { randomUUID } from 'node:crypto';
// ...
export function ctx(operationId: string = randomUUID()): { operationId: string; actor: string } {
  return { operationId, actor: 'user_test' };
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/server/db-errors.test.ts src/server/plan-token.test.ts && npm run test:db -- src/server/operation.db.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/server/db-errors.ts
//
// Maps Postgres errors surfaced by Prisma 7's pg driver adapter to staffing
// reasons. Model operations wrap the database error in a
// PrismaClientKnownRequestError (meta.driverAdapterError.cause); exclusion
// constraints, CHECKs, triggers and deferred triggers at commit arrive as a
// bare DriverAdapterError (cause). Never log the original message: it can
// contain record keys.
import { StaffingError, type StaffingErrorReason } from '@/lib/staffing-error';

export type PgError = { code: string; constraint: string | null };

type Cause = { originalCode?: unknown; originalMessage?: unknown };

export function pgErrorOf(error: unknown): PgError | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as { name?: unknown; cause?: Cause; meta?: { driverAdapterError?: { cause?: Cause } } };
  const cause = e.name === 'DriverAdapterError' ? e.cause : e.meta?.driverAdapterError?.cause;
  if (!cause || typeof cause.originalCode !== 'string') return null;
  const message = typeof cause.originalMessage === 'string' ? cause.originalMessage : '';
  return { code: cause.originalCode, constraint: /constraint "([^"]+)"/.exec(message)?.[1] ?? null };
}

const CONSTRAINT_REASONS: Record<string, StaffingErrorReason> = {
  house_memberships_no_overlap: 'membership-overlap',
  house_memberships_period_check: 'invalid-dates',
  position_assignments_employee_no_overlap: 'employee-has-position',
  position_assignments_position_no_overlap: 'position-occupied',
  position_assignments_period_check: 'invalid-dates',
  positions_house_id_label_key_key: 'label-taken',
};

export function isReceiptConflict(error: unknown): boolean {
  const pg = pgErrorOf(error);
  return pg?.code === '23505' && pg.constraint === 'operation_receipts_pkey';
}

/** A StaffingError for known database failures; anything else is returned unchanged. */
export function toStaffingError(error: unknown): unknown {
  if (error instanceof StaffingError) return error;
  if ((error as { code?: unknown } | null)?.code === 'P2025') return new StaffingError('not-found');
  const pg = pgErrorOf(error);
  if (!pg) return error;
  if (pg.code === 'CI001') return new StaffingError('outside-membership');
  // CI002 never comes from the app (it never sends House or role on update);
  // 23503 and 22P02 mean an ID that does not exist or is malformed.
  if (pg.code === 'CI002' || pg.code === '23503' || pg.code === '22P02') return new StaffingError('not-found');
  const reason = pg.constraint ? CONSTRAINT_REASONS[pg.constraint] : undefined;
  return reason ? new StaffingError(reason) : error;
}
```

```ts
// src/server/operation.ts
//
// The one transaction template for staffing writes (design D4).
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { StaffingError } from '@/lib/staffing-error';
import { isReceiptConflict, toStaffingError } from './db-errors';

export type Tx = Prisma.TransactionClient;
export type OperationContext = { operationId: string; actor: string };
export type OperationResult = Record<string, string | null>;
export type Outcome<T extends OperationResult> = { status: 'applied' | 'already-applied'; result: T };

/**
 * 1. Insert the operation receipt first, so a concurrent duplicate waits on its
 *    primary key and then fails with 23505.
 * 2. Lock the affected employees (sorted, to avoid deadlocks).
 * 3. Run the work: re-read, check the expected state, plan, write.
 * 4. Store the result IDs on the receipt.
 * A repeated operation ID returns the stored result as already applied. A
 * failed operation rolls back its receipt too, so the form can be resubmitted.
 */
export async function runOperation<T extends OperationResult>(
  db: PrismaClient,
  ctx: OperationContext,
  kind: string,
  employeeIds: readonly string[],
  work: (tx: Tx) => Promise<T>,
): Promise<Outcome<T>> {
  try {
    const result = await db.$transaction(async (tx) => {
      await tx.operationReceipt.create({ data: { id: ctx.operationId, kind, actorClerkUserId: ctx.actor } });
      await lockEmployees(tx, employeeIds);
      const result = await work(tx);
      await tx.operationReceipt.update({ where: { id: ctx.operationId }, data: { result } });
      return result;
    });
    return { status: 'applied', result };
  } catch (error) {
    if (!isReceiptConflict(error)) throw toStaffingError(error);
    const receipt = await db.operationReceipt.findUnique({ where: { id: ctx.operationId } });
    if (receipt?.kind !== kind || receipt.result === null) throw new StaffingError('operation-conflict');
    return { status: 'already-applied', result: receipt.result as T };
  }
}

/** Row locks that serialise concurrent writes for the same people (the containment trigger takes the same lock). */
export async function lockEmployees(tx: Tx, employeeIds: readonly string[]): Promise<void> {
  const ids = [...new Set(employeeIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT "id" FROM "employees" WHERE "id" = ANY(${ids}::uuid[]) ORDER BY "id" FOR UPDATE`;
}
```

If TypeScript rejects `data: { result }` (Prisma's JSON input type), write `data: { result: result as Prisma.InputJsonObject }`.

```ts
// src/server/plan-token.ts
import { createHash } from 'node:crypto';
import type { StaffingPlan } from '@/lib/staffing';

/**
 * Fingerprint of a plan (design D6). A confirm is applied only if the plan
 * recomputed under the lock still matches the one previewed; otherwise stale.
 */
export function planToken(plan: StaffingPlan): string {
  const closes = plan.closes.map((c) => [c.kind, c.id, c.endsOn].join('|')).sort();
  const opens = plan.opens
    .map((o) => [o.kind, o.employeeId, o.houseId, o.kind === 'assignment' ? o.positionId : '', o.startsOn, o.endsOn ?? ''].join('|'))
    .sort();
  return createHash('sha256').update(JSON.stringify({ closes, opens })).digest('hex');
}
```

```ts
// src/server/rows.ts
// Prisma rows to domain types. Dates cross the boundary as IsoDate strings.
import { dateToIsoDate } from '@/lib/dates';
import type { Membership } from '@/lib/house-membership';
import type { RoleCode } from '@/lib/roles';
import type { Assignment, Position } from '@/lib/staffing';

type PeriodRow = { startsOn: Date; endsOn: Date | null };

function period(row: PeriodRow) {
  return { startsOn: dateToIsoDate(row.startsOn), endsOn: row.endsOn ? dateToIsoDate(row.endsOn) : null };
}

export function toMembership(row: PeriodRow & { id: string; employeeId: string; houseId: string }): Membership {
  return { id: row.id, employeeId: row.employeeId, houseId: row.houseId, ...period(row) };
}

export function toAssignment(
  row: PeriodRow & { id: string; employeeId: string; positionId: string; houseId: string },
): Assignment {
  return { id: row.id, employeeId: row.employeeId, positionId: row.positionId, houseId: row.houseId, ...period(row) };
}

export function toPosition(row: { id: string; houseId: string; roleCode: string; label: string }): Position {
  return { id: row.id, houseId: row.houseId, roleCode: row.roleCode as RoleCode, label: row.label };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/server && npm run test:db && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db-errors.ts src/server/db-errors.test.ts src/server/operation.ts src/server/operation.db.test.ts src/server/plan-token.ts src/server/plan-token.test.ts src/server/rows.ts test/db/helpers.ts
git commit -m "feat(staffing): add the idempotent transaction template and database error mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Store: positions, people and membership periods

**Covers:** tasks.md 4.2, 4.3

**Files:**
- Create: `src/server/staffing-store.ts`, `src/server/staffing-store-people.db.test.ts`

**Interfaces:**
- Consumes: Task 8 (`runOperation`, `Tx`, `Outcome`, `OperationContext`, `toStaffingError`, `planToken`, row mappers); Task 5 `planNewMembership`; `StaffingError`; `PlanNames` from `@/lib/staffing-messages`.
- Produces (Tasks 10 to 12, 17 rely on these exact names):
  - `createPosition(db, ctx, houseId, input: { roleCode: RoleCode; label: string }): Promise<Outcome<{ positionId: string }>>`
  - `relabelPosition(db, ctx, houseId, input: { positionId: string; label: string }): Promise<Outcome<{ positionId: string }>>`
  - `type MembershipResult = { employeeId: string; membershipId: string; assignmentId: string | null }`
  - `createEmployee(db, ctx, houseId, input: { fullName: string; startsOn: IsoDate; endsOn: IsoDate | null; positionId: string | null }): Promise<Outcome<MembershipResult>>`
  - `addMembership(db, ctx, houseId, input: { employeeId: string; startsOn: IsoDate; endsOn: IsoDate | null; positionId: string | null }): Promise<Outcome<MembershipResult>>`
  - `editEmployeeName(db, ctx, houseId, input: { employeeId: string; fullName: string; expectedUpdatedAt: string }): Promise<Outcome<{ employeeId: string }>>`
  - `type Preview = { plan: StaffingPlan; planToken: string; names: PlanNames }`
  - internal (same file, used by Tasks 10, 11): `employeeMemberships`, `employeeAssignments`, `positionAssignments`, `positionInHouse`, `applyPlan`, `mapped`, `previewOf`
  - re-exports `type OperationContext`, `type Outcome`

- [ ] **Step 1: Write the failing DB test**

```ts
// src/server/staffing-store-people.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestClient, ctx, houseIds, insertEmployee, insertMembership, resetData } from '../../test/db/helpers';
import { addMembership, createEmployee, createPosition, editEmployeeName, relabelPosition } from './staffing-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

describe('positions', () => {
  it('creates positions and rejects a label taken in the same House', async () => {
    const { pf, ca } = await houseIds(db);
    await createPosition(db, ctx(), pf, { roleCode: 'CT', label: 'CT nit' });
    await expect(createPosition(db, ctx(), pf, { roleCode: 'CT', label: ' ct NIT ' })).rejects.toMatchObject({ reason: 'label-taken' });
    await expect(createPosition(db, ctx(), ca, { roleCode: 'CT', label: 'CT nit' })).resolves.toMatchObject({ status: 'applied' });
  });

  it('relabels inside the House only', async () => {
    const { pf, ca } = await houseIds(db);
    const { result } = await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'ER 1' });
    await relabelPosition(db, ctx(), pf, { positionId: result.positionId, label: 'ER matins' });
    expect((await db.position.findUniqueOrThrow({ where: { id: result.positionId } })).label).toBe('ER matins');
    await expect(relabelPosition(db, ctx(), ca, { positionId: result.positionId, label: 'X' })).rejects.toMatchObject({ reason: 'not-found' });
  });
});

describe('createEmployee', () => {
  it('commits employee, membership and assignment together (AC-001)', async () => {
    const { pf } = await houseIds(db);
    const { result: position } = await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'ER 1' });
    const { result } = await createEmployee(db, ctx(), pf, { fullName: ' Ana Puig ', startsOn: '2026-01-01', endsOn: null, positionId: position.positionId });
    expect((await db.employee.findUniqueOrThrow({ where: { id: result.employeeId } })).fullName).toBe('Ana Puig');
    expect(await db.houseMembership.count({ where: { employeeId: result.employeeId, houseId: pf } })).toBe(1);
    expect(await db.positionAssignment.findUniqueOrThrow({ where: { id: result.assignmentId! } })).toMatchObject({ positionId: position.positionId, houseId: pf });
  });

  it('leaves nothing behind when the position is occupied (AC-002)', async () => {
    const { pf } = await houseIds(db);
    const { result: position } = await createPosition(db, ctx(), pf, { roleCode: 'ER', label: 'ER 1' });
    await createEmployee(db, ctx(), pf, { fullName: 'Marta Soler', startsOn: '2025-09-01', endsOn: null, positionId: position.positionId });
    await expect(
      createEmployee(db, ctx(), pf, { fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: position.positionId }),
    ).rejects.toMatchObject({ reason: 'position-occupied' });
    expect(await db.employee.count()).toBe(1);
    expect(await db.houseMembership.count()).toBe(1);
  });

  it('rejects a position from the other House', async () => {
    const { pf, ca } = await houseIds(db);
    const { result: position } = await createPosition(db, ctx(), ca, { roleCode: 'ER', label: 'ER A' });
    await expect(
      createEmployee(db, ctx(), pf, { fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: position.positionId }),
    ).rejects.toMatchObject({ reason: 'not-found' });
    expect(await db.employee.count()).toBe(0);
  });

  it('allows two people with the same name (AC-003)', async () => {
    const { pf } = await houseIds(db);
    const a = await createEmployee(db, ctx(), pf, { fullName: 'Maria Garcia', startsOn: '2026-01-01', endsOn: null, positionId: null });
    const b = await createEmployee(db, ctx(), pf, { fullName: 'Maria Garcia', startsOn: '2026-01-01', endsOn: null, positionId: null });
    expect(a.result.employeeId).not.toBe(b.result.employeeId);
  });
});

describe('addMembership', () => {
  it('accepts a return after a gap and keeps the ID (AC-024)', async () => {
    const { pf } = await houseIds(db);
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, pf, '2025-01-01', '2025-12-31');
    const { result } = await addMembership(db, ctx(), pf, { employeeId: pau, startsOn: '2026-03-01', endsOn: null, positionId: null });
    expect(result.employeeId).toBe(pau);
    expect(await db.houseMembership.count({ where: { employeeId: pau } })).toBe(2);
  });

  it('rejects an overlapping period in either House', async () => {
    const { pf, ca } = await houseIds(db);
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, pf, '2025-01-01');
    await expect(addMembership(db, ctx(), ca, { employeeId: pau, startsOn: '2026-03-01', endsOn: null, positionId: null })).rejects.toMatchObject({
      reason: 'membership-overlap',
    });
  });
});

describe('editEmployeeName', () => {
  it('renames with the current version and rejects a stale one', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01');
    const loaded = (await db.employee.findUniqueOrThrow({ where: { id: ana } })).updatedAt.toISOString();
    await editEmployeeName(db, ctx(), pf, { employeeId: ana, fullName: 'Anna Puig', expectedUpdatedAt: loaded });
    await expect(editEmployeeName(db, ctx(), pf, { employeeId: ana, fullName: 'Ana P.', expectedUpdatedAt: loaded })).rejects.toMatchObject({
      reason: 'stale',
    });
    expect((await db.employee.findUniqueOrThrow({ where: { id: ana } })).fullName).toBe('Anna Puig');
  });

  it('does not touch an employee who never belonged to the House', async () => {
    const { pf, ca } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    await insertMembership(db, ana, pf, '2026-01-01');
    const loaded = (await db.employee.findUniqueOrThrow({ where: { id: ana } })).updatedAt.toISOString();
    await expect(editEmployeeName(db, ctx(), ca, { employeeId: ana, fullName: 'X', expectedUpdatedAt: loaded })).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- src/server/staffing-store-people.db.test.ts`
Expected: FAIL (`./staffing-store` does not exist).

- [ ] **Step 3: Implement**

```ts
// src/server/staffing-store.ts
//
// Staffing writes with the Prisma client passed in. No auth and no
// `server-only` here, so the dev seed and the DB tests can use it. App code
// calls it only from the Server Functions in src/app/(app)/[house]/team/actions.ts,
// after requireDirector(). Every write goes through runOperation (design D4).
import type { PrismaClient } from '@/generated/prisma/client';
import { isoDateToDate, type IsoDate } from '@/lib/dates';
import type { RoleCode } from '@/lib/roles';
import { planNewMembership, type PlanClose, type PlanOpen, type StaffingPlan } from '@/lib/staffing';
import { StaffingError } from '@/lib/staffing-error';
import type { PlanNames } from '@/lib/staffing-messages';
import { toStaffingError } from './db-errors';
import { runOperation, type OperationContext, type Outcome, type Tx } from './operation';
import { planToken } from './plan-token';
import { toAssignment, toMembership, toPosition } from './rows';

export type { OperationContext, Outcome } from './operation';

const byStart = [{ startsOn: 'asc' as const }, { id: 'asc' as const }];

// ── Loaders (inside or outside a transaction) ────────────────────────────────

async function employeeMemberships(db: Tx, employeeId: string) {
  return (await db.houseMembership.findMany({ where: { employeeId }, orderBy: byStart })).map(toMembership);
}

async function employeeAssignments(db: Tx, employeeId: string) {
  return (await db.positionAssignment.findMany({ where: { employeeId }, orderBy: byStart })).map(toAssignment);
}

async function positionAssignments(db: Tx, positionId: string) {
  return (await db.positionAssignment.findMany({ where: { positionId }, orderBy: byStart })).map(toAssignment);
}

/** The position, if it belongs to `houseId` (FR-009); otherwise not found. */
async function positionInHouse(db: Tx, positionId: string, houseId: string) {
  const row = await db.position.findFirst({ where: { id: positionId, houseId } });
  if (!row) throw new StaffingError('not-found');
  return toPosition(row);
}

/** Closes first, then new memberships, then new assignments (exclusion constraints are checked per statement). */
async function applyPlan(tx: Tx, plan: StaffingPlan): Promise<{ membershipIds: string[]; assignmentIds: string[] }> {
  for (const close of plan.closes) {
    const data = { endsOn: isoDateToDate(close.endsOn) };
    if (close.kind === 'assignment') await tx.positionAssignment.update({ where: { id: close.id }, data });
    else await tx.houseMembership.update({ where: { id: close.id }, data });
  }
  const dates = (open: PlanOpen) => ({
    startsOn: isoDateToDate(open.startsOn),
    endsOn: open.endsOn ? isoDateToDate(open.endsOn) : null,
  });
  const membershipIds: string[] = [];
  const assignmentIds: string[] = [];
  for (const open of plan.opens) {
    if (open.kind !== 'membership') continue;
    const row = await tx.houseMembership.create({ data: { employeeId: open.employeeId, houseId: open.houseId, ...dates(open) } });
    membershipIds.push(row.id);
  }
  for (const open of plan.opens) {
    if (open.kind !== 'assignment') continue;
    const row = await tx.positionAssignment.create({
      data: { employeeId: open.employeeId, positionId: open.positionId, houseId: open.houseId, ...dates(open) },
    });
    assignmentIds.push(row.id);
  }
  return { membershipIds, assignmentIds };
}

/** Database errors from reads outside runOperation become StaffingErrors too. */
async function mapped<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toStaffingError(error);
  }
}

// ── Previews ─────────────────────────────────────────────────────────────────

export type Preview = { plan: StaffingPlan; planToken: string; names: PlanNames };

function positionIdOf(item: PlanClose | PlanOpen): string | null {
  return 'positionId' in item ? item.positionId : null;
}

async function previewOf(db: PrismaClient, plan: StaffingPlan): Promise<Preview> {
  const items = [...plan.closes, ...plan.opens];
  const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => v !== null))];
  const [employees, positions, houses] = await Promise.all([
    db.employee.findMany({ where: { id: { in: unique(items.map((i) => i.employeeId)) } } }),
    db.position.findMany({ where: { id: { in: unique(items.map(positionIdOf)) } } }),
    db.house.findMany({ where: { id: { in: unique(items.map((i) => i.houseId)) } } }),
  ]);
  return {
    plan,
    planToken: planToken(plan),
    names: {
      employees: Object.fromEntries(employees.map((e) => [e.id, e.fullName])),
      positions: Object.fromEntries(positions.map((p) => [p.id, p.label])),
      houses: Object.fromEntries(houses.map((h) => [h.id, h.name])),
    },
  };
}

// ── Positions ────────────────────────────────────────────────────────────────

export function createPosition(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { roleCode: RoleCode; label: string },
): Promise<Outcome<{ positionId: string }>> {
  return runOperation(db, ctx, 'create-position', [], async (tx) => {
    const position = await tx.position.create({ data: { houseId, roleCode: input.roleCode, label: input.label.trim() } });
    return { positionId: position.id };
  });
}

export function relabelPosition(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { positionId: string; label: string },
): Promise<Outcome<{ positionId: string }>> {
  return runOperation(db, ctx, 'relabel-position', [], async (tx) => {
    await positionInHouse(tx, input.positionId, houseId);
    await tx.position.update({ where: { id: input.positionId }, data: { label: input.label.trim() } });
    return { positionId: input.positionId };
  });
}

// ── People and membership periods ────────────────────────────────────────────

export type MembershipResult = { employeeId: string; membershipId: string; assignmentId: string | null };

/** A new employee with an initial membership and optional position, all or nothing (FR-002). */
export function createEmployee(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { fullName: string; startsOn: IsoDate; endsOn: IsoDate | null; positionId: string | null },
): Promise<Outcome<MembershipResult>> {
  return runOperation(db, ctx, 'create-employee', [], async (tx) => {
    const position = input.positionId ? await positionInHouse(tx, input.positionId, houseId) : null;
    const employee = await tx.employee.create({ data: { fullName: input.fullName.trim() } });
    const plan = planNewMembership({
      employeeId: employee.id,
      houseId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      position,
      employeeMemberships: [],
      employeeAssignments: [],
      positionAssignments: position ? await positionAssignments(tx, position.id) : [],
    });
    const ids = await applyPlan(tx, plan);
    return { employeeId: employee.id, membershipId: ids.membershipIds[0], assignmentId: ids.assignmentIds[0] ?? null };
  });
}

/** A new period for an existing employee, from either House (returns, cross-House picks; FR-003, FR-009). */
export function addMembership(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { employeeId: string; startsOn: IsoDate; endsOn: IsoDate | null; positionId: string | null },
): Promise<Outcome<MembershipResult>> {
  return runOperation(db, ctx, 'add-membership', [input.employeeId], async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new StaffingError('not-found');
    const position = input.positionId ? await positionInHouse(tx, input.positionId, houseId) : null;
    const plan = planNewMembership({
      employeeId: employee.id,
      houseId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      position,
      employeeMemberships: await employeeMemberships(tx, employee.id),
      employeeAssignments: await employeeAssignments(tx, employee.id),
      positionAssignments: position ? await positionAssignments(tx, position.id) : [],
    });
    const ids = await applyPlan(tx, plan);
    return { employeeId: employee.id, membershipId: ids.membershipIds[0], assignmentId: ids.assignmentIds[0] ?? null };
  });
}

/** Corrects a name; the ID and every period stay as they are. Stale if the name changed since it was loaded. */
export function editEmployeeName(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { employeeId: string; fullName: string; expectedUpdatedAt: string },
): Promise<Outcome<{ employeeId: string }>> {
  return runOperation(db, ctx, 'edit-name', [input.employeeId], async (tx) => {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, memberships: { some: { houseId } } } });
    if (!employee) throw new StaffingError('not-found');
    if (employee.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new StaffingError('stale');
    await tx.employee.update({ where: { id: employee.id }, data: { fullName: input.fullName.trim() } });
    return { employeeId: employee.id };
  });
}
```

`employeeMemberships`, `employeeAssignments`, `positionAssignments`, `mapped` and `previewOf` are unused until Tasks 10 and 11. If ESLint flags them, add them in those tasks instead.

- [ ] **Step 4: Run the tests**

Run: `npm run test:db && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/staffing-store.ts src/server/staffing-store-people.db.test.ts
git commit -m "feat(staffing): store operations for positions, people and membership periods

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Store: handovers and ending an assignment

**Covers:** tasks.md 4.4

**Files:**
- Modify: `src/server/staffing-store.ts`
- Create: `src/server/staffing-store-handover.db.test.ts`

**Interfaces:**
- Consumes: Task 9 internals; `planHandover`, `planEndAssignment` (Task 4).
- Produces:
  - `type HandoverRequest = { positionId: string; employeeId: string; startsOn: IsoDate; endsOn: IsoDate | null }`
  - `previewHandover(db, houseId, input: HandoverRequest): Promise<Preview>`
  - `handover(db, ctx, houseId, input: HandoverRequest & { planToken: string }): Promise<Outcome<{ positionId: string; employeeId: string; assignmentId: string }>>`
  - `endAssignment(db, ctx, houseId, input: { assignmentId: string; endsOn: IsoDate }): Promise<Outcome<{ assignmentId: string; employeeId: string }>>`

- [ ] **Step 1: Write the failing DB test**

```ts
// src/server/staffing-store-handover.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dateToIsoDate } from '@/lib/dates';
import { StaffingError } from '@/lib/staffing-error';
import { createTestClient, ctx, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { endAssignment, handover, previewHandover } from './staffing-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

async function setup() {
  const { pf, ca } = await houseIds(db);
  const ana = await insertEmployee(db, 'Ana Puig');
  const marta = await insertEmployee(db, 'Marta Soler');
  const pol = await insertEmployee(db, 'Pol Mas');
  for (const id of [ana, marta, pol]) await insertMembership(db, id, pf, '2025-09-01');
  const er1 = await insertPosition(db, pf, 'ER', 'ER 1');
  const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
  return { pf, ca, ana, marta, pol, er1, er2 };
}

const periodsOf = async (positionId: string) =>
  (await db.positionAssignment.findMany({ where: { positionId }, orderBy: { startsOn: 'asc' }, include: { employee: true } })).map((a) => [
    a.employee.fullName,
    dateToIsoDate(a.startsOn),
    a.endsOn ? dateToIsoDate(a.endsOn) : null,
  ]);

describe('handover', () => {
  it('previews then replaces the occupant on the same position (AC-004)', async () => {
    const { pf, ana, marta, er1 } = await setup();
    await insertAssignment(db, marta, er1, pf, '2025-09-01');
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    expect(preview.names.employees[marta]).toBe('Marta Soler');
    await handover(db, ctx(), pf, { ...request, planToken: preview.planToken });
    expect(await periodsOf(er1)).toEqual([
      ['Marta Soler', '2025-09-01', '2026-06-30'],
      ['Ana Puig', '2026-07-01', null],
    ]);
  });

  it('rejects a confirm whose plan changed since the preview', async () => {
    const { pf, ana, marta, er1 } = await setup();
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    await insertAssignment(db, marta, er1, pf, '2025-09-01', '2026-01-31');
    await expect(handover(db, ctx(), pf, { ...request, planToken: preview.planToken })).rejects.toMatchObject({ reason: 'stale' });
    expect(await db.positionAssignment.count({ where: { employeeId: ana } })).toBe(0);
  });

  it('reports a retried confirm as already applied (Review Focus 3)', async () => {
    const { pf, ana, er1 } = await setup();
    const request = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const preview = await previewHandover(db, pf, request);
    const operation = ctx();
    const first = await handover(db, operation, pf, { ...request, planToken: preview.planToken });
    const second = await handover(db, operation, pf, { ...request, planToken: preview.planToken });
    expect(second).toEqual({ status: 'already-applied', result: first.result });
  });

  it('lets one of two concurrent assignments to a vacant position win (AC-006)', async () => {
    const { pf, ana, pol, er1 } = await setup();
    const forAna = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const forPol = { ...forAna, employeeId: pol };
    const [tokenAna, tokenPol] = await Promise.all([previewHandover(db, pf, forAna), previewHandover(db, pf, forPol)]);
    const results = await Promise.allSettled([
      handover(db, ctx(), pf, { ...forAna, planToken: tokenAna.planToken }),
      handover(db, ctx(), pf, { ...forPol, planToken: tokenPol.planToken }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(StaffingError);
    expect(['position-occupied', 'stale']).toContain((failure.reason as StaffingError).reason);
    expect(await db.positionAssignment.count({ where: { positionId: er1 } })).toBe(1);
  });

  it('lets one of two concurrent positions for the same person win (AC-006)', async () => {
    const { pf, ana, er1, er2 } = await setup();
    const one = { positionId: er1, employeeId: ana, startsOn: '2026-07-01', endsOn: null };
    const two = { ...one, positionId: er2 };
    const [p1, p2] = await Promise.all([previewHandover(db, pf, one), previewHandover(db, pf, two)]);
    const results = await Promise.allSettled([
      handover(db, ctx(), pf, { ...one, planToken: p1.planToken }),
      handover(db, ctx(), pf, { ...two, planToken: p2.planToken }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.positionAssignment.count({ where: { employeeId: ana } })).toBe(1);
  });

  it('rejects a position from the other House', async () => {
    const { pf, ca, ana } = await setup();
    const erA = await insertPosition(db, ca, 'ER', 'ER A');
    await expect(previewHandover(db, pf, { positionId: erA, employeeId: ana, startsOn: '2026-07-01', endsOn: null })).rejects.toMatchObject({
      reason: 'not-found',
    });
  });
});

describe('endAssignment', () => {
  it('ends an ongoing assignment of the House and then refuses to edit it again', async () => {
    const { pf, ca, ana, er1 } = await setup();
    const id = await insertAssignment(db, ana, er1, pf, '2026-01-01');
    await expect(endAssignment(db, ctx(), ca, { assignmentId: id, endsOn: '2026-08-31' })).rejects.toMatchObject({ reason: 'not-found' });
    await endAssignment(db, ctx(), pf, { assignmentId: id, endsOn: '2026-08-31' });
    expect(await periodsOf(er1)).toEqual([['Ana Puig', '2026-01-01', '2026-08-31']]);
    await expect(endAssignment(db, ctx(), pf, { assignmentId: id, endsOn: '2026-09-30' })).rejects.toMatchObject({ reason: 'not-ongoing' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- src/server/staffing-store-handover.db.test.ts`
Expected: FAIL (`previewHandover` is not exported).

- [ ] **Step 3: Implement (append to `src/server/staffing-store.ts`)**

Add `planEndAssignment, planHandover` to the `@/lib/staffing` import, then append:

```ts
// ── Positions over time ──────────────────────────────────────────────────────

export type HandoverRequest = { positionId: string; employeeId: string; startsOn: IsoDate; endsOn: IsoDate | null };

async function handoverPlan(db: Tx, houseId: string, input: HandoverRequest): Promise<StaffingPlan> {
  const position = await positionInHouse(db, input.positionId, houseId);
  return planHandover({
    position,
    incomingEmployeeId: input.employeeId,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    positionAssignments: await positionAssignments(db, position.id),
    incomingAssignments: await employeeAssignments(db, input.employeeId),
    incomingMemberships: await employeeMemberships(db, input.employeeId),
  });
}

export function previewHandover(db: PrismaClient, houseId: string, input: HandoverRequest): Promise<Preview> {
  return mapped(async () => previewOf(db, await handoverPlan(db, houseId, input)));
}

/**
 * Assign, replace or move (FR-004). The incoming employee is locked; the plan
 * is recomputed under the lock and must match the previewed token.
 */
export function handover(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: HandoverRequest & { planToken: string },
): Promise<Outcome<{ positionId: string; employeeId: string; assignmentId: string }>> {
  return runOperation(db, ctx, 'handover', [input.employeeId], async (tx) => {
    const plan = await handoverPlan(tx, houseId, input);
    if (planToken(plan) !== input.planToken) throw new StaffingError('stale');
    const ids = await applyPlan(tx, plan);
    return { positionId: input.positionId, employeeId: input.employeeId, assignmentId: ids.assignmentIds[0] };
  });
}

/** Ends an ongoing assignment of this House. An already closed one is `not-ongoing`. */
export async function endAssignment(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { assignmentId: string; endsOn: IsoDate },
): Promise<Outcome<{ assignmentId: string; employeeId: string }>> {
  const owner = await mapped(() =>
    db.positionAssignment.findFirst({ where: { id: input.assignmentId, houseId }, select: { employeeId: true } }),
  );
  if (!owner) throw new StaffingError('not-found');
  return runOperation(db, ctx, 'end-assignment', [owner.employeeId], async (tx) => {
    const row = await tx.positionAssignment.findFirst({ where: { id: input.assignmentId, houseId } });
    if (!row) throw new StaffingError('not-found');
    await applyPlan(tx, planEndAssignment(toAssignment(row), input.endsOn));
    return { assignmentId: row.id, employeeId: row.employeeId };
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:db && npm run typecheck`
Expected: PASS. If a concurrency test is flaky, run it 5 times (`npm run test:db -- src/server/staffing-store-handover.db.test.ts --repeat 4` is not supported by `vitest run`; run the command 5 times) and fix the cause rather than adding retries.

- [ ] **Step 5: Commit**

```bash
git add src/server/staffing-store.ts src/server/staffing-store-handover.db.test.ts
git commit -m "feat(staffing): store handovers and assignment endings with stale-safe confirms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Store: ending memberships and House transfers

**Covers:** tasks.md 4.5

**Files:**
- Modify: `src/server/staffing-store.ts`, `src/server/membership-store.ts` (remove `applyTransfer`), `src/server/membership-store.test.ts`, `src/server/houses.ts` (remove `transferEmployee`), `src/server/houses.test.ts`, `prisma/seed.ts` (stop using `applyTransfer`; Task 12 rewrites it)
- Create: `src/server/staffing-store-transfer.db.test.ts`

**Interfaces:**
- Consumes: Task 9 internals; `planEndMembership`, `planHouseTransfer` (Task 5).
- Produces:
  - `previewEndMembership(db, houseId, input: { membershipId: string; endsOn: IsoDate }): Promise<Preview>`
  - `endMembership(db, ctx, houseId, input: { membershipId: string; endsOn: IsoDate; planToken: string }): Promise<Outcome<{ membershipId: string; employeeId: string }>>`
  - `type TransferRequest = { employeeId: string; toHouseId: string; startsOn: IsoDate; destinationPositionId: string | null }`
  - `previewTransfer(db, houseId, input: TransferRequest): Promise<Preview>`
  - `transfer(db, ctx, houseId, input: TransferRequest & { planToken: string }): Promise<Outcome<{ employeeId: string; membershipId: string; assignmentId: string | null }>>`

- [ ] **Step 1: Write the failing DB test**

```ts
// src/server/staffing-store-transfer.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dateToIsoDate } from '@/lib/dates';
import { createTestClient, ctx, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { endMembership, previewEndMembership, previewTransfer, transfer } from './staffing-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

const iso = (d: Date | null) => (d ? dateToIsoDate(d) : null);

async function anaHoldingEr1() {
  const { pf, ca } = await houseIds(db);
  const ana = await insertEmployee(db, 'Ana Puig');
  const membership = await insertMembership(db, ana, pf, '2026-01-01');
  const er1 = await insertPosition(db, pf, 'ER', 'ER 1');
  const erA = await insertPosition(db, ca, 'ER', 'ER A');
  const assignment = await insertAssignment(db, ana, er1, pf, '2026-01-01');
  return { pf, ca, ana, membership, er1, erA, assignment };
}

async function snapshot(employeeId: string) {
  const memberships = await db.houseMembership.findMany({ where: { employeeId }, orderBy: { startsOn: 'asc' } });
  const assignments = await db.positionAssignment.findMany({ where: { employeeId }, orderBy: { startsOn: 'asc' } });
  return {
    memberships: memberships.map((m) => [m.houseId, iso(m.startsOn), iso(m.endsOn)]),
    assignments: assignments.map((a) => [a.positionId, iso(a.startsOn), iso(a.endsOn)]),
  };
}

describe('transfer', () => {
  it('closes and opens membership and assignment atomically (AC-009)', async () => {
    const { pf, ca, ana, er1, erA } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: erA };
    const preview = await previewTransfer(db, pf, request);
    await transfer(db, ctx(), pf, { ...request, planToken: preview.planToken });
    expect(await snapshot(ana)).toEqual({
      memberships: [[pf, '2026-01-01', '2026-06-30'], [ca, '2026-07-01', null]],
      assignments: [[er1, '2026-01-01', '2026-06-30'], [erA, '2026-07-01', null]],
    });
  });

  it('transfers without a destination position (AC-011)', async () => {
    const { pf, ca, ana } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: null };
    const preview = await previewTransfer(db, pf, request);
    const { result } = await transfer(db, ctx(), pf, { ...request, planToken: preview.planToken });
    expect(result.assignmentId).toBeNull();
    expect((await snapshot(ana)).assignments).toHaveLength(1);
  });

  it('changes nothing when the destination position is occupied (AC-010)', async () => {
    const { pf, ca, ana, erA } = await anaHoldingEr1();
    const pau = await insertEmployee(db, 'Pau Ferrer');
    await insertMembership(db, pau, ca, '2025-09-01');
    await insertAssignment(db, pau, erA, ca, '2025-09-01');
    const before = await snapshot(ana);
    await expect(
      previewTransfer(db, pf, { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: erA }),
    ).rejects.toMatchObject({ reason: 'position-occupied' });
    expect(await snapshot(ana)).toEqual(before);
  });

  it('cannot transfer the destination membership on a second submit (AC-012)', async () => {
    const { pf, ca, ana } = await anaHoldingEr1();
    const request = { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: null };
    const preview = await previewTransfer(db, pf, request);
    const operation = ctx();
    await transfer(db, operation, pf, { ...request, planToken: preview.planToken });
    await expect(transfer(db, operation, pf, { ...request, planToken: preview.planToken })).resolves.toMatchObject({ status: 'already-applied' });
    await expect(transfer(db, ctx(), pf, { ...request, planToken: preview.planToken })).rejects.toMatchObject({ reason: 'not-ongoing' });
    expect(await db.houseMembership.count({ where: { employeeId: ana } })).toBe(2);
  });

  it('refuses to cancel a future source assignment (AC-013)', async () => {
    const { pf, ca, ana, assignment } = await anaHoldingEr1();
    await db.positionAssignment.update({ where: { id: assignment }, data: { endsOn: new Date('2026-03-31T00:00:00Z') } });
    const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
    await insertAssignment(db, ana, er2, pf, '2026-07-15');
    const before = await snapshot(ana);
    await expect(
      previewTransfer(db, pf, { employeeId: ana, toHouseId: ca, startsOn: '2026-07-01', destinationPositionId: null }),
    ).rejects.toMatchObject({ reason: 'future-assignment-blocks' });
    expect(await snapshot(ana)).toEqual(before);
  });
});

describe('endMembership', () => {
  it('closes the crossing assignment with the membership (AC-016)', async () => {
    const { pf, ana, membership, er1 } = await anaHoldingEr1();
    const preview = await previewEndMembership(db, pf, { membershipId: membership, endsOn: '2026-08-31' });
    expect(preview.plan.closes.map((c) => c.kind)).toEqual(['assignment', 'membership']);
    await endMembership(db, ctx(), pf, { membershipId: membership, endsOn: '2026-08-31', planToken: preview.planToken });
    expect(await snapshot(ana)).toEqual({ memberships: [[pf, '2026-01-01', '2026-08-31']], assignments: [[er1, '2026-01-01', '2026-08-31']] });
  });

  it('is blocked by an assignment that starts after the end', async () => {
    const { pf, ana, membership, assignment } = await anaHoldingEr1();
    await db.positionAssignment.update({ where: { id: assignment }, data: { endsOn: new Date('2026-03-31T00:00:00Z') } });
    const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
    await insertAssignment(db, ana, er2, pf, '2026-09-15');
    await expect(previewEndMembership(db, pf, { membershipId: membership, endsOn: '2026-08-31' })).rejects.toMatchObject({
      reason: 'future-assignment-blocks',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- src/server/staffing-store-transfer.db.test.ts`
Expected: FAIL (`previewTransfer` is not exported).

- [ ] **Step 3: Implement**

Add `planEndMembership, planHouseTransfer` to the `@/lib/staffing` import of `src/server/staffing-store.ts`, then append:

```ts
// ── Ending a membership and House transfers ──────────────────────────────────

async function endMembershipPlan(db: Tx, houseId: string, input: { membershipId: string; endsOn: IsoDate }): Promise<StaffingPlan> {
  const row = await db.houseMembership.findFirst({ where: { id: input.membershipId, houseId } });
  if (!row) throw new StaffingError('not-found');
  return planEndMembership({ membership: toMembership(row), endsOn: input.endsOn, assignments: await employeeAssignments(db, row.employeeId) });
}

export function previewEndMembership(db: PrismaClient, houseId: string, input: { membershipId: string; endsOn: IsoDate }): Promise<Preview> {
  return mapped(async () => previewOf(db, await endMembershipPlan(db, houseId, input)));
}

/** Ends an ongoing membership and closes its assignments that run past the end (FR-003). Not erasure. */
export async function endMembership(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: { membershipId: string; endsOn: IsoDate; planToken: string },
): Promise<Outcome<{ membershipId: string; employeeId: string }>> {
  const owner = await mapped(() => db.houseMembership.findFirst({ where: { id: input.membershipId, houseId }, select: { employeeId: true } }));
  if (!owner) throw new StaffingError('not-found');
  return runOperation(db, ctx, 'end-membership', [owner.employeeId], async (tx) => {
    const plan = await endMembershipPlan(tx, houseId, input);
    if (planToken(plan) !== input.planToken) throw new StaffingError('stale');
    await applyPlan(tx, plan);
    return { membershipId: input.membershipId, employeeId: owner.employeeId };
  });
}

export type TransferRequest = { employeeId: string; toHouseId: string; startsOn: IsoDate; destinationPositionId: string | null };

async function transferPlan(db: Tx, houseId: string, input: TransferRequest): Promise<StaffingPlan> {
  // The source must be an ongoing membership of the route's House, so a
  // second submit cannot transfer the newly created destination membership.
  const source = await db.houseMembership.findFirst({ where: { employeeId: input.employeeId, houseId, endsOn: null } });
  if (!source) throw new StaffingError('not-ongoing');
  const destinationPosition = input.destinationPositionId
    ? await positionInHouse(db, input.destinationPositionId, input.toHouseId)
    : null;
  return planHouseTransfer({
    source: toMembership(source),
    toHouseId: input.toHouseId,
    startsOn: input.startsOn,
    destinationPosition,
    employeeMemberships: await employeeMemberships(db, input.employeeId),
    employeeAssignments: await employeeAssignments(db, input.employeeId),
    destinationPositionAssignments: destinationPosition ? await positionAssignments(db, destinationPosition.id) : [],
  });
}

export function previewTransfer(db: PrismaClient, houseId: string, input: TransferRequest): Promise<Preview> {
  return mapped(async () => previewOf(db, await transferPlan(db, houseId, input)));
}

/** House transfer (FR-006): memberships and assignments close on D-1 and open on D in one transaction. */
export function transfer(
  db: PrismaClient,
  ctx: OperationContext,
  houseId: string,
  input: TransferRequest & { planToken: string },
): Promise<Outcome<{ employeeId: string; membershipId: string; assignmentId: string | null }>> {
  return runOperation(db, ctx, 'transfer', [input.employeeId], async (tx) => {
    const plan = await transferPlan(tx, houseId, input);
    if (planToken(plan) !== input.planToken) throw new StaffingError('stale');
    const ids = await applyPlan(tx, plan);
    return { employeeId: input.employeeId, membershipId: ids.membershipIds[0], assignmentId: ids.assignmentIds[0] ?? null };
  });
}
```

Remove the transfer path that the new store replaces:
- `src/server/membership-store.ts`: delete `applyTransfer` and the now unused imports (`isoDateToDate`, `StaffingError`, `planTransfer`). Keep `toMembership` and `findCurrentMembers` (the team page uses them until Task 19).
- `src/server/membership-store.test.ts`: delete the `describe('applyTransfer', ...)` block and unused imports.
- `src/server/houses.ts`: delete `transferEmployee` and its `applyTransfer` import.
- `src/server/houses.test.ts`: remove `transferEmployee` from the import, its call in "stops before any query", and `expect(prisma.$transaction)...` plus `$transaction` from the mock.
- `prisma/seed.ts`: delete the `applyTransfer` import and the two lines that transfer Ana (the `ana` lookup and the `applyTransfer` call), and change the final log to `` console.log(`Seeded ${PEOPLE.length} fictional employees.`); ``. Task 12 rewrites the seed.

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run test:db && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server prisma/seed.ts
git commit -m "feat(staffing): store membership endings and House transfers with assignments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Dev seed from the product owner's inventory

**Covers:** tasks.md 8.1

**Files:**
- Create: `prisma/seed-data.ts`, `prisma/seed-data.test.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `createPosition`, `createEmployee` (Task 9); `isRoleCode`, `RoleCode` (Task 2); `HouseSlug`.
- Produces: `SEED_START = '2025-09-01'`; `SEED_INVENTORY: readonly { houseSlug: HouseSlug; positions: readonly { label: string; roleCode: RoleCode; occupant: string }[] }[]`.

- [ ] **Step 1: Write the failing test**

```ts
// prisma/seed-data.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isHouseSlug } from '../src/lib/houses';
import { isRoleCode } from '../src/lib/roles';
import { SEED_INVENTORY, SEED_START } from './seed-data';

describe('SEED_INVENTORY', () => {
  it('has ten fictional positions per House with valid roles', () => {
    expect(SEED_START).toBe('2025-09-01');
    expect(SEED_INVENTORY.map((house) => house.houseSlug)).toEqual(['paulo-freire', 'carme-aymerich']);
    for (const house of SEED_INVENTORY) {
      expect(isHouseSlug(house.houseSlug)).toBe(true);
      expect(house.positions).toHaveLength(10);
      expect(house.positions.every((p) => isRoleCode(p.roleCode))).toBe(true);
      expect(new Set(house.positions.map((p) => p.label.toLowerCase())).size).toBe(10);
      expect(house.positions.filter((p) => p.roleCode === 'EN')).toHaveLength(2);
    }
  });

  it('uses each fictional name once', () => {
    const names = SEED_INVENTORY.flatMap((house) => house.positions.map((p) => p.occupant));
    expect(new Set(names).size).toBe(20);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run prisma/seed-data.test.ts`
Expected: FAIL (`./seed-data` does not exist).

- [ ] **Step 3: Implement**

```ts
// prisma/seed-data.ts
//
// Dev inventory supplied by the product owner (2026-10-08): realistic
// positions with FICTIONAL people. List 1 is Paulo Freire, list 2 Carme
// Aymerich. Never put real staff here (GDPR). Production gets no inventory.
import type { HouseSlug } from '../src/lib/houses';
import type { RoleCode } from '../src/lib/roles';

export const SEED_START = '2025-09-01';

type SeedPosition = { label: string; roleCode: RoleCode; occupant: string };

export const SEED_INVENTORY: readonly { houseSlug: HouseSlug; positions: readonly SeedPosition[] }[] = [
  {
    houseSlug: 'paulo-freire',
    positions: [
      { label: 'PDG', roleCode: 'PDG', occupant: 'Meritxell Torres Vila' },
      { label: 'PSI', roleCode: 'PSI', occupant: 'Sílvia Miró Esteve' },
      { label: 'ER', roleCode: 'ER', occupant: 'Carla Ribas Solé' },
      { label: 'TFM', roleCode: 'TFM', occupant: 'Montse Molina Prat' },
      { label: 'TFT', roleCode: 'TFT', occupant: 'Noèlia Fernández Grau' },
      { label: 'ET', roleCode: 'ET', occupant: 'Roger Beltrán Camps' },
      { label: 'ECS', roleCode: 'ECS', occupant: 'Mireia Santos Rovira' },
      { label: 'EN 1', roleCode: 'EN', occupant: 'David Valls Medina' },
      { label: 'EN 2', roleCode: 'EN', occupant: 'Cristina Pascual Duran' },
      { label: 'CT', roleCode: 'CT', occupant: 'Pol Jiménez Alcover' },
    ],
  },
  {
    houseSlug: 'carme-aymerich',
    positions: [
      { label: 'PDG', roleCode: 'PDG', occupant: 'Clara Soler Pujol' },
      { label: 'PSI', roleCode: 'PSI', occupant: 'Núria Roca Ferrer' },
      { label: 'ER', roleCode: 'ER', occupant: 'Laia Vidal Mas' },
      { label: 'TFM', roleCode: 'TFM', occupant: 'Rosa Navarro Costa' },
      { label: 'TFT', roleCode: 'TFT', occupant: 'Aina Martín Serra' },
      { label: 'ET', roleCode: 'ET', occupant: 'Júlia Romero Bosch' },
      { label: 'ECS', roleCode: 'ECS', occupant: 'Berta Puig Casas' },
      { label: 'EN 1', roleCode: 'EN', occupant: 'Marc Sánchez Riera' },
      { label: 'EN 2', roleCode: 'EN', occupant: 'Irene López Font' },
      { label: 'CT', roleCode: 'CT', occupant: 'Àlex García Martí' },
    ],
  },
];
```

Replace `prisma/seed.ts` with:

```ts
// Dev seed with FICTIONAL people only (GDPR: never seed real staff). Builds
// the product owner's inventory through the real staffing store, so every row
// passes the same rules and constraints as the app. Safe to re-run: it does
// nothing when employees already exist. Refresh the dev DB with
// `npx prisma migrate reset --force` then `npx prisma db seed`.
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { createEmployee, createPosition } from '../src/server/staffing-store';
import { SEED_INVENTORY, SEED_START } from './seed-data';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const asSeed = () => ({ operationId: randomUUID(), actor: 'seed' });

async function main() {
  if ((await db.employee.count()) > 0) {
    console.log('Seed skipped: employees already exist.');
    return;
  }

  const houses = await db.house.findMany();
  let people = 0;
  for (const { houseSlug, positions } of SEED_INVENTORY) {
    const house = houses.find((h) => h.slug === houseSlug);
    if (!house) throw new Error(`House ${houseSlug} is missing: run the migrations first.`);
    for (const { label, roleCode, occupant } of positions) {
      const { result } = await createPosition(db, asSeed(), house.id, { roleCode, label });
      await createEmployee(db, asSeed(), house.id, { fullName: occupant, startsOn: SEED_START, endsOn: null, positionId: result.positionId });
      people += 1;
    }
  }

  console.log(`Seeded ${people} fictional employees, each in their own position from ${SEED_START}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 4: Run the test and exercise the seed on a throwaway database**

Run: `npx vitest run prisma/seed-data.test.ts && npm run typecheck`
Expected: PASS.

Then prove the seed runs against a throwaway local Postgres (never Supabase here), twice:

```bash
npx tsx test/db/with-postgres.ts -- sh -c 'npx prisma db seed && npx prisma db seed'
```

Expected: first seed prints `Seeded 20 fictional employees, each in their own position from 2025-09-01.`; the second prints `Seed skipped: employees already exist.`

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/seed-data.ts prisma/seed-data.test.ts
git commit -m "feat(seed): seed the product owner's fictional inventory through the staffing store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 13: Staffing read queries

**Covers:** tasks.md 4.6

**Files:**
- Create: `src/lib/staffing-views.ts` (view types, shared with client components), `src/server/staffing-queries.ts`, `src/server/staffing-queries.db.test.ts`

**Interfaces:**
- Consumes: Task 3 pure queries; Task 8 row mappers; `isUuid` (Task 6); `roleOrder` (Task 2).
- Produces (UI tasks rely on these exact shapes; the types live in `src/lib/staffing-views.ts` so client components never import a server module):
  - `type PersonRow = { employeeId: string; fullName: string; memberSince: IsoDate; positionId: string | null; positionLabel: string | null }`
  - `type PositionRow = { positionId: string; label: string; roleCode: RoleCode; occupant: { employeeId: string; fullName: string } | null }`
  - `type FormerRow = { employeeId: string; fullName: string; startsOn: IsoDate; endsOn: IsoDate }`
  - `type TeamView = { people: PersonRow[]; positions: PositionRow[]; former: FormerRow[] }`
  - `getTeamView(db, houseId, date: IsoDate, today: IsoDate): Promise<TeamView>` (people on `date`, former members relative to `today`)
  - `listPositionRows(db, houseId, date): Promise<PositionRow[]>` (catalogue order, then label with numeric collation)
  - `listMemberOptions(db, houseId, date): Promise<{ employeeId: string; fullName: string }[]>`
  - `listEmployeeOptions(db, houseId, today): Promise<{ employeeId: string; fullName: string; currentHouseName: string | null }[]>` (everyone who is not a member of `houseId` today)
  - `type HistoryMembership = Membership & { houseSlug: HouseSlug; houseName: string }`, `type HistoryAssignment = Assignment & { positionLabel: string; roleCode: RoleCode; houseSlug: HouseSlug; houseName: string }`, `type EmployeeHistory = { employee: { id: string; fullName: string; updatedAt: string }; memberships: HistoryMembership[]; assignments: HistoryAssignment[] }`
  - `getEmployeeHistory(db, houseId, employeeId): Promise<EmployeeHistory | null>` (null for a malformed ID or no membership ever in `houseId`)
  - `type PositionDetail = { position: Position; history: (Assignment & { fullName: string })[] }`, `getPositionDetail(db, houseId, positionId): Promise<PositionDetail | null>`

- [ ] **Step 1: Write the failing DB test**

```ts
// src/server/staffing-queries.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestClient, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { getEmployeeHistory, getPositionDetail, getTeamView, listEmployeeOptions, listMemberOptions, listPositionRows } from './staffing-queries';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

// Ana: PF 2026-01-01..06-30 holding "ER 2", then CA from 07-01 on "ER A".
// Marta: PF from 2025-09-01 holding "ER 10". Núria: PF from 2025-09-01, no position.
async function setup() {
  const { pf, ca } = await houseIds(db);
  const ana = await insertEmployee(db, 'Ana Puig');
  const marta = await insertEmployee(db, 'Marta Soler');
  const nuria = await insertEmployee(db, 'Núria Costa');
  await insertMembership(db, ana, pf, '2026-01-01', '2026-06-30');
  await insertMembership(db, ana, ca, '2026-07-01');
  await insertMembership(db, marta, pf, '2025-09-01');
  await insertMembership(db, nuria, pf, '2025-09-01');
  const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
  const er10 = await insertPosition(db, pf, 'ER', 'ER 10');
  const ct = await insertPosition(db, pf, 'CT', 'CT');
  const pdg = await insertPosition(db, pf, 'PDG', 'PDG');
  const erA = await insertPosition(db, ca, 'ER', 'ER A');
  await insertAssignment(db, ana, er2, pf, '2026-01-01', '2026-06-30');
  await insertAssignment(db, ana, erA, ca, '2026-07-01');
  await insertAssignment(db, marta, er10, pf, '2025-09-01');
  return { pf, ca, ana, marta, nuria, er2, er10, ct, pdg, erA };
}

describe('getTeamView', () => {
  it('lists people with positions on the date, sorted by name (AC-014)', async () => {
    const { pf } = await setup();
    const before = await getTeamView(db, pf, '2026-06-30', '2026-06-30');
    expect(before.people.map((p) => [p.fullName, p.positionLabel])).toEqual([
      ['Ana Puig', 'ER 2'],
      ['Marta Soler', 'ER 10'],
      ['Núria Costa', null],
    ]);
    const after = await getTeamView(db, pf, '2026-07-01', '2026-07-01');
    expect(after.people.map((p) => p.fullName)).toEqual(['Marta Soler', 'Núria Costa']);
  });

  it('lists positions in catalogue order with vacancies (AC-008)', async () => {
    const { pf } = await setup();
    const view = await getTeamView(db, pf, '2026-08-01', '2026-08-01');
    expect(view.positions.map((p) => [p.label, p.occupant?.fullName ?? null])).toEqual([
      ['PDG', null],
      ['ER 2', null],
      ['ER 10', 'Marta Soler'],
      ['CT', null],
    ]);
  });

  it('lists former members relative to today, not the selected date', async () => {
    const { pf } = await setup();
    const view = await getTeamView(db, pf, '2026-03-01', '2026-08-01');
    expect(view.former).toEqual([{ employeeId: expect.any(String), fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: '2026-06-30' }]);
  });
});

describe('options', () => {
  it('lists current members and candidates for a new membership', async () => {
    const { pf, ca } = await setup();
    expect((await listMemberOptions(db, pf, '2026-08-01')).map((o) => o.fullName)).toEqual(['Marta Soler', 'Núria Costa']);
    expect(await listEmployeeOptions(db, pf, '2026-08-01')).toEqual([{ employeeId: expect.any(String), fullName: 'Ana Puig', currentHouseName: 'Carme Aymerich' }]);
    expect((await listEmployeeOptions(db, ca, '2026-08-01')).map((o) => o.fullName)).toEqual(['Marta Soler', 'Núria Costa']);
    expect((await listPositionRows(db, ca, '2026-08-01')).map((r) => [r.label, r.occupant?.fullName])).toEqual([['ER A', 'Ana Puig']]);
  });
});

describe('getEmployeeHistory', () => {
  it('shows both Houses in date order from either House', async () => {
    const { pf, ca, ana } = await setup();
    for (const house of [pf, ca]) {
      const history = await getEmployeeHistory(db, house, ana);
      expect(history?.memberships.map((m) => [m.houseName, m.startsOn, m.endsOn])).toEqual([
        ['Paulo Freire', '2026-01-01', '2026-06-30'],
        ['Carme Aymerich', '2026-07-01', null],
      ]);
      expect(history?.assignments.map((a) => [a.positionLabel, a.houseSlug])).toEqual([
        ['ER 2', 'paulo-freire'],
        ['ER A', 'carme-aymerich'],
      ]);
    }
  });

  it('is null for another House, an unknown or a malformed ID (Review Focus 1)', async () => {
    const { ca, marta } = await setup();
    expect(await getEmployeeHistory(db, ca, marta)).toBeNull();
    expect(await getEmployeeHistory(db, ca, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await getEmployeeHistory(db, ca, 'abc')).toBeNull();
  });
});

describe('getPositionDetail', () => {
  it('returns the history of a position of the House only', async () => {
    const { pf, ca, er2 } = await setup();
    expect((await getPositionDetail(db, pf, er2))?.history.map((h) => [h.fullName, h.startsOn, h.endsOn])).toEqual([['Ana Puig', '2026-01-01', '2026-06-30']]);
    expect(await getPositionDetail(db, ca, er2)).toBeNull();
    expect(await getPositionDetail(db, pf, 'x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- src/server/staffing-queries.db.test.ts`
Expected: FAIL (`./staffing-queries` does not exist).

- [ ] **Step 3: Implement**

```ts
// src/lib/staffing-views.ts
// Shapes of the staffing views that pages pass to client components. Types
// only, so client code never imports the server query module.
import type { IsoDate } from './dates';
import type { Membership } from './house-membership';
import type { HouseSlug } from './houses';
import type { RoleCode } from './roles';
import type { Assignment, Position } from './staffing';

export type PersonRow = {
  employeeId: string;
  fullName: string;
  memberSince: IsoDate;
  positionId: string | null;
  positionLabel: string | null;
};
export type PositionRow = {
  positionId: string;
  label: string;
  roleCode: RoleCode;
  occupant: { employeeId: string; fullName: string } | null;
};
export type FormerRow = { employeeId: string; fullName: string; startsOn: IsoDate; endsOn: IsoDate };
export type TeamView = { people: PersonRow[]; positions: PositionRow[]; former: FormerRow[] };

export type HistoryMembership = Membership & { houseSlug: HouseSlug; houseName: string };
export type HistoryAssignment = Assignment & { positionLabel: string; roleCode: RoleCode; houseSlug: HouseSlug; houseName: string };
export type EmployeeHistory = {
  employee: { id: string; fullName: string; updatedAt: string };
  memberships: HistoryMembership[];
  assignments: HistoryAssignment[];
};
export type PositionDetail = { position: Position; history: (Assignment & { fullName: string })[] };

/** Option rows for selects. */
export type MemberOption = { employeeId: string; fullName: string };
export type EmployeeOption = { employeeId: string; fullName: string; currentHouseName: string | null };
```

```ts
// src/server/staffing-queries.ts
//
// Staffing reads with the Prisma client passed in (no auth). App code reads
// through src/server/staffing.ts, which checks requireDirector() first. Volumes
// are tens of rows per House, so views are computed with the pure functions.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IsoDate } from '@/lib/dates';
import { isActiveOn } from '@/lib/house-membership';
import type { HouseSlug } from '@/lib/houses';
import { isUuid } from '@/lib/ids';
import { roleOrder, type RoleCode } from '@/lib/roles';
import { formerMembers, occupancyOn, teamOn, type Assignment, type Position } from '@/lib/staffing';
import type { EmployeeHistory, PositionDetail, PositionRow, TeamView } from '@/lib/staffing-views';
import { toAssignment, toMembership, toPosition } from './rows';

export type * from '@/lib/staffing-views';

const byName = <T extends { fullName: string }>(a: T, b: T) => a.fullName.localeCompare(b.fullName, 'ca');
const byRoleThenLabel = (a: Position, b: Position) =>
  roleOrder(a.roleCode) - roleOrder(b.roleCode) || a.label.localeCompare(b.label, 'ca', { numeric: true });
const byStart = [{ startsOn: 'asc' as const }, { id: 'asc' as const }];

async function loadHouse(db: PrismaClient, houseId: string) {
  const [membershipRows, positionRows, assignmentRows] = await Promise.all([
    db.houseMembership.findMany({ where: { houseId }, include: { employee: true }, orderBy: byStart }),
    db.position.findMany({ where: { houseId } }),
    db.positionAssignment.findMany({ where: { houseId }, orderBy: byStart }),
  ]);
  // Every assignment lies inside a membership of the same House, so this map covers occupants too.
  const names = new Map(membershipRows.map((row) => [row.employeeId, row.employee.fullName]));
  return {
    memberships: membershipRows.map(toMembership),
    positions: positionRows.map(toPosition).sort(byRoleThenLabel),
    assignments: assignmentRows.map(toAssignment),
    names,
  };
}

function toPositionRows(
  positions: readonly Position[],
  assignments: readonly Assignment[],
  names: Map<string, string>,
  date: IsoDate,
): PositionRow[] {
  return occupancyOn(positions, assignments, date).map(({ position, assignment }) => ({
    positionId: position.id,
    label: position.label,
    roleCode: position.roleCode,
    occupant: assignment ? { employeeId: assignment.employeeId, fullName: names.get(assignment.employeeId) ?? '' } : null,
  }));
}

/** The Equip page: people and positions on `date`, former members as of `today` (FR-005). */
export async function getTeamView(db: PrismaClient, houseId: string, date: IsoDate, today: IsoDate): Promise<TeamView> {
  const { memberships, positions, assignments, names } = await loadHouse(db, houseId);
  const labels = new Map(positions.map((p) => [p.id, p.label]));
  const people = teamOn(memberships, assignments, houseId, date)
    .map(({ membership, assignment }) => ({
      employeeId: membership.employeeId,
      fullName: names.get(membership.employeeId) ?? '',
      memberSince: membership.startsOn,
      positionId: assignment?.positionId ?? null,
      positionLabel: assignment ? (labels.get(assignment.positionId) ?? null) : null,
    }))
    .sort(byName);
  const former = formerMembers(memberships, houseId, today)
    .map((m) => ({ employeeId: m.employeeId, fullName: names.get(m.employeeId) ?? '', startsOn: m.startsOn, endsOn: m.endsOn ?? m.startsOn }))
    .sort(byName);
  return { people, positions: toPositionRows(positions, assignments, names, date), former };
}

export async function listPositionRows(db: PrismaClient, houseId: string, date: IsoDate): Promise<PositionRow[]> {
  const { positions, assignments, names } = await loadHouse(db, houseId);
  return toPositionRows(positions, assignments, names, date);
}

export async function listMemberOptions(db: PrismaClient, houseId: string, date: IsoDate) {
  const { memberships, names } = await loadHouse(db, houseId);
  return teamOn(memberships, [], houseId, date)
    .map(({ membership }) => ({ employeeId: membership.employeeId, fullName: names.get(membership.employeeId) ?? '' }))
    .sort(byName);
}

/** Employees who are not members of `houseId` today: candidates for "Persona existent" (FR-009 allows either House). */
export async function listEmployeeOptions(db: PrismaClient, houseId: string, today: IsoDate) {
  const employees = await db.employee.findMany({ include: { memberships: { include: { house: true } } } });
  return employees
    .flatMap((employee) => {
      const memberships = employee.memberships.map((row) => ({ ...toMembership(row), houseName: row.house.name }));
      if (memberships.some((m) => m.houseId === houseId && isActiveOn(m, today))) return [];
      const current = memberships.find((m) => isActiveOn(m, today));
      return [{ employeeId: employee.id, fullName: employee.fullName, currentHouseName: current?.houseName ?? null }];
    })
    .sort(byName);
}

/** History across both Houses, readable only from a House the employee has belonged to (FR-005, FR-009). */
export async function getEmployeeHistory(db: PrismaClient, houseId: string, employeeId: string): Promise<EmployeeHistory | null> {
  if (!isUuid(employeeId)) return null;
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      memberships: { include: { house: true }, orderBy: byStart },
      assignments: { include: { house: true, position: true }, orderBy: byStart },
    },
  });
  if (!employee || !employee.memberships.some((m) => m.houseId === houseId)) return null;
  return {
    employee: { id: employee.id, fullName: employee.fullName, updatedAt: employee.updatedAt.toISOString() },
    memberships: employee.memberships.map((row) => ({
      ...toMembership(row),
      houseSlug: row.house.slug as HouseSlug,
      houseName: row.house.name,
    })),
    assignments: employee.assignments.map((row) => ({
      ...toAssignment(row),
      positionLabel: row.position.label,
      roleCode: row.position.roleCode as RoleCode,
      houseSlug: row.house.slug as HouseSlug,
      houseName: row.house.name,
    })),
  };
}

export async function getPositionDetail(db: PrismaClient, houseId: string, positionId: string): Promise<PositionDetail | null> {
  if (!isUuid(positionId)) return null;
  const row = await db.position.findFirst({
    where: { id: positionId, houseId },
    include: { assignments: { include: { employee: true }, orderBy: byStart } },
  });
  if (!row) return null;
  return {
    position: toPosition(row),
    history: row.assignments.map((a) => ({ ...toAssignment(a), fullName: a.employee.fullName })),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:db && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/staffing-queries.ts src/server/staffing-queries.db.test.ts
git commit -m "feat(staffing): add House-scoped team, history and position queries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Grants, account links and the grant-based director gate

**Covers:** tasks.md 5.1, 5.2

**Files:**
- Create: `src/server/access-store.ts`, `src/server/access-store.db.test.ts`
- Modify: `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/server/houses.test.ts`, `src/components/no-access.tsx` (comment only)

**Interfaces:**
- Consumes: Task 7 models; `pgErrorOf` (Task 8); `prisma` from `@/lib/prisma`; Clerk `auth()`.
- Produces:
  - `DIRECTOR_ROLE = 'director'`, `grantDirector(db, clerkUserId): Promise<AccessGrant>`, `revokeDirector(db, clerkUserId): Promise<boolean>`, `listGrants(db): Promise<AccessGrant[]>`
  - `type AccountLinkFailure = 'employee-not-found' | 'already-linked'`, `class AccountLinkError extends Error { reason: AccountLinkFailure }`, `linkAccount(db, employeeId, clerkUserId): Promise<void>`, `unlinkAccount(db, employeeId): Promise<boolean>`
  - `isEnabledDirectorGrant(grant: { role: string; revokedAt: Date | null } | null | undefined): boolean`
  - `requireDirector(): Promise<{ userId: string }>` (grant-based; `isDirector` is deleted)

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/access-store.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isEnabledDirectorGrant } from '@/lib/auth';
import { createTestClient, houseIds, insertEmployee, insertMembership, resetData } from '../../test/db/helpers';
import { AccountLinkError, grantDirector, linkAccount, listGrants, revokeDirector, unlinkAccount } from './access-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

const enabled = async (clerkUserId: string) => isEnabledDirectorGrant(await db.accessGrant.findUnique({ where: { clerkUserId } }));

describe('director grants', () => {
  it('grants, revokes and grants again', async () => {
    await grantDirector(db, 'user_director');
    expect(await enabled('user_director')).toBe(true);
    expect(await revokeDirector(db, 'user_director')).toBe(true);
    expect(await enabled('user_director')).toBe(false);
    expect(await revokeDirector(db, 'user_director')).toBe(false);
    await grantDirector(db, 'user_director');
    expect(await enabled('user_director')).toBe(true);
    expect(await listGrants(db)).toHaveLength(1);
  });
});

describe('account links', () => {
  it('rejects a second employee for the same account and a second account for one employee (AC-021)', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    const marta = await insertEmployee(db, 'Marta Soler');
    await insertMembership(db, ana, pf, '2026-01-01');
    await linkAccount(db, ana, 'user_ana');
    await expect(linkAccount(db, marta, 'user_ana')).rejects.toMatchObject({ reason: 'already-linked' });
    await expect(linkAccount(db, ana, 'user_other')).rejects.toBeInstanceOf(AccountLinkError);
    expect(await db.houseMembership.count({ where: { employeeId: ana } })).toBe(1);
  });

  it('never grants access and unlinks cleanly', async () => {
    const ana = await insertEmployee(db, 'Ana Puig');
    await linkAccount(db, ana, 'user_ana');
    expect(await db.accessGrant.count()).toBe(0);
    expect(await unlinkAccount(db, ana)).toBe(true);
    expect(await unlinkAccount(db, ana)).toBe(false);
  });

  it('rejects an unknown employee', async () => {
    await expect(linkAccount(db, '00000000-0000-4000-8000-000000000000', 'user_x')).rejects.toMatchObject({ reason: 'employee-not-found' });
  });
});
```

Replace `src/lib/auth.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { NO_ACCESS_PATH, isEnabledDirectorGrant, requireDirector } from './auth';

// React's per-request cache would memoize across tests outside RSC: pass it through.
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { accessGrant: { findUnique: vi.fn() } } }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const signedIn = (userId: string | null) => vi.mocked(auth).mockResolvedValue({ userId } as never);
const grant = (value: { role: string; revokedAt: Date | null } | null) =>
  vi.mocked(prisma.accessGrant.findUnique).mockResolvedValue(value as never);

beforeEach(() => vi.clearAllMocks());

describe('isEnabledDirectorGrant', () => {
  it('needs role director and no revocation', () => {
    expect(isEnabledDirectorGrant({ role: 'director', revokedAt: null })).toBe(true);
    expect(isEnabledDirectorGrant({ role: 'director', revokedAt: new Date() })).toBe(false);
    expect(isEnabledDirectorGrant({ role: 'Director', revokedAt: null })).toBe(false);
    expect(isEnabledDirectorGrant(null)).toBe(false);
    expect(isEnabledDirectorGrant(undefined)).toBe(false);
  });
});

describe('requireDirector', () => {
  it('lets an enabled grant through and reads it by Clerk user ID', async () => {
    signedIn('user_1');
    grant({ role: 'director', revokedAt: null });
    await expect(requireDirector()).resolves.toEqual({ userId: 'user_1' });
    expect(prisma.accessGrant.findUnique).toHaveBeenCalledWith({ where: { clerkUserId: 'user_1' } });
  });

  it('ignores the old metadata flag: no grant means no access (AC-019)', async () => {
    signedIn('user_1');
    vi.mocked(currentUser).mockResolvedValue({ id: 'user_1', publicMetadata: { role: 'director' } } as never);
    grant(null);
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(NO_ACCESS_PATH);
    expect(currentUser).not.toHaveBeenCalled();
  });

  it('denies a revoked grant', async () => {
    signedIn('user_1');
    grant({ role: 'director', revokedAt: new Date('2026-10-01T00:00:00Z') });
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
  });

  it('rejects a signed-out request before touching the database', async () => {
    signedIn(null);
    await expect(requireDirector()).rejects.toThrow('Not authorized');
    expect(prisma.accessGrant.findUnique).not.toHaveBeenCalled();
  });
});
```

In `src/server/houses.test.ts`, change `mockResolvedValue({ userId: 'user_1', name: 'Marta' })` to `mockResolvedValue({ userId: 'user_1' })`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/auth.test.ts && npm run test:db -- src/server/access-store.db.test.ts`
Expected: FAIL (`isEnabledDirectorGrant` and `./access-store` missing).

- [ ] **Step 3: Implement**

```ts
// src/server/access-store.ts
//
// Director grants and employee account links (design D9, D10), client passed
// in, no auth. Used only by the operator scripts in scripts/ and by DB tests;
// no form or Server Function can reach these functions.
import type { PrismaClient } from '@/generated/prisma/client';
import { pgErrorOf } from './db-errors';

export const DIRECTOR_ROLE = 'director';

export function grantDirector(db: PrismaClient, clerkUserId: string) {
  return db.accessGrant.upsert({
    where: { clerkUserId },
    create: { clerkUserId, role: DIRECTOR_ROLE },
    update: { role: DIRECTOR_ROLE, revokedAt: null, grantedAt: new Date() },
  });
}

/** True if an enabled grant was revoked. Takes effect on the user's next request. */
export async function revokeDirector(db: PrismaClient, clerkUserId: string): Promise<boolean> {
  const { count } = await db.accessGrant.updateMany({ where: { clerkUserId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count > 0;
}

export function listGrants(db: PrismaClient) {
  return db.accessGrant.findMany({ orderBy: { grantedAt: 'asc' } });
}

export type AccountLinkFailure = 'employee-not-found' | 'already-linked';

export class AccountLinkError extends Error {
  readonly reason: AccountLinkFailure;

  constructor(reason: AccountLinkFailure) {
    super(`Account link rejected: ${reason}`);
    this.name = 'AccountLinkError';
    this.reason = reason;
  }
}

/** One account per employee and one employee per account (FR-010). Grants nothing. */
export async function linkAccount(db: PrismaClient, employeeId: string, clerkUserId: string): Promise<void> {
  try {
    await db.employeeAccountLink.create({ data: { employeeId, clerkUserId } });
  } catch (error) {
    const pg = pgErrorOf(error);
    if (pg?.code === '23505') throw new AccountLinkError('already-linked');
    if (pg?.code === '23503' || pg?.code === '22P02') throw new AccountLinkError('employee-not-found');
    throw error;
  }
}

export async function unlinkAccount(db: PrismaClient, employeeId: string): Promise<boolean> {
  const { count } = await db.employeeAccountLink.deleteMany({ where: { employeeId } });
  return count > 0;
}
```

Replace `src/lib/auth.ts` with:

```ts
import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';

export const NO_ACCESS_PATH = '/no-access';

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

function displayName(user: ClerkUserLike): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

// One Clerk Backend API call per request, however many callers check auth.
const getCurrentUser = cache(() => currentUser());

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authorized');
  return { userId: user.id, name: displayName(user) };
}

/**
 * An enabled director grant (design D9). Occupational roles, memberships,
 * account links and Clerk metadata never count.
 */
export function isEnabledDirectorGrant(grant: { role: string; revokedAt: Date | null } | null | undefined): boolean {
  return grant?.role === 'director' && grant.revokedAt === null;
}

// Per-request caches only (React `cache`): a revoked grant stops working on the
// next request. Never cache grants across requests.
const getUserId = cache(async () => (await auth()).userId);
const getGrant = cache((clerkUserId: string) => prisma.accessGrant.findUnique({ where: { clerkUserId } }));

/**
 * Director-only gate for House pages, House and staffing data, and staffing
 * Server Functions. Users without an enabled grant are redirected to
 * /no-access. Call it in every page, data function and Server Function, not
 * only in a layout: layouts and pages render in parallel.
 */
export async function requireDirector(): Promise<{ userId: string }> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authorized');
  if (!isEnabledDirectorGrant(await getGrant(userId))) redirect(NO_ACCESS_PATH);
  return { userId };
}
```

In `src/components/no-access.tsx`, change the doc comment to `/** Shown to signed-in users without an enabled director grant (see src/lib/auth.ts). */`.

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run test:db && npm run typecheck && npm run lint`
Expected: PASS. `grep -rn "publicMetadata\|isDirector(" src` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add src/server/access-store.ts src/server/access-store.db.test.ts src/lib/auth.ts src/lib/auth.test.ts src/server/houses.test.ts src/components/no-access.tsx
git commit -m "feat(access): replace the Clerk metadata flag with director application grants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 15: Operator scripts for grants and account links

**Covers:** tasks.md 5.3

**Files:**
- Create: `scripts/operator.ts`, `scripts/operator.test.ts`, `scripts/access.ts`, `scripts/account-link.ts`
- Modify: `package.json` (scripts `access`, `account-link`; dependency `@clerk/backend`)

**Interfaces:**
- Consumes: `grantDirector`, `revokeDirector`, `listGrants`, `linkAccount`, `unlinkAccount`, `AccountLinkError` (Task 14); `isUuid` (Task 6).
- Produces:
  - `parseAccessArgs(argv): { command: 'grant' | 'revoke'; clerkUserId: string; yes: boolean } | { command: 'list'; yes: boolean }`
  - `parseLinkArgs(argv): { command: 'link'; employeeId: string; clerkUserId: string; yes: boolean } | { command: 'unlink'; employeeId: string; yes: boolean }`
  - `class UsageError extends Error`
  - `clerkInstance(secretKey?: string): 'development' | 'production' | 'unknown'`, `databaseHost(url?: string): string`, `targetBanner(env): string`
  - `confirmOrAbort(question: string, yes: boolean, ask?: (q: string) => Promise<boolean>): Promise<boolean>`
  - `verifyClerkUser(clerkUserId: string, secretKey?: string): Promise<boolean>`
  - `npm run access -- grant|revoke <clerkUserId> [--yes] | list`, `npm run account-link -- link <employeeId> <clerkUserId> [--yes] | unlink <employeeId> [--yes]`

- [ ] **Step 1: Install the Clerk backend SDK as a direct dependency**

Run: `npm install @clerk/backend@^3.8.5`
Expected: `package.json` lists `"@clerk/backend"` under `dependencies` (it was already installed transitively by `@clerk/nextjs`).

- [ ] **Step 2: Write the failing test**

```ts
// scripts/operator.test.ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { UsageError, clerkInstance, confirmOrAbort, databaseHost, parseAccessArgs, parseLinkArgs, targetBanner } from './operator';

const EMPLOYEE = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';

describe('parseAccessArgs', () => {
  it('parses grant, revoke and list', () => {
    expect(parseAccessArgs(['grant', 'user_2abc'])).toEqual({ command: 'grant', clerkUserId: 'user_2abc', yes: false });
    expect(parseAccessArgs(['revoke', 'user_2abc', '--yes'])).toEqual({ command: 'revoke', clerkUserId: 'user_2abc', yes: true });
    expect(parseAccessArgs(['list'])).toEqual({ command: 'list', yes: false });
  });

  it('rejects anything else, including emails and names', () => {
    for (const argv of [[], ['grant'], ['grant', 'ana@example.org'], ['grant', 'Ana Puig'], ['delete', 'user_1'], ['grant', 'user_1', 'extra']]) {
      expect(() => parseAccessArgs(argv)).toThrow(UsageError);
    }
  });
});

describe('parseLinkArgs', () => {
  it('parses link and unlink', () => {
    expect(parseLinkArgs(['link', EMPLOYEE, 'user_2abc'])).toEqual({ command: 'link', employeeId: EMPLOYEE, clerkUserId: 'user_2abc', yes: false });
    expect(parseLinkArgs(['unlink', EMPLOYEE, '--yes'])).toEqual({ command: 'unlink', employeeId: EMPLOYEE, yes: true });
  });

  it('rejects malformed IDs', () => {
    expect(() => parseLinkArgs(['link', 'abc', 'user_1'])).toThrow(UsageError);
    expect(() => parseLinkArgs(['link', EMPLOYEE, 'ana@example.org'])).toThrow(UsageError);
  });
});

describe('target banner', () => {
  it('names the Clerk instance and database host, never secrets', () => {
    expect(clerkInstance('sk_test_x')).toBe('development');
    expect(clerkInstance('sk_live_x')).toBe('production');
    expect(clerkInstance(undefined)).toBe('unknown');
    expect(databaseHost('postgresql://u:secret@db.example.eu:5432/postgres')).toBe('db.example.eu:5432');
    const banner = targetBanner({ CLERK_SECRET_KEY: 'sk_live_abc', DIRECT_URL: 'postgresql://u:secret@db.example.eu:5432/postgres' });
    expect(banner).toContain('production');
    expect(banner).not.toContain('secret');
    expect(banner).not.toContain('sk_live_abc');
  });
});

describe('confirmOrAbort', () => {
  it('skips the question with --yes and otherwise asks', async () => {
    const ask = vi.fn().mockResolvedValue(false);
    await expect(confirmOrAbort('Grant?', true, ask)).resolves.toBe(true);
    expect(ask).not.toHaveBeenCalled();
    await expect(confirmOrAbort('Grant?', false, ask)).resolves.toBe(false);
    expect(ask).toHaveBeenCalledWith('Grant?');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run scripts/operator.test.ts`
Expected: FAIL (`./operator` does not exist).

- [ ] **Step 4: Implement**

```ts
// scripts/operator.ts
//
// Shared pieces of the trusted operator procedures (SPEC-002 §8, design D10):
// strict argument parsing (Clerk user IDs and employee UUIDs only, never names
// or emails), a banner naming the target Clerk instance and database host, an
// explicit confirmation, and verification that the Clerk user exists.
import { createInterface } from 'node:readline/promises';
import { createClerkClient } from '@clerk/backend';
import { isClerkAPIResponseError } from '@clerk/backend/errors';
import { isUuid } from '../src/lib/ids';

export class UsageError extends Error {}

const CLERK_USER_ID = /^user_[A-Za-z0-9]+$/;

function splitYes(argv: readonly string[]) {
  return { yes: argv.includes('--yes'), args: argv.filter((arg) => arg !== '--yes') };
}

export type AccessCommand =
  | { command: 'grant' | 'revoke'; clerkUserId: string; yes: boolean }
  | { command: 'list'; yes: boolean };

export function parseAccessArgs(argv: readonly string[]): AccessCommand {
  const { yes, args } = splitYes(argv);
  const [command, clerkUserId, ...rest] = args;
  if (command === 'list' && clerkUserId === undefined) return { command, yes };
  if ((command === 'grant' || command === 'revoke') && CLERK_USER_ID.test(clerkUserId ?? '') && rest.length === 0) {
    return { command, clerkUserId, yes };
  }
  throw new UsageError('Usage: npm run access -- grant|revoke <clerkUserId> [--yes] | list');
}

export type LinkCommand =
  | { command: 'link'; employeeId: string; clerkUserId: string; yes: boolean }
  | { command: 'unlink'; employeeId: string; yes: boolean };

export function parseLinkArgs(argv: readonly string[]): LinkCommand {
  const { yes, args } = splitYes(argv);
  const [command, employeeId = '', clerkUserId, ...rest] = args;
  if (command === 'link' && isUuid(employeeId) && CLERK_USER_ID.test(clerkUserId ?? '') && rest.length === 0) {
    return { command, employeeId, clerkUserId, yes };
  }
  if (command === 'unlink' && isUuid(employeeId) && clerkUserId === undefined) return { command, employeeId, yes };
  throw new UsageError('Usage: npm run account-link -- link <employeeId> <clerkUserId> [--yes] | unlink <employeeId> [--yes]');
}

export function clerkInstance(secretKey: string | undefined): 'development' | 'production' | 'unknown' {
  if (secretKey?.startsWith('sk_test_')) return 'development';
  if (secretKey?.startsWith('sk_live_')) return 'production';
  return 'unknown';
}

export function databaseHost(url: string | undefined): string {
  if (!url) return 'not configured';
  try {
    return new URL(url).host;
  } catch {
    return 'unparseable URL';
  }
}

export function targetBanner(env: NodeJS.ProcessEnv): string {
  return [
    `Clerk instance: ${clerkInstance(env.CLERK_SECRET_KEY)}`,
    `Database host:  ${databaseHost(env.DIRECT_URL ?? env.DATABASE_URL)}`,
  ].join('\n');
}

async function askYes(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${question} Type "yes" to continue: `)).trim() === 'yes';
  } finally {
    rl.close();
  }
}

export async function confirmOrAbort(question: string, yes: boolean, ask: (question: string) => Promise<boolean> = askYes): Promise<boolean> {
  return yes ? true : ask(question);
}

/** True if the user exists in the Clerk instance of `secretKey`; false on 404. */
export async function verifyClerkUser(clerkUserId: string, secretKey: string | undefined): Promise<boolean> {
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set.');
  try {
    await createClerkClient({ secretKey }).users.getUser(clerkUserId);
    return true;
  } catch (error) {
    if (isClerkAPIResponseError(error) && error.status === 404) return false;
    throw error;
  }
}
```

```ts
// scripts/access.ts
//
// Trusted operator procedure for director grants (SPEC-002 §8, design D10).
//   npm run access -- grant <clerkUserId> [--yes]
//   npm run access -- revoke <clerkUserId> [--yes]
//   npm run access -- list
// Restoring a lost director access = run `grant` again for their Clerk user ID.
// Changes apply on the user's next request.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { grantDirector, listGrants, revokeDirector } from '../src/server/access-store';
import { UsageError, confirmOrAbort, parseAccessArgs, targetBanner, verifyClerkUser } from './operator';

config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  const command = parseAccessArgs(process.argv.slice(2));
  console.log(targetBanner(process.env));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
  try {
    if (command.command === 'list') {
      for (const grant of await listGrants(db)) {
        console.log(`${grant.clerkUserId}  ${grant.role}  ${grant.revokedAt ? `revoked ${grant.revokedAt.toISOString()}` : 'enabled'}`);
      }
      return;
    }
    if (command.command === 'grant' && !(await verifyClerkUser(command.clerkUserId, process.env.CLERK_SECRET_KEY))) {
      console.error('No such user in this Clerk instance. Nothing was written.');
      process.exitCode = 1;
      return;
    }
    if (!(await confirmOrAbort(`${command.command} director access for ${command.clerkUserId}?`, command.yes))) {
      console.log('Cancelled. Nothing was written.');
      return;
    }
    if (command.command === 'grant') {
      await grantDirector(db, command.clerkUserId);
      console.log('Director access granted.');
    } else {
      console.log((await revokeDirector(db, command.clerkUserId)) ? 'Director access revoked.' : 'No enabled grant for that user.');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = 1;
});
```

```ts
// scripts/account-link.ts
//
// Trusted operator procedure for employee account links (SPEC-002 FR-010).
//   npm run account-link -- link <employeeId> <clerkUserId> [--yes]
//   npm run account-link -- unlink <employeeId> [--yes]
// A link never grants or revokes access and never changes staffing history.
// No matching by name or email: both IDs are given explicitly.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { AccountLinkError, linkAccount, unlinkAccount } from '../src/server/access-store';
import { UsageError, confirmOrAbort, parseLinkArgs, targetBanner, verifyClerkUser } from './operator';

config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  const command = parseLinkArgs(process.argv.slice(2));
  console.log(targetBanner(process.env));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
  try {
    if (command.command === 'link' && !(await verifyClerkUser(command.clerkUserId, process.env.CLERK_SECRET_KEY))) {
      console.error('No such user in this Clerk instance. Nothing was written.');
      process.exitCode = 1;
      return;
    }
    const question =
      command.command === 'link'
        ? `Link employee ${command.employeeId} to ${command.clerkUserId}?`
        : `Unlink employee ${command.employeeId}?`;
    if (!(await confirmOrAbort(question, command.yes))) {
      console.log('Cancelled. Nothing was written.');
      return;
    }
    if (command.command === 'link') {
      await linkAccount(db, command.employeeId, command.clerkUserId);
      console.log('Linked. This grants no access.');
    } else {
      console.log((await unlinkAccount(db, command.employeeId)) ? 'Unlinked.' : 'That employee had no link.');
    }
  } catch (error) {
    if (!(error instanceof AccountLinkError)) throw error;
    console.error(
      error.reason === 'already-linked'
        ? 'Rejected: that employee or that account is already linked. Nothing was written.'
        : 'Rejected: no employee with that ID. Nothing was written.',
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = 1;
});
```

In `package.json` `scripts`, after `"db:studio"`, add:

```json
    "access": "tsx scripts/access.ts",
    "account-link": "tsx scripts/account-link.ts",
```

- [ ] **Step 5: Run the tests and a smoke run of the usage error**

Run: `npx vitest run scripts/operator.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm run access -- grant ana@example.org`
Expected: prints the usage line and exits non-zero, writing nothing (no DB connection is opened before parsing).

- [ ] **Step 6: Commit**

```bash
git add scripts package.json package-lock.json
git commit -m "feat(access): add operator scripts for director grants and account links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Auth-wrapped staffing reads

**Covers:** tasks.md 6.1

**Files:**
- Create: `src/server/staffing.ts`, `src/server/staffing.test.ts`

**Interfaces:**
- Consumes: Task 13 queries; `requireDirector`; `todayInMadrid`; `prisma`.
- Produces (pages call only these):
  - `loadTeamView(houseId: string, date: IsoDate): Promise<TeamView>`
  - `loadEmployeeHistory(houseId: string, employeeId: string): Promise<EmployeeHistory | null>`
  - `loadPositionDetail(houseId: string, positionId: string): Promise<PositionDetail | null>`
  - `loadPositionRows(houseId: string, date: IsoDate): Promise<PositionRow[]>`
  - `loadMemberOptions(houseId: string, date: IsoDate): Promise<{ employeeId: string; fullName: string }[]>`
  - `loadEmployeeOptions(houseId: string): Promise<{ employeeId: string; fullName: string; currentHouseName: string | null }[]>`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/staffing.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import * as queries from './staffing-queries';
import {
  loadEmployeeHistory,
  loadEmployeeOptions,
  loadMemberOptions,
  loadPositionDetail,
  loadPositionRows,
  loadTeamView,
} from './staffing';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { tag: 'prisma' } }));
vi.mock('@/lib/dates', async (orig) => ({ ...(await orig<typeof import('@/lib/dates')>()), todayInMadrid: () => '2026-10-08' }));
vi.mock('./staffing-queries', () => ({
  getTeamView: vi.fn().mockResolvedValue({ people: [], positions: [], former: [] }),
  getEmployeeHistory: vi.fn().mockResolvedValue(null),
  getPositionDetail: vi.fn().mockResolvedValue(null),
  listPositionRows: vi.fn().mockResolvedValue([]),
  listMemberOptions: vi.fn().mockResolvedValue([]),
  listEmployeeOptions: vi.fn().mockResolvedValue([]),
}));

const calls = [
  () => loadTeamView('pf', '2026-07-01'),
  () => loadEmployeeHistory('pf', 'e1'),
  () => loadPositionDetail('pf', 'p1'),
  () => loadPositionRows('pf', '2026-07-01'),
  () => loadMemberOptions('pf', '2026-07-01'),
  () => loadEmployeeOptions('pf'),
];

beforeEach(() => vi.clearAllMocks());

describe('staffing reads for a user without a grant (AC-018)', () => {
  it('stop before any query', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    for (const call of calls) await expect(call()).rejects.toThrow('NEXT_REDIRECT');
    for (const fn of Object.values(queries)) if (vi.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('staffing reads for the director', () => {
  it('pass the House and dates through, with today in Madrid for former members', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1' });
    await loadTeamView('pf', '2026-07-01');
    expect(queries.getTeamView).toHaveBeenCalledWith({ tag: 'prisma' }, 'pf', '2026-07-01', '2026-10-08');
    await loadEmployeeOptions('pf');
    expect(queries.listEmployeeOptions).toHaveBeenCalledWith({ tag: 'prisma' }, 'pf', '2026-10-08');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/staffing.test.ts`
Expected: FAIL (`./staffing` does not exist).

- [ ] **Step 3: Implement**

```ts
// src/server/staffing.ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid, type IsoDate } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import {
  getEmployeeHistory,
  getPositionDetail,
  getTeamView,
  listEmployeeOptions,
  listMemberOptions,
  listPositionRows,
} from './staffing-queries';

// Staffing reads for pages. Every function checks the director grant itself:
// pages and layouts render in parallel, so a parent check does not protect
// these queries (FR-008).

export async function loadTeamView(houseId: string, date: IsoDate) {
  await requireDirector();
  return getTeamView(prisma, houseId, date, todayInMadrid());
}

export async function loadEmployeeHistory(houseId: string, employeeId: string) {
  await requireDirector();
  return getEmployeeHistory(prisma, houseId, employeeId);
}

export async function loadPositionDetail(houseId: string, positionId: string) {
  await requireDirector();
  return getPositionDetail(prisma, houseId, positionId);
}

export async function loadPositionRows(houseId: string, date: IsoDate) {
  await requireDirector();
  return listPositionRows(prisma, houseId, date);
}

export async function loadMemberOptions(houseId: string, date: IsoDate) {
  await requireDirector();
  return listMemberOptions(prisma, houseId, date);
}

export async function loadEmployeeOptions(houseId: string) {
  await requireDirector();
  return listEmployeeOptions(prisma, houseId, todayInMadrid());
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/server && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/staffing.ts src/server/staffing.test.ts
git commit -m "feat(staffing): add director-gated staffing reads for pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 17: Staffing Server Functions

**Covers:** tasks.md 6.2

**Files:**
- Create: `src/lib/action-state.ts`, `src/lib/action-state.test.ts`, `src/app/(app)/[house]/team/actions.ts`, `src/app/(app)/[house]/team/actions.test.ts`

**Interfaces:**
- Consumes: Task 6 schemas and messages; Tasks 9 to 11 store functions; `getHouseBySlug`; `requireDirector`.
- Produces:
  - `type ActionState = { status: 'idle' } | { status: 'error'; message: string } | { status: 'preview'; lines: string[]; planToken: string }`, `IDLE`, `type StaffingAction = (state: ActionState, input: unknown) => Promise<ActionState>`
  - `DONE_MESSAGES` (keys: `person-created`, `membership-added`, `renamed`, `assigned`, `assignment-ended`, `membership-ended`, `transferred`, `position-created`, `position-relabelled`), `type DoneKind`, `ALREADY_APPLIED`
  - `doneHref(path, done, status): string`, `type SearchParams = Record<string, string | string[] | undefined>`, `firstParam(params, key): string | undefined`, `parseDone(params): { done: DoneKind | null; repeat: boolean }`
  - Server Functions, all `(slug: string, state: ActionState, input: unknown) => Promise<ActionState>`, bound by pages with `.bind(null, slug)`: `createPositionAction`, `relabelPositionAction`, `createPersonAction`, `addMembershipAction`, `editNameAction`, `handoverAction`, `endAssignmentAction`, `endMembershipAction`, `transferAction`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/action-state.test.ts
import { describe, expect, it } from 'vitest';
import { doneHref, firstParam, parseDone } from './action-state';

describe('done notes', () => {
  it('builds and parses the ?done marker', () => {
    expect(doneHref('/paulo-freire/team/e1', 'person-created', 'applied')).toBe('/paulo-freire/team/e1?done=person-created');
    expect(doneHref('/paulo-freire/team/e1', 'renamed', 'already-applied')).toBe('/paulo-freire/team/e1?done=renamed&repeat=1');
    expect(parseDone({ done: 'renamed', repeat: '1' })).toEqual({ done: 'renamed', repeat: true });
    expect(parseDone({ done: 'hacked' })).toEqual({ done: null, repeat: false });
    expect(parseDone({ done: ['assigned', 'renamed'] })).toEqual({ done: 'assigned', repeat: false });
  });

  it('reads the first value of repeated parameters', () => {
    expect(firstParam({ view: ['people', 'former'] }, 'view')).toBe('people');
    expect(firstParam({}, 'view')).toBeUndefined();
  });
});
```

```ts
// src/app/(app)/[house]/team/actions.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { IDLE } from '@/lib/action-state';
import { StaffingError } from '@/lib/staffing-error';
import { getHouseBySlug } from '@/server/houses';
import * as store from '@/server/staffing-store';
import {
  createPersonAction,
  createPositionAction,
  editNameAction,
  endAssignmentAction,
  handoverAction,
  transferAction,
} from './actions';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { tag: 'prisma' } }));
vi.mock('@/server/houses', () => ({ getHouseBySlug: vi.fn() }));
vi.mock('@/server/staffing-store', () => ({
  createPosition: vi.fn(),
  relabelPosition: vi.fn(),
  createEmployee: vi.fn(),
  addMembership: vi.fn(),
  editEmployeeName: vi.fn(),
  previewHandover: vi.fn(),
  handover: vi.fn(),
  endAssignment: vi.fn(),
  previewEndMembership: vi.fn(),
  endMembership: vi.fn(),
  previewTransfer: vi.fn(),
  transfer: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const OP = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';
const E1 = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const P1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PF = { id: 'pf-id', slug: 'paulo-freire', name: 'Paulo Freire' };
const CA = { id: 'ca-id', slug: 'carme-aymerich', name: 'Carme Aymerich' };
const person = { operationId: OP, fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: '', positionId: '' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1' });
  vi.mocked(getHouseBySlug).mockImplementation(async (slug) => (slug === 'paulo-freire' ? PF : slug === 'carme-aymerich' ? CA : null) as never);
});

describe('access (AC-018)', () => {
  it('stops before reading the House or touching the store', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT /no-access'));
    await expect(createPersonAction('paulo-freire', IDLE, person)).rejects.toThrow('NEXT_REDIRECT /no-access');
    expect(getHouseBySlug).not.toHaveBeenCalled();
    expect(store.createEmployee).not.toHaveBeenCalled();
  });

  it('404s an unknown House slug', async () => {
    await expect(createPersonAction('casa-inexistent', IDLE, person)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(store.createEmployee).not.toHaveBeenCalled();
  });
});

describe('createPersonAction', () => {
  it('scopes to the route House, drops smuggled fields and redirects (AC-020)', async () => {
    vi.mocked(store.createEmployee).mockResolvedValue({ status: 'applied', result: { employeeId: E1, membershipId: 'm', assignmentId: null } });
    await expect(
      createPersonAction('paulo-freire', IDLE, { ...person, houseId: 'ca-id', role: 'director', clerkUserId: 'user_evil' }),
    ).rejects.toThrow(`NEXT_REDIRECT /paulo-freire/team/${E1}?done=person-created`);
    expect(store.createEmployee).toHaveBeenCalledWith({ tag: 'prisma' }, { operationId: OP, actor: 'user_1' }, 'pf-id', {
      fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: null,
    });
  });

  it('says when a retry was already applied (AC-023)', async () => {
    vi.mocked(store.createEmployee).mockResolvedValue({ status: 'already-applied', result: { employeeId: E1, membershipId: 'm', assignmentId: null } });
    await expect(createPersonAction('paulo-freire', IDLE, person)).rejects.toThrow('&repeat=1');
  });

  it('returns Catalan messages for rule failures, invalid input and unexpected errors', async () => {
    vi.mocked(store.createEmployee).mockRejectedValueOnce(new StaffingError('position-occupied'));
    await expect(createPersonAction('paulo-freire', IDLE, person)).resolves.toEqual({
      status: 'error', message: 'Aquest lloc ja està ocupat en aquestes dates.',
    });
    await expect(createPersonAction('paulo-freire', IDLE, { ...person, fullName: '' })).resolves.toMatchObject({ status: 'error' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(store.createEmployee).mockRejectedValueOnce(new Error('duplicate key value ... Ana Puig'));
    await expect(createPersonAction('paulo-freire', IDLE, person)).resolves.toMatchObject({ status: 'error' });
    expect(log).toHaveBeenCalledWith('[staffing] create-employee failed: unexpected');
    log.mockRestore();
  });
});

describe('createPositionAction', () => {
  it('creates in the route House and returns to the positions page', async () => {
    vi.mocked(store.createPosition).mockResolvedValue({ status: 'applied', result: { positionId: P1 } });
    await expect(createPositionAction('carme-aymerich', IDLE, { operationId: OP, roleCode: 'CT', label: 'CT nit' })).rejects.toThrow(
      'NEXT_REDIRECT /carme-aymerich/team/positions?done=position-created',
    );
    expect(store.createPosition).toHaveBeenCalledWith({ tag: 'prisma' }, { operationId: OP, actor: 'user_1' }, 'ca-id', { roleCode: 'CT', label: 'CT nit' });
  });
});

describe('editNameAction', () => {
  it('passes the loaded version for the stale check', async () => {
    vi.mocked(store.editEmployeeName).mockResolvedValue({ status: 'applied', result: { employeeId: E1 } });
    const input = { operationId: OP, employeeId: E1, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' };
    await expect(editNameAction('paulo-freire', IDLE, input)).rejects.toThrow(`/paulo-freire/team/${E1}?done=renamed`);
    expect(store.editEmployeeName).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'pf-id', {
      employeeId: E1, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z',
    });
  });
});

describe('handoverAction', () => {
  const handover = { operationId: OP, positionId: P1, employeeId: E1, startsOn: '2026-07-01', endsOn: '', from: 'position' };

  it('previews without writing', async () => {
    vi.mocked(store.previewHandover).mockResolvedValue({
      plan: { closes: [], opens: [{ kind: 'assignment', employeeId: E1, positionId: P1, houseId: 'pf-id', startsOn: '2026-07-01', endsOn: null }] },
      planToken: 'a'.repeat(64),
      names: { employees: { [E1]: 'Ana Puig' }, positions: { [P1]: 'ER 1' }, houses: { 'pf-id': 'Paulo Freire' } },
    });
    await expect(handoverAction('paulo-freire', IDLE, { ...handover, intent: 'preview' })).resolves.toEqual({
      status: 'preview',
      lines: ['Ana Puig: lloc ER 1 a Paulo Freire comença el 1 de juliol del 2026.'],
      planToken: 'a'.repeat(64),
    });
    expect(store.handover).not.toHaveBeenCalled();
  });

  it('confirms with the token and returns to the position page', async () => {
    vi.mocked(store.handover).mockResolvedValue({ status: 'applied', result: { positionId: P1, employeeId: E1, assignmentId: 'a' } });
    await expect(handoverAction('paulo-freire', IDLE, { ...handover, intent: 'confirm', planToken: 'b'.repeat(64) })).rejects.toThrow(
      `/paulo-freire/team/positions/${P1}?done=assigned`,
    );
    expect(store.handover).toHaveBeenCalledWith(expect.anything(), { operationId: OP, actor: 'user_1' }, 'pf-id', {
      positionId: P1, employeeId: E1, startsOn: '2026-07-01', endsOn: null, planToken: 'b'.repeat(64),
    });
  });

  it('reports a stale confirm', async () => {
    vi.mocked(store.handover).mockRejectedValue(new StaffingError('stale'));
    await expect(handoverAction('paulo-freire', IDLE, { ...handover, intent: 'confirm', planToken: 'b'.repeat(64) })).resolves.toEqual({
      status: 'error', message: 'Les dades han canviat mentrestant. Torna a carregar la pàgina.',
    });
  });
});

describe('endAssignmentAction', () => {
  it('returns to the employee page', async () => {
    vi.mocked(store.endAssignment).mockResolvedValue({ status: 'applied', result: { assignmentId: P1, employeeId: E1 } });
    await expect(endAssignmentAction('paulo-freire', IDLE, { operationId: OP, assignmentId: P1, endsOn: '2026-08-31' })).rejects.toThrow(
      `/paulo-freire/team/${E1}?done=assignment-ended`,
    );
  });
});

describe('transferAction', () => {
  it('resolves the destination House by slug and keeps the route House as source', async () => {
    vi.mocked(store.previewTransfer).mockResolvedValue({ plan: { closes: [], opens: [] }, planToken: 'c'.repeat(64), names: { employees: {}, positions: {}, houses: {} } });
    const input = { operationId: OP, employeeId: E1, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: '', intent: 'preview' };
    await transferAction('paulo-freire', IDLE, input);
    expect(store.previewTransfer).toHaveBeenCalledWith(expect.anything(), 'pf-id', {
      employeeId: E1, toHouseId: 'ca-id', startsOn: '2026-07-01', destinationPositionId: null,
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/action-state.test.ts team/actions`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/action-state.ts
// Shared between Server Functions (which may export only async functions) and
// client forms: the useActionState shape and the ?done=... success notes.

export type ActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; lines: string[]; planToken: string };

export const IDLE: ActionState = { status: 'idle' };

/** A staffing Server Function after the page has bound its House slug. */
export type StaffingAction = (state: ActionState, input: unknown) => Promise<ActionState>;

export const DONE_MESSAGES = {
  'person-created': 'Persona afegida.',
  'membership-added': 'Període afegit.',
  renamed: 'Nom actualitzat.',
  assigned: 'Lloc assignat.',
  'assignment-ended': 'Lloc finalitzat.',
  'membership-ended': 'Pertinença finalitzada.',
  transferred: 'Trasllat registrat.',
  'position-created': 'Lloc de treball creat.',
  'position-relabelled': 'Nom del lloc actualitzat.',
} as const;

export type DoneKind = keyof typeof DONE_MESSAGES;

export const ALREADY_APPLIED = "Aquesta acció ja s'havia desat. No s'ha duplicat res.";

export function doneHref(path: string, done: DoneKind, status: 'applied' | 'already-applied'): string {
  return `${path}?done=${done}${status === 'already-applied' ? '&repeat=1' : ''}`;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseDone(params: SearchParams): { done: DoneKind | null; repeat: boolean } {
  const done = firstParam(params, 'done');
  if (!done || !(done in DONE_MESSAGES)) return { done: null, repeat: false };
  return { done: done as DoneKind, repeat: firstParam(params, 'repeat') === '1' };
}
```

```ts
// src/app/(app)/[house]/team/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { doneHref, type ActionState, type DoneKind } from '@/lib/action-state';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';
import { prisma } from '@/lib/prisma';
import { StaffingError } from '@/lib/staffing-error';
import { INVALID_FORM, UNEXPECTED_ERROR, describePlan, errorMessage } from '@/lib/staffing-messages';
import {
  addMembershipSchema,
  createPersonSchema,
  createPositionSchema,
  editNameSchema,
  endAssignmentSchema,
  endMembershipRequestSchema,
  handoverRequestSchema,
  relabelPositionSchema,
  transferRequestSchema,
} from '@/lib/staffing-schemas';
import { getHouseBySlug } from '@/server/houses';
import * as store from '@/server/staffing-store';

// Every Server Function: requireDirector() first, then the House from the
// bound route slug (never a cookie or a form field), then zod (which drops
// unknown fields such as role or clerkUserId), then the store. Success
// redirects with ?done=...; failures return a Catalan message. Logs carry
// the operation kind only.

const INVALID: ActionState = { status: 'error', message: INVALID_FORM };

async function houseFor(slug: string) {
  if (!findHouseBySlug(slug)) notFound();
  const house = await getHouseBySlug(slug);
  if (!house) notFound();
  return house;
}

function failure(kind: string, error: unknown): ActionState {
  if (error instanceof StaffingError) return { status: 'error', message: errorMessage(error.reason) };
  console.error(`[staffing] ${kind} failed: unexpected`);
  return { status: 'error', message: UNEXPECTED_ERROR };
}

async function attempt<T>(kind: string, run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; state: ActionState }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, state: failure(kind, error) };
  }
}

async function preview(kind: string, run: () => Promise<store.Preview>): Promise<ActionState> {
  const result = await attempt(kind, run);
  if (!result.ok) return result.state;
  return { status: 'preview', lines: describePlan(result.value.plan, result.value.names), planToken: result.value.planToken };
}

function finish(slug: string, path: string, done: DoneKind, status: 'applied' | 'already-applied'): never {
  revalidatePath(`/${slug}/team`, 'layout');
  redirect(doneHref(path, done, status));
}

export async function createPositionAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = createPositionSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('create-position', () => store.createPosition(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/positions`, 'position-created', result.value.status);
}

export async function relabelPositionAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = relabelPositionSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('relabel-position', () => store.relabelPosition(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/positions/${data.positionId}`, 'position-relabelled', result.value.status);
}

export async function createPersonAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = createPersonSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('create-employee', () => store.createEmployee(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${result.value.result.employeeId}`, 'person-created', result.value.status);
}

export async function addMembershipAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = addMembershipSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('add-membership', () => store.addMembership(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${data.employeeId}`, 'membership-added', result.value.status);
}

export async function editNameAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = editNameSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('edit-name', () => store.editEmployeeName(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${data.employeeId}`, 'renamed', result.value.status);
}

export async function handoverAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = handoverRequestSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, intent, planToken, from, ...request } = parsed.data;
  if (intent === 'preview') return preview('handover', () => store.previewHandover(prisma, house.id, request));
  const result = await attempt('handover', () =>
    store.handover(prisma, { operationId, actor: userId }, house.id, { ...request, planToken: planToken ?? '' }),
  );
  if (!result.ok) return result.state;
  const path = from === 'position' ? `/${slug}/team/positions/${request.positionId}` : `/${slug}/team/${request.employeeId}`;
  finish(slug, path, 'assigned', result.value.status);
}

export async function endAssignmentAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = endAssignmentSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('end-assignment', () => store.endAssignment(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${result.value.result.employeeId}`, 'assignment-ended', result.value.status);
}

export async function endMembershipAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = endMembershipRequestSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, intent, planToken, ...request } = parsed.data;
  if (intent === 'preview') return preview('end-membership', () => store.previewEndMembership(prisma, house.id, request));
  const result = await attempt('end-membership', () =>
    store.endMembership(prisma, { operationId, actor: userId }, house.id, { ...request, planToken: planToken ?? '' }),
  );
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${result.value.result.employeeId}`, 'membership-ended', result.value.status);
}

export async function transferAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = transferRequestSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { operationId, intent, planToken, toHouseSlug, ...rest } = parsed.data;
  const toHouse = await getHouseBySlug(toHouseSlug);
  if (!toHouse) return INVALID;
  const request = { ...rest, toHouseId: toHouse.id };
  if (intent === 'preview') return preview('transfer', () => store.previewTransfer(prisma, house.id, request));
  const result = await attempt('transfer', () =>
    store.transfer(prisma, { operationId, actor: userId }, house.id, { ...request, planToken: planToken ?? '' }),
  );
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${request.employeeId}`, 'transferred', result.value.status);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/action-state.test.ts team/actions && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/action-state.ts src/lib/action-state.test.ts "src/app/(app)/[house]/team/actions.ts" "src/app/(app)/[house]/team/actions.test.ts"
git commit -m "feat(staffing): add director-gated Server Functions for every staffing workflow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 18: UI primitives, form kit and the House switcher rule

**Covers:** tasks.md 7.1, 7.2

**Files:**
- Create: `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/native-select.tsx`, `src/components/ui/alert.tsx`, `src/components/ui/alert.test.tsx`
- Create: `src/components/forms/field.tsx`, `src/components/forms/submit-button.tsx`, `src/components/forms/confirm-panel.tsx`, `src/components/forms/form-status.tsx`, `src/components/forms/form-card.tsx`, `src/components/forms/done-note.tsx`, `src/components/forms/use-operation-id.ts`, `src/components/forms/use-staffing-action.ts`, `src/components/forms/form-kit.test.tsx`
- Create: `src/components/segmented-links.tsx`, `src/components/back-link.tsx`, `src/components/empty-state.tsx`, `src/components/future-tag.tsx`
- Modify: `src/lib/houses.ts`, `src/lib/houses.test.ts`

**Interfaces:**
- Consumes: `Button` (`src/components/ui/button.tsx`), `HouseMark`, `ActionState`, `IDLE`, `StaffingAction`, `DONE_MESSAGES`, `ALREADY_APPLIED`, `DoneKind` (Task 17).
- Produces:
  - `Input`, `Label`, `NativeSelect` (forward refs, `aria-invalid` styling), `Alert({ variant: 'error' | 'info' | 'success', children, className? })` (icon + text; `role="alert"` for errors, `role="status"` otherwise)
  - `Field({ id, label, error?, hint?, children })`, `describedBy(id, error?)` returning `{ id, 'aria-invalid', 'aria-describedby' }`
  - `SubmitButton({ pending, children })`, `ConfirmPanel({ lines, pending, onConfirm, onCancel })`, `FormStatus({ state })`, `FormCard({ children, title? })`, `DoneNote({ done, repeat })`
  - `useOperationId(): string`, `useStaffingAction(action): { state, pending, preview, run(input), cancelPreview() }`
  - `SegmentedLinks({ label, items: { href, label, current }[] })`, `BackLink({ href, children })`, `EmptyState({ children })`, `FutureTag()`
  - `switchHousePath`: employee and position pages switch to `/<other>/team`; `team`, `team/new` and `team/positions` keep their path; switching to the same House keeps the path.

- [ ] **Step 1: Write the failing tests**

Replace the `describe('switchHousePath', ...)` block in `src/lib/houses.test.ts` with:

```ts
describe('switchHousePath', () => {
  const ID = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';

  it('swaps the House and keeps sections without a record', () => {
    expect(switchHousePath('/paulo-freire', 'carme-aymerich')).toBe('/carme-aymerich');
    expect(switchHousePath('/paulo-freire/team', 'carme-aymerich')).toBe('/carme-aymerich/team');
    expect(switchHousePath('/paulo-freire/team/new', 'carme-aymerich')).toBe('/carme-aymerich/team/new');
    expect(switchHousePath('/paulo-freire/team/positions', 'carme-aymerich')).toBe('/carme-aymerich/team/positions');
  });

  it("sends employee and position pages to the other House's team list (FR-006)", () => {
    expect(switchHousePath(`/paulo-freire/team/${ID}`, 'carme-aymerich')).toBe('/carme-aymerich/team');
    expect(switchHousePath(`/paulo-freire/team/${ID}/transfer`, 'carme-aymerich')).toBe('/carme-aymerich/team');
    expect(switchHousePath(`/paulo-freire/team/positions/${ID}`, 'carme-aymerich')).toBe('/carme-aymerich/team');
  });

  it('drops a trailing slash', () => {
    expect(switchHousePath('/paulo-freire/team/', 'carme-aymerich')).toBe('/carme-aymerich/team');
  });

  it('keeps the path when switching to the same House', () => {
    expect(switchHousePath('/paulo-freire/team', 'paulo-freire')).toBe('/paulo-freire/team');
    expect(switchHousePath(`/paulo-freire/team/${ID}`, 'paulo-freire')).toBe(`/paulo-freire/team/${ID}`);
  });

  it('goes to the House home from a non-House path', () => {
    expect(switchHousePath('/dashboard', 'carme-aymerich')).toBe('/carme-aymerich');
  });
});
```

```tsx
// src/components/ui/alert.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('announces errors with an icon and text, never honey', () => {
    render(<Alert variant="error">No s&apos;ha pogut desar.</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("No s'ha pogut desar.");
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(alert.className).not.toMatch(/accent/);
  });

  it('uses a status role for information and success', () => {
    render(<Alert variant="success">Persona afegida.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Persona afegida.');
  });
});
```

```tsx
// src/components/forms/form-kit.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/input';
import { ConfirmPanel } from './confirm-panel';
import { DoneNote } from './done-note';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';

describe('Field', () => {
  it('links the label and shows the error with an icon', () => {
    render(
      <Field id="fullName" label="Nom complet" error="Escriu el nom complet.">
        <Input {...describedBy('fullName', 'Escriu el nom complet.')} />
      </Field>,
    );
    const input = screen.getByLabelText('Nom complet');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'fullName-error');
    const error = screen.getByText('Escriu el nom complet.');
    expect(error.querySelector('svg')).not.toBeNull();
  });
});

describe('SubmitButton', () => {
  it('is disabled while pending', () => {
    const { rerender } = render(<SubmitButton pending={false}>Desa</SubmitButton>);
    expect(screen.getByRole('button', { name: 'Desa' })).toBeEnabled();
    rerender(<SubmitButton pending>Desa</SubmitButton>);
    expect(screen.getByRole('button', { name: 'Desant…' })).toBeDisabled();
  });
});

describe('ConfirmPanel', () => {
  it('lists the changes and confirms or cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmPanel lines={['Ana Puig: lloc ER 1 a Paulo Freire comença el 1 de juliol del 2026.']} pending={false} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Ana Puig');
    await userEvent.click(screen.getByRole('button', { name: 'Confirma' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel·la' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('FormStatus and DoneNote', () => {
  it('shows only errors', () => {
    const { container } = render(<FormStatus state={{ status: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
    render(<FormStatus state={{ status: 'error', message: 'Aquest lloc ja està ocupat en aquestes dates.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('ocupat');
  });

  it('says when a retry changed nothing', () => {
    render(<DoneNote done="person-created" repeat />);
    expect(screen.getByRole('status')).toHaveTextContent("Aquesta acció ja s'havia desat. No s'ha duplicat res.");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/houses.test.ts src/components/ui/alert.test.tsx src/components/forms`
Expected: FAIL (components missing; employee-page switch cases fail).

- [ ] **Step 3: Implement**

In `src/lib/houses.ts`, replace `switchHousePath` with:

```ts
// Team pages without a record in the path keep their section when switching;
// employee and position pages go to the other House's team list, because an
// employee or position ID has no relationship with the other House (FR-006).
const RECORD_FREE_TEAM_PAGES = new Set(['new', 'positions']);

/**
 * Same section, other House: `/paulo-freire/team` becomes `/carme-aymerich/team`.
 * A path outside any House goes to the target House home.
 */
export function switchHousePath(pathname: string, toSlug: HouseSlug): string {
  const fromSlug = houseSlugFromPath(pathname);
  if (!fromSlug) return `/${toSlug}`;
  const [, section, page, ...deeper] = pathname.split('/').filter(Boolean);
  const rest = [section, page, ...deeper].filter((segment): segment is string => segment !== undefined);
  if (fromSlug === toSlug) return `/${[toSlug, ...rest].join('/')}`;
  const recordPage = section === 'team' && page !== undefined && (deeper.length > 0 || !RECORD_FREE_TEAM_PAGES.has(page));
  if (recordPage) return `/${toSlug}/team`;
  return `/${[toSlug, ...rest].join('/')}`;
}
```

```tsx
// src/components/ui/input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-lg border border-input bg-card px-3 text-[0.9375rem] text-foreground transition-colors duration-150 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 aria-[invalid=true]:border-error md:h-10',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
```

```tsx
// src/components/ui/label.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}
```

```tsx
// src/components/ui/native-select.tsx
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A native <select>: mobile-native pickers, keyboard friendly, no portal. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-11 w-full appearance-none rounded-lg border border-input bg-card pl-3 pr-9 text-[0.9375rem] text-foreground transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 aria-[invalid=true]:border-error md:h-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';
```

```tsx
// src/components/ui/alert.tsx
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Errors always carry an icon and text (crimson is close to terracotta).
// Never honey: honey means "waiting for the coordinator's decision".
const VARIANTS = {
  error: { icon: CircleAlert, tone: 'bg-error-bg text-error', role: 'alert' },
  info: { icon: Info, tone: 'bg-info-bg text-info', role: 'status' },
  success: { icon: CircleCheck, tone: 'bg-success-bg text-success', role: 'status' },
} as const;

export function Alert({
  variant = 'info',
  className,
  children,
}: Readonly<{ variant?: keyof typeof VARIANTS; className?: string; children: React.ReactNode }>) {
  const { icon: Icon, tone, role } = VARIANTS[variant];
  return (
    <div role={role} className={cn('flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium', tone, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
```

```tsx
// src/components/forms/field.tsx
import { CircleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';

/** Props that tie a control to its label and error message. */
export function describedBy(id: string, error?: string) {
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined } as const;
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: Readonly<{ id: string; label: string; error?: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
```

```tsx
// src/components/forms/submit-button.tsx
import { Button } from '@/components/ui/button';

/** Disabled while pending; the server's operation receipts still guard against repeats. */
export function SubmitButton({ pending, children }: Readonly<{ pending: boolean; children: React.ReactNode }>) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? 'Desant…' : children}
    </Button>
  );
}
```

```tsx
// src/components/forms/confirm-panel.tsx
import { Button } from '@/components/ui/button';

/** Step two of handovers, transfers and ending a membership: nothing is written until "Confirma". */
export function ConfirmPanel({
  lines,
  pending,
  onConfirm,
  onCancel,
}: Readonly<{ lines: readonly string[]; pending: boolean; onConfirm: () => void; onCancel: () => void }>) {
  return (
    <section aria-labelledby="confirm-title" className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <p id="confirm-title" className="font-semibold text-foreground">
        Revisa els canvis abans de confirmar
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm tabular-nums text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirm} disabled={pending}>
          {pending ? 'Desant…' : 'Confirma'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel·la
        </Button>
      </div>
    </section>
  );
}
```

```tsx
// src/components/forms/form-status.tsx
import { Alert } from '@/components/ui/alert';
import type { ActionState } from '@/lib/action-state';

export function FormStatus({ state }: Readonly<{ state: ActionState }>) {
  return state.status === 'error' ? <Alert variant="error">{state.message}</Alert> : null;
}
```

```tsx
// src/components/forms/form-card.tsx
export function FormCard({ title, children }: Readonly<{ title?: string; children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-clay sm:p-6">
      {title && <h2 className="text-xl">{title}</h2>}
      {children}
    </section>
  );
}
```

```tsx
// src/components/forms/done-note.tsx
import { Alert } from '@/components/ui/alert';
import { ALREADY_APPLIED, DONE_MESSAGES, type DoneKind } from '@/lib/action-state';

export function DoneNote({ done, repeat }: Readonly<{ done: DoneKind; repeat: boolean }>) {
  return <Alert variant="success">{repeat ? ALREADY_APPLIED : DONE_MESSAGES[done]}</Alert>;
}
```

```ts
// src/components/forms/use-operation-id.ts
'use client';

import { useState } from 'react';

/** One operation ID per form instance (design D5): every retry of this form is the same operation. */
export function useOperationId(): string {
  const [id] = useState(() => crypto.randomUUID());
  return id;
}
```

```ts
// src/components/forms/use-staffing-action.ts
'use client';

import { startTransition, useActionState, useState } from 'react';
import { IDLE, type ActionState, type StaffingAction } from '@/lib/action-state';

/** useActionState for a staffing Server Function, plus the preview/cancel state of two-step forms. */
export function useStaffingAction(action: StaffingAction) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const preview = state.status === 'preview' && state !== dismissed ? state : null;
  return {
    state,
    pending,
    preview,
    run: (input: unknown) => startTransition(() => dispatch(input)),
    cancelPreview: () => setDismissed(state),
  };
}
```

```tsx
// src/components/segmented-links.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** A segmented control made of links (state lives in the URL). Selected = Salvia, never honey. */
export function SegmentedLinks({
  label,
  items,
}: Readonly<{ label: string; items: readonly { href: string; label: string; current: boolean }[] }>) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-background p-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out md:min-h-8',
            item.current ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

```tsx
// src/components/back-link.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground md:min-h-8">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}
```

```tsx
// src/components/empty-state.tsx
import { HouseMark } from '@/components/house-mark';

export function EmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center shadow-clay">
      <HouseMark className="size-24" />
      <p className="text-[0.9375rem] text-muted-foreground">{children}</p>
    </section>
  );
}
```

```tsx
// src/components/future-tag.tsx
/** Neutral marker for periods that have not started yet (never honey). */
export function FutureTag() {
  return <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Futur</span>;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (the house switcher component test still expects `/carme-aymerich/team` from `/paulo-freire/team`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui src/components/forms src/components/segmented-links.tsx src/components/back-link.tsx src/components/empty-state.tsx src/components/future-tag.tsx src/lib/houses.ts src/lib/houses.test.ts
git commit -m "feat(ui): add form primitives and send record pages to the other House's team

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 19: The Equip page on a date, with positions and former members

**Covers:** tasks.md 7.3

**Files:**
- Create: `src/lib/team-params.ts`, `src/lib/team-params.test.ts`, `src/app/(app)/[house]/team/page-context.ts`
- Create: `src/components/team/people-list.tsx`, `src/components/team/positions-list.tsx`, `src/components/team/former-members-list.tsx`, `src/components/team/date-control.tsx`, `src/components/team/team-lists.test.tsx`
- Modify: `src/app/(app)/[house]/team/page.tsx`, `src/server/houses.ts`, `src/server/houses.test.ts`
- Delete: `src/components/team-list.tsx`, `src/components/team-list.test.tsx`, `src/server/membership-store.ts`, `src/server/membership-store.test.ts`

**Interfaces:**
- Consumes: Task 16 `loadTeamView`; Task 18 kit; `PersonRow`, `PositionRow`, `FormerRow` (`@/lib/staffing-views`); `ROLES`, `findRole`; `formatDateCa`, `formatPeriodCa`; `parseDone`, `firstParam`, `SearchParams`.
- Produces:
  - `TEAM_VIEWS`, `type TeamViewName = 'people' | 'positions' | 'former'`, `parseTeamSearchParams(params, today): { view: TeamViewName; date: IsoDate }`, `teamHref(slug, view, date, today): string`
  - `houseContext(params: Promise<{ house: string }>): Promise<{ slug: HouseSlug; house: { id: string; slug: string; name: string }; today: IsoDate }>` (calls `requireDirector()` first, 404s unknown Houses)
  - `PeopleList`, `PositionsList`, `FormerMembersList`, `DateControl` (used again in Tasks 21 and 23)
  - `src/server/houses.ts` exports only `getHouseBySlug`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/team-params.test.ts
import { describe, expect, it } from 'vitest';
import { parseTeamSearchParams, teamHref } from './team-params';

const TODAY = '2026-10-08';

describe('parseTeamSearchParams (Review Focus 2)', () => {
  it('defaults to people today', () => {
    expect(parseTeamSearchParams({}, TODAY)).toEqual({ view: 'people', date: TODAY });
  });

  it('accepts known views and real dates', () => {
    expect(parseTeamSearchParams({ view: 'positions', date: '2026-07-01' }, TODAY)).toEqual({ view: 'positions', date: '2026-07-01' });
  });

  it('falls back on invalid or repeated values', () => {
    expect(parseTeamSearchParams({ view: 'admin', date: '2026-02-30' }, TODAY)).toEqual({ view: 'people', date: TODAY });
    expect(parseTeamSearchParams({ date: 'yesterday' }, TODAY).date).toBe(TODAY);
    expect(parseTeamSearchParams({ view: ['former', 'people'] }, TODAY).view).toBe('former');
  });
});

describe('teamHref', () => {
  it('omits defaults from the URL', () => {
    expect(teamHref('paulo-freire', 'people', TODAY, TODAY)).toBe('/paulo-freire/team');
    expect(teamHref('paulo-freire', 'positions', '2026-07-01', TODAY)).toBe('/paulo-freire/team?view=positions&date=2026-07-01');
    expect(teamHref('paulo-freire', 'former', '2026-07-01', TODAY)).toBe('/paulo-freire/team?view=former');
  });
});
```

```tsx
// src/components/team/team-lists.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormerMembersList } from './former-members-list';
import { PeopleList } from './people-list';
import { PositionsList } from './positions-list';

describe('PeopleList', () => {
  it('shows each member with position or "Sense lloc assignat", linking to the history', () => {
    render(
      <PeopleList
        houseSlug="paulo-freire"
        houseName="Paulo Freire"
        isToday
        rows={[
          { employeeId: 'e1', fullName: 'Ana Puig', memberSince: '2026-01-01', positionId: 'p1', positionLabel: 'ER 1' },
          { employeeId: 'e2', fullName: 'Núria Costa', memberSince: '2025-09-01', positionId: null, positionLabel: null },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('ER 1');
    expect(items[0]).toHaveTextContent('Des del 1 de gener del 2026');
    expect(within(items[0]).getByRole('link', { name: 'Ana Puig' })).toHaveAttribute('href', '/paulo-freire/team/e1');
    expect(items[1]).toHaveTextContent('Sense lloc assignat');
  });

  it('distinguishes an empty team today from an empty past date', () => {
    const { rerender } = render(<PeopleList houseSlug="paulo-freire" houseName="Paulo Freire" isToday rows={[]} />);
    expect(screen.getByText("Encara no hi ha ningú a l'equip de Paulo Freire.")).toBeInTheDocument();
    rerender(<PeopleList houseSlug="paulo-freire" houseName="Paulo Freire" isToday={false} rows={[]} />);
    expect(screen.getByText("Ningú no formava part de l'equip de Paulo Freire aquest dia.")).toBeInTheDocument();
  });
});

describe('PositionsList', () => {
  it('groups by role and shows vacancies in neutral text (no honey)', () => {
    const { container } = render(
      <PositionsList
        houseSlug="paulo-freire"
        houseName="Paulo Freire"
        rows={[
          { positionId: 'p1', label: 'ER 1', roleCode: 'ER', occupant: { employeeId: 'e1', fullName: 'Laia Serra' } },
          { positionId: 'p2', label: 'ER 2', roleCode: 'ER', occupant: null },
          { positionId: 'p3', label: 'CT', roleCode: 'CT', occupant: null },
        ]}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Educadora referent', 'Corretor']);
    const er = screen.getByRole('region', { name: 'Educadora referent' });
    expect(within(er).getAllByRole('listitem')[0]).toHaveTextContent('ER 1Laia Serra');
    expect(within(er).getAllByRole('listitem')[1]).toHaveTextContent('ER 2Vacant');
    expect(container.innerHTML).not.toMatch(/accent/);
  });

  it('has an empty state', () => {
    render(<PositionsList houseSlug="paulo-freire" houseName="Paulo Freire" rows={[]} />);
    expect(screen.getByText('Encara no hi ha llocs de treball a Paulo Freire.')).toBeInTheDocument();
  });
});

describe('FormerMembersList', () => {
  it('shows the last period in the House', () => {
    render(<FormerMembersList houseSlug="paulo-freire" houseName="Paulo Freire" rows={[{ employeeId: 'e1', fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: '2026-06-30' }]} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Del 1 de gener del 2026 al 30 de juny del 2026');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/team-params.test.ts src/components/team`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/team-params.ts
import { firstParam, type SearchParams } from './action-state';
import { isIsoDate, type IsoDate } from './dates';

export const TEAM_VIEWS = ['people', 'positions', 'former'] as const;
export type TeamViewName = (typeof TEAM_VIEWS)[number];

function isTeamView(value: string | undefined): value is TeamViewName {
  return TEAM_VIEWS.some((view) => view === value);
}

/** `?view=` and `?date=` of the Equip page; anything invalid falls back to people today. */
export function parseTeamSearchParams(params: SearchParams, today: IsoDate): { view: TeamViewName; date: IsoDate } {
  const view = firstParam(params, 'view');
  const date = firstParam(params, 'date');
  return { view: isTeamView(view) ? view : 'people', date: date && isIsoDate(date) ? date : today };
}

export function teamHref(slug: string, view: TeamViewName, date: IsoDate, today: IsoDate): string {
  const query = new URLSearchParams();
  if (view !== 'people') query.set('view', view);
  if (view !== 'former' && date !== today) query.set('date', date);
  const search = query.toString();
  return `/${slug}/team${search ? `?${search}` : ''}`;
}
```

```ts
// src/app/(app)/[house]/team/page-context.ts
import 'server-only';
import { notFound } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid } from '@/lib/dates';
import { findHouseBySlug } from '@/lib/houses';
import { getHouseBySlug } from '@/server/houses';
import { loadEmployeeHistory, loadPositionDetail } from '@/server/staffing';

// Shared start of every team page: the director check comes first (pages and
// layouts render in parallel), then the House from the URL, then the record.

export async function houseContext(params: Promise<{ house: string }>) {
  await requireDirector();
  const { house: slug } = await params;
  const known = findHouseBySlug(slug);
  if (!known) notFound();
  const house = await getHouseBySlug(slug);
  if (!house) notFound();
  return { slug: known.slug, house, today: todayInMadrid() };
}

export async function employeeContext(params: Promise<{ house: string; employeeId: string }>) {
  const context = await houseContext(params);
  const { employeeId } = await params;
  const history = await loadEmployeeHistory(context.house.id, employeeId);
  if (!history) notFound();
  return { ...context, history };
}

export async function positionContext(params: Promise<{ house: string; positionId: string }>) {
  const context = await houseContext(params);
  const { positionId } = await params;
  const detail = await loadPositionDetail(context.house.id, positionId);
  if (!detail) notFound();
  return { ...context, detail };
}
```

```tsx
// src/components/team/people-list.tsx
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { formatDateCa } from '@/lib/dates';
import type { PersonRow } from '@/lib/staffing-views';
import { cn } from '@/lib/utils';

/** Members on the selected date with their position (FR-005). */
export function PeopleList({
  houseSlug,
  houseName,
  rows,
  isToday,
}: Readonly<{ houseSlug: string; houseName: string; rows: readonly PersonRow[]; isToday: boolean }>) {
  if (rows.length === 0) {
    return (
      <EmptyState>
        {isToday ? `Encara no hi ha ningú a l'equip de ${houseName}.` : `Ningú no formava part de l'equip de ${houseName} aquest dia.`}
      </EmptyState>
    );
  }
  return (
    <section aria-label={`Equip de ${houseName}`} className="rounded-2xl bg-card shadow-clay">
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <Link href={`/${houseSlug}/team/${row.employeeId}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
                {row.fullName}
              </Link>
              <span className={cn('text-sm', row.positionLabel ? 'text-foreground' : 'text-muted-foreground')}>
                {row.positionLabel ?? 'Sense lloc assignat'}
              </span>
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">Des del {formatDateCa(row.memberSince)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// src/components/team/positions-list.tsx
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ROLES } from '@/lib/roles';
import type { PositionRow } from '@/lib/staffing-views';

/** Every position grouped by role, with its occupant or "Vacant" (FR-005, FR-007). */
export function PositionsList({
  houseSlug,
  houseName,
  rows,
}: Readonly<{ houseSlug: string; houseName: string; rows: readonly PositionRow[] }>) {
  if (rows.length === 0) return <EmptyState>Encara no hi ha llocs de treball a {houseName}.</EmptyState>;
  const groups = ROLES.map((role) => ({ role, rows: rows.filter((row) => row.roleCode === role.code) })).filter((group) => group.rows.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ role, rows: items }) => (
        <section key={role.code} aria-labelledby={`role-${role.code}`} className="rounded-2xl bg-card shadow-clay">
          <h2 id={`role-${role.code}`} className="px-5 pt-4 text-xl">
            {role.label}
          </h2>
          <ul className="divide-y divide-border">
            {items.map((row) => (
              <li key={row.positionId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
                <Link href={`/${houseSlug}/team/positions/${row.positionId}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
                  {row.label}
                </Link>
                {row.occupant ? (
                  <Link href={`/${houseSlug}/team/${row.occupant.employeeId}`} className="text-sm text-foreground underline-offset-4 hover:underline">
                    {row.occupant.fullName}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Vacant</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

```tsx
// src/components/team/former-members-list.tsx
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { formatPeriodCa } from '@/lib/dates';
import type { FormerRow } from '@/lib/staffing-views';

export function FormerMembersList({
  houseSlug,
  houseName,
  rows,
}: Readonly<{ houseSlug: string; houseName: string; rows: readonly FormerRow[] }>) {
  if (rows.length === 0) return <EmptyState>No hi ha membres anteriors a {houseName}.</EmptyState>;
  return (
    <section aria-label={`Membres anteriors de ${houseName}`} className="rounded-2xl bg-card shadow-clay">
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <Link href={`/${houseSlug}/team/${row.employeeId}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
              {row.fullName}
            </Link>
            <span className="text-sm tabular-nums text-muted-foreground">{formatPeriodCa(row)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// src/components/team/date-control.tsx
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateCa, type IsoDate } from '@/lib/dates';
import type { TeamViewName } from '@/lib/team-params';

/** A plain GET form: the selected date lives in the URL and works without JavaScript. */
export function DateControl({ view, date }: Readonly<{ view: TeamViewName; date: IsoDate }>) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      {view !== 'people' && <input type="hidden" name="view" value={view} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-date">Data</Label>
        <Input id="team-date" type="date" name="date" defaultValue={date} className="w-auto tabular-nums" />
      </div>
      <Button type="submit" variant="outline">
        Mostra
      </Button>
    </form>
  );
}

/** Makes a non-today date unmistakable (FR-005). Neutral info colour, not honey. */
export function DateBanner({ date, todayHref }: Readonly<{ date: IsoDate; todayHref: string }>) {
  return (
    <Alert variant="info">
      <span className="tabular-nums">Mostrant l&apos;equip del {formatDateCa(date)}.</span>{' '}
      <Link href={todayHref} className="font-semibold underline underline-offset-4">
        Torna a avui
      </Link>
    </Alert>
  );
}
```

Replace `src/app/(app)/[house]/team/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { DoneNote } from '@/components/forms/done-note';
import { HousePageHeader } from '@/components/house-page-header';
import { SegmentedLinks } from '@/components/segmented-links';
import { DateBanner, DateControl } from '@/components/team/date-control';
import { FormerMembersList } from '@/components/team/former-members-list';
import { PeopleList } from '@/components/team/people-list';
import { PositionsList } from '@/components/team/positions-list';
import { Button } from '@/components/ui/button';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { TEAM_VIEWS, parseTeamSearchParams, teamHref, type TeamViewName } from '@/lib/team-params';
import { loadTeamView } from '@/server/staffing';
import { houseContext } from './page-context';

export const metadata: Metadata = {
  title: "Equip · Casa d'Infants",
};

const VIEW_LABELS: Record<TeamViewName, string> = { people: 'Persones', positions: 'Llocs', former: 'Membres anteriors' };

export default async function TeamPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today } = await houseContext(params);
  const query = await searchParams;
  const { view, date } = parseTeamSearchParams(query, today);
  const { done, repeat } = parseDone(query);
  const team = await loadTeamView(house.id, date);

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <HousePageHeader houseName={house.name} title="Equip" />
      {done && <DoneNote done={done} repeat={repeat} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Vistes de l'equip"
          items={TEAM_VIEWS.map((v) => ({ href: teamHref(slug, v, date, today), label: VIEW_LABELS[v], current: v === view }))}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/${slug}/team/positions`}>Llocs de treball</Link>
          </Button>
          <Button asChild>
            <Link href={`/${slug}/team/new`}>
              <UserPlus aria-hidden="true" />
              Afegir persona
            </Link>
          </Button>
        </div>
      </div>
      {view !== 'former' && <DateControl view={view} date={date} />}
      {view !== 'former' && date !== today && <DateBanner date={date} todayHref={teamHref(slug, view, today, today)} />}
      {view === 'people' && <PeopleList houseSlug={slug} houseName={house.name} rows={team.people} isToday={date === today} />}
      {view === 'positions' && <PositionsList houseSlug={slug} houseName={house.name} rows={team.positions} />}
      {view === 'former' && <FormerMembersList houseSlug={slug} houseName={house.name} rows={team.former} />}
    </main>
  );
}
```

Retire the SPEC-001 read-only pieces:
- Delete `src/components/team-list.tsx`, `src/components/team-list.test.tsx`, `src/server/membership-store.ts`, `src/server/membership-store.test.ts`.
- In `src/server/houses.ts`, delete `listCurrentMembers` and its imports; keep `getHouseBySlug`. In `src/server/houses.test.ts`, drop `listCurrentMembers`, the `houseMembership` mock and the "lists current members" test.

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS; `grep -rn "membership-store\|listCurrentMembers\|TeamList" src prisma` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/team-params.ts src/lib/team-params.test.ts src/components/team src/components/team-list.tsx src/components/team-list.test.tsx "src/app/(app)/[house]/team" src/server
git commit -m "feat(team): show people and positions on a date, vacancies and former members

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 20: Afegir persona (new person or existing person)

**Covers:** tasks.md 7.4

**Files:**
- Create: `src/components/forms/position-select.tsx`, `src/components/forms/create-person-form.tsx`, `src/components/forms/add-membership-form.tsx`, `src/components/forms/person-forms.test.tsx`
- Create: `src/app/(app)/[house]/team/new/page.tsx`

**Interfaces:**
- Consumes: Task 18 kit; Task 6 schemas; Task 17 actions and `StaffingAction`; `PositionRow`, `EmployeeOption` (`@/lib/staffing-views`); `loadPositionRows`, `loadEmployeeOptions`; `houseContext`.
- Produces:
  - `PositionSelect({ positions, emptyLabel?, ...selectProps })` (option text `${label} · ${role label}` plus ` (ara: ${name})` when occupied today)
  - `CreatePersonForm({ action, houseName, today, positions })`
  - `AddMembershipForm({ action, houseName, today, positions, employee?: { id: string; fullName: string }, employees?: EmployeeOption[] })` (fixed employee or a select; used again by Task 21)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/forms/person-forms.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { AddMembershipForm } from './add-membership-form';
import { CreatePersonForm } from './create-person-form';

const POS = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const EMP = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const positions = [
  { positionId: POS, label: 'ER 1', roleCode: 'ER' as const, occupant: null },
  { positionId: 'p2', label: 'CT', roleCode: 'CT' as const, occupant: { employeeId: 'x', fullName: 'Pol Jiménez Alcover' } },
];

describe('CreatePersonForm', () => {
  it('validates in Catalan and keeps the typed values', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<CreatePersonForm action={action} houseName="Paulo Freire" today="2026-10-08" positions={positions} />);
    // jsdom date inputs: set the whole value (typing digit by digit is unreliable).
    fireEvent.change(screen.getByLabelText('Final (opcional)'), { target: { value: '2026-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix la persona' }));
    expect(await screen.findByText('Escriu el nom complet.')).toBeInTheDocument();
    expect(screen.getByText("La data de final no pot ser anterior a la d'inici.")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Final (opcional)')).toHaveValue('2026-01-01');
  });

  it('labels occupied positions and submits parsed values with an operation ID', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'error', message: 'Aquest lloc ja està ocupat en aquestes dates.' }));
    render(<CreatePersonForm action={action} houseName="Paulo Freire" today="2026-10-08" positions={positions} />);
    expect(screen.getByRole('option', { name: 'CT · Corretor (ara: Pol Jiménez Alcover)' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nom complet'), '  Ana Puig ');
    await userEvent.selectOptions(screen.getByLabelText('Lloc (opcional)'), POS);
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix la persona' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ocupat');
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, {
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      fullName: 'Ana Puig',
      startsOn: '2026-10-08',
      endsOn: null,
      positionId: POS,
    });
    expect(screen.getByLabelText('Nom complet')).toHaveValue('  Ana Puig ');
  });
});

describe('AddMembershipForm', () => {
  it('picks an existing person and shows where they are now', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(
      <AddMembershipForm
        action={action}
        houseName="Paulo Freire"
        today="2026-10-08"
        positions={positions}
        employees={[{ employeeId: EMP, fullName: 'Ana Puig', currentHouseName: 'Carme Aymerich' }]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Persona'), EMP);
    expect(screen.getByRole('option', { name: 'Ana Puig (ara a Carme Aymerich)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix el període' }));
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ employeeId: EMP, startsOn: '2026-10-08', positionId: null }));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/forms/person-forms.test.tsx`
Expected: FAIL (forms missing).

- [ ] **Step 3: Implement**

```tsx
// src/components/forms/position-select.tsx
import { NativeSelect } from '@/components/ui/native-select';
import { findRole } from '@/lib/roles';
import type { PositionRow } from '@/lib/staffing-views';

/** Positions of one House; occupied ones say who holds them today (the server still checks the chosen dates). */
export function PositionSelect({
  positions,
  emptyLabel = 'Sense lloc',
  ...props
}: React.ComponentProps<typeof NativeSelect> & { positions: readonly PositionRow[]; emptyLabel?: string }) {
  return (
    <NativeSelect {...props}>
      <option value="">{emptyLabel}</option>
      {positions.map((position) => (
        <option key={position.positionId} value={position.positionId}>
          {`${position.label} · ${findRole(position.roleCode)?.label ?? position.roleCode}`}
          {position.occupant ? ` (ara: ${position.occupant.fullName})` : ''}
        </option>
      ))}
    </NativeSelect>
  );
}
```

```tsx
// src/components/forms/create-person-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import { createPersonSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { PositionSelect } from './position-select';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof createPersonSchema;

/** A new person with an initial membership in this House and an optional position, saved together (FR-002). */
export function CreatePersonForm({
  action,
  houseName,
  today,
  positions,
}: Readonly<{ action: StaffingAction; houseName: string; today: IsoDate; positions: readonly PositionRow[] }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: { operationId, fullName: '', startsOn: today, endsOn: '', positionId: '' },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field id="fullName" label="Nom complet" error={errors.fullName?.message}>
        <Input autoComplete="off" {...describedBy('fullName', errors.fullName?.message)} {...register('fullName')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startsOn" label={`Inici a ${houseName}`} error={errors.startsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('startsOn', errors.startsOn?.message)} {...register('startsOn')} />
        </Field>
        <Field id="endsOn" label="Final (opcional)" error={errors.endsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
        </Field>
      </div>
      <Field id="positionId" label="Lloc (opcional)" error={errors.positionId?.message}>
        <PositionSelect positions={positions} {...describedBy('positionId', errors.positionId?.message)} {...register('positionId')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Afegeix la persona</SubmitButton>
      </div>
    </form>
  );
}
```

```tsx
// src/components/forms/add-membership-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import { addMembershipSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { EmployeeOption, PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { PositionSelect } from './position-select';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof addMembershipSchema;

/** A new membership period for an existing person: a return after a gap, or someone from the other House (FR-003). */
export function AddMembershipForm({
  action,
  houseName,
  today,
  positions,
  employee,
  employees = [],
}: Readonly<{
  action: StaffingAction;
  houseName: string;
  today: IsoDate;
  positions: readonly PositionRow[];
  employee?: { id: string; fullName: string };
  employees?: readonly EmployeeOption[];
}>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(addMembershipSchema),
    defaultValues: { operationId, employeeId: employee?.id ?? '', startsOn: today, endsOn: '', positionId: '' },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      {employee ? (
        <p className="text-[0.9375rem] text-foreground">
          Nou període a {houseName} per a <span className="font-semibold">{employee.fullName}</span>.
        </p>
      ) : (
        <Field id="employeeId" label="Persona" error={errors.employeeId ? 'Tria una persona.' : undefined}>
          <NativeSelect {...describedBy('employeeId', errors.employeeId?.message)} {...register('employeeId')}>
            <option value="">Tria una persona</option>
            {employees.map((option) => (
              <option key={option.employeeId} value={option.employeeId}>
                {option.fullName}
                {option.currentHouseName ? ` (ara a ${option.currentHouseName})` : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startsOn" label={`Inici a ${houseName}`} error={errors.startsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('startsOn', errors.startsOn?.message)} {...register('startsOn')} />
        </Field>
        <Field id="endsOn" label="Final (opcional)" error={errors.endsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
        </Field>
      </div>
      <Field id="positionId" label="Lloc (opcional)" error={errors.positionId?.message}>
        <PositionSelect positions={positions} {...describedBy('positionId', errors.positionId?.message)} {...register('positionId')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Afegeix el període</SubmitButton>
      </div>
    </form>
  );
}
```

```tsx
// src/app/(app)/[house]/team/new/page.tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { AddMembershipForm } from '@/components/forms/add-membership-form';
import { CreatePersonForm } from '@/components/forms/create-person-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { SegmentedLinks } from '@/components/segmented-links';
import { firstParam, type SearchParams } from '@/lib/action-state';
import { loadEmployeeOptions, loadPositionRows } from '@/server/staffing';
import { addMembershipAction, createPersonAction } from '../actions';
import { houseContext } from '../page-context';

export const metadata: Metadata = {
  title: "Afegir persona · Casa d'Infants",
};

export default async function NewPersonPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today } = await houseContext(params);
  const existing = firstParam(await searchParams, 'mode') === 'existing';
  const [positions, employees] = await Promise.all([
    loadPositionRows(house.id, today),
    existing ? loadEmployeeOptions(house.id) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team`}>Equip</BackLink>
      <HousePageHeader houseName={house.name} title="Afegir persona" />
      <SegmentedLinks
        label="Tipus de persona"
        items={[
          { href: `/${slug}/team/new`, label: 'Persona nova', current: !existing },
          { href: `/${slug}/team/new?mode=existing`, label: 'Persona existent', current: existing },
        ]}
      />
      <FormCard>
        {existing ? (
          <AddMembershipForm
            action={addMembershipAction.bind(null, slug)}
            houseName={house.name}
            today={today}
            positions={positions}
            employees={employees}
          />
        ) : (
          <CreatePersonForm action={createPersonAction.bind(null, slug)} houseName={house.name} today={today} positions={positions} />
        )}
      </FormCard>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS. If jsdom lacks `crypto.randomUUID`, add `import { webcrypto } from 'node:crypto'; if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });` to `vitest.setup.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms "src/app/(app)/[house]/team/new" vitest.setup.ts
git commit -m "feat(team): add a new or existing person to a House

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 21: Employee history and its single-step actions

**Covers:** tasks.md 7.5 (history, edit name, end position, add period)

**Files:**
- Create: `src/lib/employee-actions.ts`, `src/lib/employee-actions.test.ts`
- Create: `src/components/team/employee-history.tsx`, `src/components/team/employee-history.test.tsx`
- Create: `src/components/forms/edit-name-form.tsx`, `src/components/forms/end-assignment-form.tsx`, `src/components/forms/employee-forms.test.tsx`
- Create: `src/app/(app)/[house]/team/[employeeId]/page.tsx`, `.../[employeeId]/edit-name/page.tsx`, `.../[employeeId]/assignment/end/page.tsx`, `.../[employeeId]/membership/new/page.tsx`

**Interfaces:**
- Consumes: `EmployeeHistory` (`@/lib/staffing-views`); `employeeContext`; Task 20 `AddMembershipForm`; Task 18 kit; `editNameAction`, `endAssignmentAction`, `addMembershipAction`.
- Produces:
  - `employeeActionState(history: EmployeeHistory, houseId: string): { ongoingHere: HistoryMembership | null; openAssignmentHere: HistoryAssignment | null; hasOngoingMembership: boolean }`
  - `EmployeeHistoryView({ history, today })`
  - `EditNameForm({ action, employeeId, fullName, updatedAt })`, `EndAssignmentForm({ action, assignment: { id: string; positionLabel: string; startsOn: IsoDate }, today })`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/employee-actions.test.ts
import { describe, expect, it } from 'vitest';
import { employeeActionState } from './employee-actions';
import type { EmployeeHistory } from './staffing-views';

const history: EmployeeHistory = {
  employee: { id: 'e1', fullName: 'Ana Puig', updatedAt: '2026-10-01T00:00:00.000Z' },
  memberships: [
    { id: 'm1', employeeId: 'e1', houseId: 'pf', houseSlug: 'paulo-freire', houseName: 'Paulo Freire', startsOn: '2026-01-01', endsOn: '2026-06-30' },
    { id: 'm2', employeeId: 'e1', houseId: 'ca', houseSlug: 'carme-aymerich', houseName: 'Carme Aymerich', startsOn: '2026-07-01', endsOn: null },
  ],
  assignments: [
    { id: 'a2', employeeId: 'e1', positionId: 'p2', houseId: 'ca', startsOn: '2026-07-01', endsOn: null, positionLabel: 'ER A', roleCode: 'ER', houseSlug: 'carme-aymerich', houseName: 'Carme Aymerich' },
  ],
};

describe('employeeActionState', () => {
  it('finds the ongoing membership and open assignment of the page House only', () => {
    expect(employeeActionState(history, 'ca')).toMatchObject({ ongoingHere: { id: 'm2' }, openAssignmentHere: { id: 'a2' }, hasOngoingMembership: true });
    expect(employeeActionState(history, 'pf')).toEqual({ ongoingHere: null, openAssignmentHere: null, hasOngoingMembership: true });
  });
});
```

```tsx
// src/components/team/employee-history.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmployeeHistory } from '@/lib/staffing-views';
import { EmployeeHistoryView } from './employee-history';

const history: EmployeeHistory = {
  employee: { id: 'e1', fullName: 'Ana Puig', updatedAt: '2026-10-01T00:00:00.000Z' },
  memberships: [
    { id: 'm1', employeeId: 'e1', houseId: 'pf', houseSlug: 'paulo-freire', houseName: 'Paulo Freire', startsOn: '2026-01-01', endsOn: '2026-06-30' },
    { id: 'm2', employeeId: 'e1', houseId: 'ca', houseSlug: 'carme-aymerich', houseName: 'Carme Aymerich', startsOn: '2026-11-01', endsOn: null },
  ],
  assignments: [
    { id: 'a1', employeeId: 'e1', positionId: 'p1', houseId: 'pf', startsOn: '2026-01-01', endsOn: '2026-06-30', positionLabel: 'ER 1', roleCode: 'ER', houseSlug: 'paulo-freire', houseName: 'Paulo Freire' },
  ],
};

describe('EmployeeHistoryView', () => {
  it('labels each period with its House and marks future ones neutrally', () => {
    render(<EmployeeHistoryView history={history} today="2026-10-08" />);
    const memberships = within(screen.getByRole('region', { name: 'Pertinença' })).getAllByRole('listitem');
    expect(memberships[0]).toHaveTextContent('Paulo Freire');
    expect(memberships[0]).toHaveTextContent('Del 1 de gener del 2026 al 30 de juny del 2026');
    expect(memberships[1]).toHaveTextContent('Futur');
    expect(memberships[1].innerHTML).not.toMatch(/accent/);
    const positions = within(screen.getByRole('region', { name: 'Llocs' })).getAllByRole('listitem');
    expect(positions[0]).toHaveTextContent('ER 1 · Educadora referent');
    expect(positions[0]).toHaveTextContent('Paulo Freire');
  });

  it('says when there is no position history', () => {
    render(<EmployeeHistoryView history={{ ...history, assignments: [] }} today="2026-10-08" />);
    expect(screen.getByText('Encara no ha ocupat cap lloc.')).toBeInTheDocument();
  });
});
```

```tsx
// src/components/forms/employee-forms.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { EditNameForm } from './edit-name-form';
import { EndAssignmentForm } from './end-assignment-form';

const E1 = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const A1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('EditNameForm', () => {
  it('sends the loaded version with the new name', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<EditNameForm action={action} employeeId={E1} fullName="Ana Puig" updatedAt="2026-10-01T10:00:00.000Z" />);
    const input = screen.getByLabelText('Nom complet');
    await userEvent.clear(input);
    await userEvent.type(input, 'Anna Puig');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ employeeId: E1, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' }));
  });
});

describe('EndAssignmentForm', () => {
  it('defaults the end to today and names the position', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<EndAssignmentForm action={action} assignment={{ id: A1, positionLabel: 'ER 1', startsOn: '2026-01-01' }} today="2026-10-08" />);
    expect(screen.getByText(/ER 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finalitza el lloc' }));
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ assignmentId: A1, endsOn: '2026-10-08' }));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/employee-actions.test.ts src/components/team/employee-history.test.tsx src/components/forms/employee-forms.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/employee-actions.ts
import type { EmployeeHistory, HistoryAssignment, HistoryMembership } from './staffing-views';

/** Which actions the history page offers in the page's House. */
export function employeeActionState(history: EmployeeHistory, houseId: string) {
  const ongoingHere: HistoryMembership | null = history.memberships.find((m) => m.houseId === houseId && m.endsOn === null) ?? null;
  const openAssignmentHere: HistoryAssignment | null = history.assignments.find((a) => a.houseId === houseId && a.endsOn === null) ?? null;
  return { ongoingHere, openAssignmentHere, hasOngoingMembership: history.memberships.some((m) => m.endsOn === null) };
}
```

```tsx
// src/components/team/employee-history.tsx
import { FutureTag } from '@/components/future-tag';
import { formatPeriodCa, type IsoDate } from '@/lib/dates';
import { findRole } from '@/lib/roles';
import type { EmployeeHistory } from '@/lib/staffing-views';

/** Every membership and assignment, in both Houses, including future periods (FR-005). */
export function EmployeeHistoryView({ history, today }: Readonly<{ history: EmployeeHistory; today: IsoDate }>) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="memberships-title" className="rounded-2xl bg-card p-5 shadow-clay">
        <h2 id="memberships-title" className="text-xl">
          Pertinença
        </h2>
        <ul className="mt-2 divide-y divide-border">
          {history.memberships.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-medium text-foreground">{m.houseName}</span>
              <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
                {m.startsOn > today && <FutureTag />}
                {formatPeriodCa(m)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="positions-title" className="rounded-2xl bg-card p-5 shadow-clay">
        <h2 id="positions-title" className="text-xl">
          Llocs
        </h2>
        {history.assignments.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">Encara no ha ocupat cap lloc.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {history.assignments.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-3">
                <span className="font-medium text-foreground">
                  {a.positionLabel} · {findRole(a.roleCode)?.label ?? a.roleCode}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm tabular-nums text-muted-foreground">
                  {a.startsOn > today && <FutureTag />}
                  {a.houseName} · {formatPeriodCa(a)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

```tsx
// src/components/forms/edit-name-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import { editNameSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof editNameSchema;

/** Name correction: same employee ID, no period changes; stale if someone renamed meanwhile. */
export function EditNameForm({
  action,
  employeeId,
  fullName,
  updatedAt,
}: Readonly<{ action: StaffingAction; employeeId: string; fullName: string; updatedAt: string }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(editNameSchema),
    defaultValues: { operationId, employeeId, fullName, expectedUpdatedAt: updatedAt },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field id="fullName" label="Nom complet" error={errors.fullName?.message}>
        <Input autoComplete="off" {...describedBy('fullName', errors.fullName?.message)} {...register('fullName')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Desa el nom</SubmitButton>
      </div>
    </form>
  );
}
```

```tsx
// src/components/forms/end-assignment-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import { formatDateCa, type IsoDate } from '@/lib/dates';
import { endAssignmentSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof endAssignmentSchema;

export function EndAssignmentForm({
  action,
  assignment,
  today,
}: Readonly<{ action: StaffingAction; assignment: { id: string; positionLabel: string; startsOn: IsoDate }; today: IsoDate }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(endAssignmentSchema),
    defaultValues: { operationId, assignmentId: assignment.id, endsOn: today },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] tabular-nums text-foreground">
        Lloc <span className="font-semibold">{assignment.positionLabel}</span>, des del {formatDateCa(assignment.startsOn)}.
      </p>
      <Field id="endsOn" label="Últim dia al lloc" error={errors.endsOn?.message}>
        <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Finalitza el lloc</SubmitButton>
      </div>
    </form>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { DoneNote } from '@/components/forms/done-note';
import { HousePageHeader } from '@/components/house-page-header';
import { EmployeeHistoryView } from '@/components/team/employee-history';
import { Button } from '@/components/ui/button';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { employeeActionState } from '@/lib/employee-actions';
import { employeeContext } from '../page-context';

export const metadata: Metadata = {
  title: "Historial · Casa d'Infants",
};

export default async function EmployeePage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string; employeeId: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { done, repeat } = parseDone(await searchParams);
  const { ongoingHere, openAssignmentHere, hasOngoingMembership } = employeeActionState(history, house.id);
  const base = `/${slug}/team/${history.employee.id}`;
  const actions = [
    { href: `${base}/edit-name`, label: 'Editar nom', show: true },
    { href: `${base}/assign`, label: openAssignmentHere ? 'Canviar de lloc' : 'Assignar lloc', show: ongoingHere !== null },
    { href: `${base}/assignment/end`, label: 'Finalitzar lloc', show: openAssignmentHere !== null },
    { href: `${base}/membership/end`, label: 'Finalitzar pertinença', show: ongoingHere !== null },
    { href: `${base}/transfer`, label: 'Traslladar', show: ongoingHere !== null },
    { href: `${base}/membership/new`, label: 'Afegir període', show: !hasOngoingMembership },
  ].filter((action) => action.show);

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team`}>Equip</BackLink>
      <HousePageHeader houseName={house.name} title={history.employee.fullName} />
      {done && <DoneNote done={done} repeat={repeat} />}
      <nav aria-label="Accions" className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.href} asChild variant="outline">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </nav>
      <EmployeeHistoryView history={history} today={today} />
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/edit-name/page.tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { EditNameForm } from '@/components/forms/edit-name-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { editNameAction } from '../../actions';
import { employeeContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Editar nom · Casa d'Infants",
};

export default async function EditNamePage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, history } = await employeeContext(params);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Editar nom" />
      <FormCard>
        <EditNameForm
          action={editNameAction.bind(null, slug)}
          employeeId={history.employee.id}
          fullName={history.employee.fullName}
          updatedAt={history.employee.updatedAt}
        />
      </FormCard>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/assignment/end/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { EndAssignmentForm } from '@/components/forms/end-assignment-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { endAssignmentAction } from '../../../actions';
import { employeeContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Finalitzar lloc · Casa d'Infants",
};

export default async function EndAssignmentPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { openAssignmentHere } = employeeActionState(history, house.id);
  if (!openAssignmentHere) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Finalitzar lloc" />
      <FormCard>
        <EndAssignmentForm action={endAssignmentAction.bind(null, slug)} assignment={openAssignmentHere} today={today} />
      </FormCard>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/membership/new/page.tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { AddMembershipForm } from '@/components/forms/add-membership-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { loadPositionRows } from '@/server/staffing';
import { addMembershipAction } from '../../../actions';
import { employeeContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Afegir període · Casa d'Infants",
};

export default async function NewMembershipPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const positions = await loadPositionRows(house.id, today);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Afegir període" />
      <FormCard>
        <AddMembershipForm
          action={addMembershipAction.bind(null, slug)}
          houseName={house.name}
          today={today}
          positions={positions}
          employee={{ id: history.employee.id, fullName: history.employee.fullName }}
        />
      </FormCard>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/employee-actions.ts src/lib/employee-actions.test.ts src/components/team/employee-history.tsx src/components/team/employee-history.test.tsx src/components/forms/edit-name-form.tsx src/components/forms/end-assignment-form.tsx src/components/forms/employee-forms.test.tsx "src/app/(app)/[house]/team/[employeeId]"
git commit -m "feat(team): add the employee history with name, position and period actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 22: Two-step forms: assign or change position, end membership, transfer

**Covers:** tasks.md 7.5 (handover, end membership, transfer)

**Files:**
- Create: `src/components/forms/handover-form.tsx`, `src/components/forms/end-membership-form.tsx`, `src/components/forms/transfer-form.tsx`, `src/components/forms/two-step-forms.test.tsx`
- Create: `src/app/(app)/[house]/team/[employeeId]/assign/page.tsx`, `.../[employeeId]/membership/end/page.tsx`, `.../[employeeId]/transfer/page.tsx`

**Interfaces:**
- Consumes: Task 18 kit (`useStaffingAction` preview state, `ConfirmPanel`); schemas `handoverSchema`, `endMembershipSchema`, `transferSchema`; `handoverAction`, `endMembershipAction`, `transferAction`; `PositionSelect`; `employeeContext`; `HOUSES`.
- Produces:
  - `HandoverForm({ action, from: 'employee' | 'position', fixed: { positionId: string } | { employeeId: string }, positions?: PositionRow[], members?: MemberOption[], intro: string, today })` (Task 23 reuses it with `from: 'position'`)
  - `EndMembershipForm({ action, membership: { id: string; startsOn: IsoDate }, houseName, today })`
  - `TransferForm({ action, employeeId, fromHouseName, toHouse: { slug: HouseSlug; name: string }, destinationPositions, today })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/forms/two-step-forms.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { EndMembershipForm } from './end-membership-form';
import { HandoverForm } from './handover-form';
import { TransferForm } from './transfer-form';

const E1 = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const P1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const M1 = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';
const TOKEN = 'a'.repeat(64);

function twoStepAction() {
  return vi.fn(async (_state: ActionState, input: unknown): Promise<ActionState> =>
    (input as { intent: string }).intent === 'preview'
      ? { status: 'preview', lines: ['Marta Soler: lloc ER 1 a Paulo Freire acaba el 30 de juny del 2026.'], planToken: TOKEN }
      : { status: 'error', message: 'Les dades han canviat mentrestant. Torna a carregar la pàgina.' },
  );
}

describe('HandoverForm', () => {
  it('previews, then confirms with the plan token', async () => {
    const action = twoStepAction();
    render(
      <HandoverForm
        action={action}
        from="position"
        fixed={{ positionId: P1 }}
        members={[{ employeeId: E1, fullName: 'Ana Puig' }]}
        intro="Lloc ER 1"
        today="2026-07-01"
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Persona que entra'), E1);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    expect(await screen.findByText(/Marta Soler: lloc ER 1/)).toBeInTheDocument();
    expect(action).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ intent: 'preview', positionId: P1, employeeId: E1, from: 'position' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Les dades han canviat');
    expect(action).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ intent: 'confirm', planToken: TOKEN }));
  });

  it('cancels without writing', async () => {
    const action = twoStepAction();
    render(<HandoverForm action={action} from="position" fixed={{ positionId: P1 }} members={[{ employeeId: E1, fullName: 'Ana Puig' }]} intro="Lloc ER 1" today="2026-07-01" />);
    await userEvent.selectOptions(screen.getByLabelText('Persona que entra'), E1);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel·la' }));
    expect(screen.queryByRole('button', { name: 'Confirma' })).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Persona que entra')).toBeEnabled();
  });
});

describe('EndMembershipForm', () => {
  it('previews the closures first', async () => {
    const action = twoStepAction();
    render(<EndMembershipForm action={action} membership={{ id: M1, startsOn: '2025-09-01' }} houseName="Paulo Freire" today="2026-08-31" />);
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    expect(action).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ intent: 'preview', membershipId: M1, endsOn: '2026-08-31' }));
    expect(await screen.findByRole('button', { name: 'Confirma' })).toBeInTheDocument();
  });
});

describe('TransferForm', () => {
  it('names both Houses and sends the destination by slug', async () => {
    const action = twoStepAction();
    render(
      <TransferForm
        action={action}
        employeeId={E1}
        fromHouseName="Paulo Freire"
        toHouse={{ slug: 'carme-aymerich', name: 'Carme Aymerich' }}
        destinationPositions={[]}
        today="2026-05-10"
      />,
    );
    expect(screen.getByText(/De Paulo Freire a Carme Aymerich/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Primer dia a Carme Aymerich'), { target: { value: '2026-07-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Revisa els canvis' }));
    expect(action).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ intent: 'preview', employeeId: E1, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: null }),
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/forms/two-step-forms.test.tsx`
Expected: FAIL (forms missing).

- [ ] **Step 3: Implement**

```tsx
// src/components/forms/handover-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import { handoverSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { MemberOption, PositionRow } from '@/lib/staffing-views';
import { ConfirmPanel } from './confirm-panel';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { PositionSelect } from './position-select';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof handoverSchema;

/**
 * Assign a vacant position, replace its occupant or move someone (FR-004).
 * From an employee page the position is chosen; from a position page the
 * incoming person is. Step one previews the D-1 / D boundary; step two confirms.
 */
export function HandoverForm({
  action,
  from,
  fixed,
  positions = [],
  members = [],
  intro,
  today,
}: Readonly<{
  action: StaffingAction;
  from: 'employee' | 'position';
  fixed: { positionId: string } | { employeeId: string };
  positions?: readonly PositionRow[];
  members?: readonly MemberOption[];
  intro: string;
  today: IsoDate;
}>) {
  const operationId = useOperationId();
  const { state, pending, run, preview, cancelPreview } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(handoverSchema),
    defaultValues: {
      operationId,
      positionId: 'positionId' in fixed ? fixed.positionId : '',
      employeeId: 'employeeId' in fixed ? fixed.employeeId : '',
      startsOn: today,
      endsOn: '',
      from,
    },
  });
  const confirm = handleSubmit((values) => run({ ...values, intent: 'confirm', planToken: preview?.planToken }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => run({ ...values, intent: 'preview' }))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] text-foreground">{intro}</p>
      <fieldset disabled={preview !== null || pending} className="flex flex-col gap-4">
        {from === 'employee' ? (
          <Field id="positionId" label="Lloc" error={errors.positionId ? 'Tria un lloc.' : undefined}>
            <PositionSelect positions={positions} emptyLabel="Tria un lloc" {...describedBy('positionId', errors.positionId?.message)} {...register('positionId')} />
          </Field>
        ) : (
          <Field id="employeeId" label="Persona que entra" error={errors.employeeId ? 'Tria una persona.' : undefined}>
            <NativeSelect {...describedBy('employeeId', errors.employeeId?.message)} {...register('employeeId')}>
              <option value="">Tria una persona</option>
              {members.map((member) => (
                <option key={member.employeeId} value={member.employeeId}>
                  {member.fullName}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="startsOn" label="Primer dia al lloc" error={errors.startsOn?.message}>
            <Input type="date" className="tabular-nums" {...describedBy('startsOn', errors.startsOn?.message)} {...register('startsOn')} />
          </Field>
          <Field id="endsOn" label="Últim dia (opcional)" error={errors.endsOn?.message} hint="Deixa-ho buit si no té data de final.">
            <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
          </Field>
        </div>
      </fieldset>
      {preview ? (
        <ConfirmPanel lines={preview.lines} pending={pending} onConfirm={() => void confirm()} onCancel={cancelPreview} />
      ) : (
        <div>
          <SubmitButton pending={pending}>Revisa els canvis</SubmitButton>
        </div>
      )}
    </form>
  );
}
```

```tsx
// src/components/forms/end-membership-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import { formatDateCa, type IsoDate } from '@/lib/dates';
import { endMembershipSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { ConfirmPanel } from './confirm-panel';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof endMembershipSchema;

/** Ends a membership; the preview lists the positions that close with it (FR-003, AC-016). Not erasure. */
export function EndMembershipForm({
  action,
  membership,
  houseName,
  today,
}: Readonly<{ action: StaffingAction; membership: { id: string; startsOn: IsoDate }; houseName: string; today: IsoDate }>) {
  const operationId = useOperationId();
  const { state, pending, run, preview, cancelPreview } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(endMembershipSchema),
    defaultValues: { operationId, membershipId: membership.id, endsOn: today },
  });
  const confirm = handleSubmit((values) => run({ ...values, intent: 'confirm', planToken: preview?.planToken }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => run({ ...values, intent: 'preview' }))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] tabular-nums text-foreground">
        Pertinença a {houseName} des del {formatDateCa(membership.startsOn)}.
      </p>
      <fieldset disabled={preview !== null || pending} className="flex flex-col gap-4">
        <Field id="endsOn" label={`Últim dia a ${houseName}`} error={errors.endsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
        </Field>
      </fieldset>
      {preview ? (
        <ConfirmPanel lines={preview.lines} pending={pending} onConfirm={() => void confirm()} onCancel={cancelPreview} />
      ) : (
        <div>
          <SubmitButton pending={pending}>Revisa els canvis</SubmitButton>
        </div>
      )}
    </form>
  );
}
```

```tsx
// src/components/forms/transfer-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { transferSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { PositionRow } from '@/lib/staffing-views';
import { ConfirmPanel } from './confirm-panel';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { PositionSelect } from './position-select';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof transferSchema;

/** House transfer with an optional destination position (FR-006). Lists change only from the effective date. */
export function TransferForm({
  action,
  employeeId,
  fromHouseName,
  toHouse,
  destinationPositions,
  today,
}: Readonly<{
  action: StaffingAction;
  employeeId: string;
  fromHouseName: string;
  toHouse: { slug: HouseSlug; name: string };
  destinationPositions: readonly PositionRow[];
  today: IsoDate;
}>) {
  const operationId = useOperationId();
  const { state, pending, run, preview, cancelPreview } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { operationId, employeeId, toHouseSlug: toHouse.slug, startsOn: today, destinationPositionId: '' },
  });
  const confirm = handleSubmit((values) => run({ ...values, intent: 'confirm', planToken: preview?.planToken }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => run({ ...values, intent: 'preview' }))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] font-medium text-foreground">
        De {fromHouseName} a {toHouse.name}
      </p>
      <fieldset disabled={preview !== null || pending} className="flex flex-col gap-4">
        <Field
          id="startsOn"
          label={`Primer dia a ${toHouse.name}`}
          error={errors.startsOn?.message}
          hint={`L'últim dia a ${fromHouseName} serà el dia anterior.`}
        >
          <Input type="date" className="tabular-nums" {...describedBy('startsOn', errors.startsOn?.message)} {...register('startsOn')} />
        </Field>
        <Field id="destinationPositionId" label={`Lloc a ${toHouse.name} (opcional)`} error={errors.destinationPositionId?.message}>
          <PositionSelect
            positions={destinationPositions}
            {...describedBy('destinationPositionId', errors.destinationPositionId?.message)}
            {...register('destinationPositionId')}
          />
        </Field>
      </fieldset>
      {preview ? (
        <ConfirmPanel lines={preview.lines} pending={pending} onConfirm={() => void confirm()} onCancel={cancelPreview} />
      ) : (
        <div>
          <SubmitButton pending={pending}>Revisa els canvis</SubmitButton>
        </div>
      )}
    </form>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/assign/page.tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { FormCard } from '@/components/forms/form-card';
import { HandoverForm } from '@/components/forms/handover-form';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { loadPositionRows } from '@/server/staffing';
import { handoverAction } from '../../actions';
import { employeeContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Assignar lloc · Casa d'Infants",
};

export default async function AssignPositionPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { openAssignmentHere } = employeeActionState(history, house.id);
  const positions = await loadPositionRows(house.id, today);
  const title = openAssignmentHere ? 'Canviar de lloc' : 'Assignar lloc';
  const intro = openAssignmentHere
    ? `${history.employee.fullName} ocupa ara ${openAssignmentHere.positionLabel}. El lloc actual acaba el dia abans del nou.`
    : `${history.employee.fullName} no té cap lloc ara a ${house.name}.`;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title={title} />
      <FormCard>
        <HandoverForm
          action={handoverAction.bind(null, slug)}
          from="employee"
          fixed={{ employeeId: history.employee.id }}
          positions={positions}
          intro={intro}
          today={today}
        />
      </FormCard>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/membership/end/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { EndMembershipForm } from '@/components/forms/end-membership-form';
import { FormCard } from '@/components/forms/form-card';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { endMembershipAction } from '../../../actions';
import { employeeContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Finalitzar pertinença · Casa d'Infants",
};

export default async function EndMembershipPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { ongoingHere } = employeeActionState(history, house.id);
  if (!ongoingHere) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title="Finalitzar pertinença" />
      <FormCard>
        <EndMembershipForm action={endMembershipAction.bind(null, slug)} membership={ongoingHere} houseName={house.name} today={today} />
      </FormCard>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/[employeeId]/transfer/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { FormCard } from '@/components/forms/form-card';
import { TransferForm } from '@/components/forms/transfer-form';
import { HousePageHeader } from '@/components/house-page-header';
import { employeeActionState } from '@/lib/employee-actions';
import { HOUSES } from '@/lib/houses';
import { getHouseBySlug } from '@/server/houses';
import { loadPositionRows } from '@/server/staffing';
import { transferAction } from '../../actions';
import { employeeContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Traslladar · Casa d'Infants",
};

export default async function TransferPage({ params }: Readonly<{ params: Promise<{ house: string; employeeId: string }> }>) {
  const { slug, house, today, history } = await employeeContext(params);
  const { ongoingHere } = employeeActionState(history, house.id);
  if (!ongoingHere) notFound();
  const other = HOUSES.find((h) => h.slug !== slug);
  const destination = other ? await getHouseBySlug(other.slug) : null;
  if (!other || !destination) notFound();
  const destinationPositions = await loadPositionRows(destination.id, today);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/${history.employee.id}`}>{history.employee.fullName}</BackLink>
      <HousePageHeader houseName={house.name} title={`Traslladar ${history.employee.fullName}`} />
      <FormCard>
        <TransferForm
          action={transferAction.bind(null, slug)}
          employeeId={history.employee.id}
          fromHouseName={house.name}
          toHouse={{ slug: other.slug, name: other.name }}
          destinationPositions={destinationPositions}
          today={today}
        />
      </FormCard>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/handover-form.tsx src/components/forms/end-membership-form.tsx src/components/forms/transfer-form.tsx src/components/forms/two-step-forms.test.tsx "src/app/(app)/[house]/team/[employeeId]"
git commit -m "feat(team): add confirmed position changes, membership endings and transfers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 23: Positions pages

**Covers:** tasks.md 7.6

**Files:**
- Create: `src/components/forms/position-forms.tsx` (`CreatePositionForm`, `RelabelPositionForm`), `src/components/forms/position-forms.test.tsx`
- Create: `src/components/team/position-history.tsx`, `src/components/team/position-history.test.tsx`
- Create: `src/app/(app)/[house]/team/positions/page.tsx`, `.../positions/[positionId]/page.tsx`, `.../positions/[positionId]/assign/page.tsx`

**Interfaces:**
- Consumes: `PositionsList` (Task 19), `HandoverForm` (Task 22), `positionContext`, `houseContext`, `loadPositionRows`, `loadMemberOptions`, `createPositionAction`, `relabelPositionAction`, `handoverAction`, `ROLES`, `findRole`.
- Produces: `CreatePositionForm({ action })`, `RelabelPositionForm({ action, positionId, label })`, `PositionHistory({ houseSlug, rows, today })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/forms/position-forms.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/lib/action-state';
import { CreatePositionForm, RelabelPositionForm } from './position-forms';

const P1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('CreatePositionForm', () => {
  it('offers the nine roles and requires a label', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'error', message: 'Ja hi ha un lloc amb aquest nom en aquesta casa.' }));
    render(<CreatePositionForm action={action} />);
    expect(screen.getAllByRole('option')).toHaveLength(9);
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    expect(await screen.findByText('Escriu un nom per al lloc.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'CT');
    await userEvent.type(screen.getByLabelText('Nom del lloc'), 'CT nit');
    await userEvent.click(screen.getByRole('button', { name: 'Crea el lloc' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ja hi ha un lloc amb aquest nom');
    expect(action).toHaveBeenCalledWith({ status: 'idle' }, expect.objectContaining({ roleCode: 'CT', label: 'CT nit' }));
  });
});

describe('RelabelPositionForm', () => {
  it('only edits the label', async () => {
    const action = vi.fn(async (): Promise<ActionState> => ({ status: 'idle' }));
    render(<RelabelPositionForm action={action} positionId={P1} label="ER 1" />);
    await userEvent.clear(screen.getByLabelText('Nom del lloc'));
    await userEvent.type(screen.getByLabelText('Nom del lloc'), 'ER matins');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    const [, input] = action.mock.calls[0] as unknown as [ActionState, Record<string, unknown>];
    expect(Object.keys(input).sort()).toEqual(['label', 'operationId', 'positionId']);
  });
});
```

```tsx
// src/components/team/position-history.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PositionHistory } from './position-history';

describe('PositionHistory', () => {
  it('lists successive occupants of one position in date order (AC-004)', () => {
    render(
      <PositionHistory
        houseSlug="paulo-freire"
        today="2026-10-08"
        rows={[
          { id: 'a1', employeeId: 'e1', positionId: 'p1', houseId: 'pf', startsOn: '2025-09-01', endsOn: '2026-06-30', fullName: 'Marta Soler' },
          { id: 'a2', employeeId: 'e2', positionId: 'p1', houseId: 'pf', startsOn: '2026-07-01', endsOn: null, fullName: 'Ana Puig' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Marta Soler');
    expect(items[1]).toHaveTextContent('Des del 1 de juliol del 2026');
  });

  it('has an empty state', () => {
    render(<PositionHistory houseSlug="paulo-freire" today="2026-10-08" rows={[]} />);
    expect(screen.getByText('Aquest lloc encara no ha tingut cap ocupant.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/forms/position-forms.test.tsx src/components/team/position-history.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```tsx
// src/components/forms/position-forms.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { StaffingAction } from '@/lib/action-state';
import { ROLES } from '@/lib/roles';
import { createPositionSchema, relabelPositionSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

/** A new position in this House: role and a House-unique label. House and role never change afterwards (FR-001). */
export function CreatePositionForm({ action }: Readonly<{ action: StaffingAction }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<typeof createPositionSchema>, unknown, FormOutput<typeof createPositionSchema>>({
    resolver: zodResolver(createPositionSchema),
    defaultValues: { operationId, roleCode: 'ER', label: '' },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="roleCode" label="Rol" error={errors.roleCode?.message}>
          <NativeSelect {...describedBy('roleCode', errors.roleCode?.message)} {...register('roleCode')}>
            {ROLES.map((role) => (
              <option key={role.code} value={role.code}>
                {role.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="label" label="Nom del lloc" error={errors.label?.message} hint="Per exemple: ER 2, CT nit.">
          <Input autoComplete="off" {...describedBy('label', errors.label?.message)} {...register('label')} />
        </Field>
      </div>
      <div>
        <SubmitButton pending={pending}>Crea el lloc</SubmitButton>
      </div>
    </form>
  );
}

export function RelabelPositionForm({ action, positionId, label }: Readonly<{ action: StaffingAction; positionId: string; label: string }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<typeof relabelPositionSchema>, unknown, FormOutput<typeof relabelPositionSchema>>({
    resolver: zodResolver(relabelPositionSchema),
    defaultValues: { operationId, positionId, label },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field id="label" label="Nom del lloc" error={errors.label?.message}>
        <Input autoComplete="off" {...describedBy('label', errors.label?.message)} {...register('label')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Desa el nom</SubmitButton>
      </div>
    </form>
  );
}
```

```tsx
// src/components/team/position-history.tsx
import Link from 'next/link';
import { FutureTag } from '@/components/future-tag';
import { formatPeriodCa, type IsoDate } from '@/lib/dates';
import type { PositionDetail } from '@/lib/staffing-views';

/** Successive occupants of one stable position (AC-004). */
export function PositionHistory({
  houseSlug,
  rows,
  today,
}: Readonly<{ houseSlug: string; rows: PositionDetail['history']; today: IsoDate }>) {
  if (rows.length === 0) return <p className="text-[0.9375rem] text-muted-foreground">Aquest lloc encara no ha tingut cap ocupant.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <Link href={`/${houseSlug}/team/${row.employeeId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            {row.fullName}
          </Link>
          <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
            {row.startsOn > today && <FutureTag />}
            {formatPeriodCa(row)}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// src/app/(app)/[house]/team/positions/page.tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { DoneNote } from '@/components/forms/done-note';
import { FormCard } from '@/components/forms/form-card';
import { CreatePositionForm } from '@/components/forms/position-forms';
import { HousePageHeader } from '@/components/house-page-header';
import { PositionsList } from '@/components/team/positions-list';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { loadPositionRows } from '@/server/staffing';
import { createPositionAction } from '../actions';
import { houseContext } from '../page-context';

export const metadata: Metadata = {
  title: "Llocs de treball · Casa d'Infants",
};

export default async function PositionsPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today } = await houseContext(params);
  const { done, repeat } = parseDone(await searchParams);
  const rows = await loadPositionRows(house.id, today);
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team`}>Equip</BackLink>
      <HousePageHeader houseName={house.name} title="Llocs de treball" />
      {done && <DoneNote done={done} repeat={repeat} />}
      <PositionsList houseSlug={slug} houseName={house.name} rows={rows} />
      <FormCard title="Nou lloc">
        <CreatePositionForm action={createPositionAction.bind(null, slug)} />
      </FormCard>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/positions/[positionId]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { DoneNote } from '@/components/forms/done-note';
import { FormCard } from '@/components/forms/form-card';
import { RelabelPositionForm } from '@/components/forms/position-forms';
import { HousePageHeader } from '@/components/house-page-header';
import { PositionHistory } from '@/components/team/position-history';
import { Button } from '@/components/ui/button';
import { parseDone, type SearchParams } from '@/lib/action-state';
import { isActiveOn } from '@/lib/house-membership';
import { findRole } from '@/lib/roles';
import { relabelPositionAction } from '../../actions';
import { positionContext } from '../../page-context';

export const metadata: Metadata = {
  title: "Lloc de treball · Casa d'Infants",
};

export default async function PositionPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ house: string; positionId: string }>; searchParams: Promise<SearchParams> }>) {
  const { slug, house, today, detail } = await positionContext(params);
  const { done, repeat } = parseDone(await searchParams);
  const occupied = detail.history.some((row) => isActiveOn(row, today));
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/positions`}>Llocs de treball</BackLink>
      <HousePageHeader houseName={house.name} title={detail.position.label} />
      <p className="-mt-4 text-[0.9375rem] text-muted-foreground">{findRole(detail.position.roleCode)?.label}</p>
      {done && <DoneNote done={done} repeat={repeat} />}
      <div>
        <Button asChild>
          <Link href={`/${slug}/team/positions/${detail.position.id}/assign`}>{occupied ? 'Substitueix' : 'Assigna ocupant'}</Link>
        </Button>
      </div>
      <FormCard title="Ocupants">
        <PositionHistory houseSlug={slug} rows={detail.history} today={today} />
      </FormCard>
      <FormCard title="Nom del lloc">
        <RelabelPositionForm action={relabelPositionAction.bind(null, slug)} positionId={detail.position.id} label={detail.position.label} />
      </FormCard>
    </main>
  );
}
```

```tsx
// src/app/(app)/[house]/team/positions/[positionId]/assign/page.tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { FormCard } from '@/components/forms/form-card';
import { HandoverForm } from '@/components/forms/handover-form';
import { HousePageHeader } from '@/components/house-page-header';
import { isActiveOn } from '@/lib/house-membership';
import { loadMemberOptions } from '@/server/staffing';
import { handoverAction } from '../../../actions';
import { positionContext } from '../../../page-context';

export const metadata: Metadata = {
  title: "Assigna ocupant · Casa d'Infants",
};

export default async function AssignOccupantPage({ params }: Readonly<{ params: Promise<{ house: string; positionId: string }> }>) {
  const { slug, house, today, detail } = await positionContext(params);
  const members = await loadMemberOptions(house.id, today);
  const current = detail.history.find((row) => isActiveOn(row, today));
  const intro = current
    ? `Ara ocupa ${detail.position.label}: ${current.fullName}. Deixarà el lloc el dia abans que entri la persona nova.`
    : `${detail.position.label} està vacant.`;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <BackLink href={`/${slug}/team/positions/${detail.position.id}`}>{detail.position.label}</BackLink>
      <HousePageHeader houseName={house.name} title={current ? 'Substitueix' : 'Assigna ocupant'} />
      <FormCard>
        <HandoverForm
          action={handoverAction.bind(null, slug)}
          from="position"
          fixed={{ positionId: detail.position.id }}
          members={members}
          intro={intro}
          today={today}
        />
      </FormCard>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/position-forms.tsx src/components/forms/position-forms.test.tsx src/components/team/position-history.tsx src/components/team/position-history.test.tsx "src/app/(app)/[house]/team/positions"
git commit -m "feat(team): add the positions list, position history, relabel and replacement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 24: Documentation

**Covers:** tasks.md 8.3

**Files:**
- Modify: `README.md`, `AGENTS.md`, `.env.example` (comment only), `DESIGN.md` (Decisions Log row)

**Interfaces:** none (docs only).

- [ ] **Step 1: Check the working tree first**

Run: `git status --short README.md openspec/specs`
If the main checkout had uncommitted edits by the user to `README.md` or `openspec/specs/*` (it did when this plan was written), they are not in this worktree. Ask the controller whether those edits were committed to `main` and rebased in; never recreate or overwrite them from memory.

- [ ] **Step 2: Update `README.md`**

Add, in this order, under the existing setup and SDD sections (keep the rest of the file):

```markdown
### Database tests

`npm run test:db` runs the real-database suite (`src/**/*.db.test.ts`) on a throwaway
local Postgres: it runs `initdb` in a temp directory, starts the server on a free
localhost port (TCP only), applies `prisma migrate deploy`, runs the tests and deletes
everything. It never touches Supabase.

Prerequisite: Postgres server binaries, 14 or newer (`brew install postgresql@14`). The
harness uses the `initdb` and `pg_ctl` next to the `postgres` binary; set `PG_BIN` to
choose another directory. `npm test` does not run these tests; run both before a PR.

### Access: director grants

Access to the Houses depends only on an enabled director grant in the database
(`access_grants`). Clerk metadata is ignored. Grants are managed by the operator, never
in the app:

    npm run access -- grant <clerkUserId>     # verifies the user in the Clerk instance of CLERK_SECRET_KEY
    npm run access -- revoke <clerkUserId>
    npm run access -- list

Each command prints the target Clerk instance (development or production) and the
database host, and asks for `yes` (or pass `--yes`). Changes apply on the user's next
request. **Lost director access:** run `grant` again for their Clerk user ID (Clerk
dashboard → Users → user ID, `user_...`).

Optional employee ↔ Clerk account links (they grant nothing):

    npm run account-link -- link <employeeId> <clerkUserId>
    npm run account-link -- unlink <employeeId>

### First deploy to an environment (and production cutover)

1. `npx prisma migrate deploy` with that environment's `DIRECT_URL`.
2. `npm run access -- grant <director's Clerk user ID>` with that environment's keys.
   In production only the director gets a grant; never copy the developer's dev grant.
3. Verify: the director can open `/paulo-freire/team`; a signed-in user without a grant
   lands on "Sense accés".
4. The dev seed (`npx prisma db seed`) is for development only (fictional inventory).

To refresh the dev database with the fictional inventory: `npx prisma migrate reset --force`,
then `npx prisma db seed`, then re-grant yourself (the reset deletes grants).
```

Also update the status note at the top of `README.md` to say SPEC-002 is implemented (roles, positions, dated assignments, staffing management, director grants), and the Routes paragraph to list `/<house>/team` (views and date), `/<house>/team/new`, `/<house>/team/<employeeId>` (history and actions) and `/<house>/team/positions`.

- [ ] **Step 3: Update `AGENTS.md`**

- Intro: the House context and staffing (SPEC-002: roles, positions, assignments, people and membership management, director grants) are in place; APs, calendar, vacations and absences are not built yet.
- Stack, Prisma line: models `House`, `Employee`, `HouseMembership`, `OccupationalRole`, `Position`, `PositionAssignment`, `AccessGrant`, `EmployeeAccountLink`, `OperationReceipt`.
- Stack, Clerk line: replace "`requireDirector()` ... roles arrive with SPEC-002" with "`src/lib/auth.ts` exposes `requireUser()` and `requireDirector()`, which requires an enabled director grant in `access_grants` (managed with `npm run access`)."
- Layout: add `src/lib/staffing.ts` (pure staffing rules and plans), `src/lib/staffing-schemas.ts` (one zod schema per form, shared with the server), `src/lib/staffing-messages.ts` (Catalan copy), `src/server/staffing-store.ts` (writes through `runOperation` in `src/server/operation.ts`: receipt, lock, plan, write), `src/server/staffing-queries.ts` (reads), `src/server/staffing.ts` (director-gated reads for pages), `src/app/(app)/[house]/team/actions.ts` (Server Functions), `scripts/` (operator procedures), `test/db/` (real-database harness). Remove the `membership-store.ts` line.
- Access and data rules: replace the temporary-access bullet with "Access requires an enabled director grant (`access_grants`). Call `requireDirector()` in every page, data function and Server Function. Roles, positions, memberships and account links never grant access." Add: "Staffing invariants live in Postgres too (hand-written in the `staffing` migration): no overlapping assignments per employee or position, assignment House = position House, every assignment inside one membership (deferred trigger, SQLSTATE CI001), position House and role frozen (CI002). Never remove that SQL; prove it with `npm run test:db`." and "Every staffing write goes through `runOperation` with the form's operation ID; two-step writes (handover, transfer, end membership) must pass the preview's plan token."
- Commands: add `npm run test:db`, `npm run access`, `npm run account-link`.

- [ ] **Step 4: `DESIGN.md` and `.env.example`**

Add a Decisions Log row to `DESIGN.md`: `| 2026-10-08 | Native <select>, links for view switches, one page per staffing action, two-step confirmation panels | Mobile-native pickers and keyboard use; state in the URL; previews state the D-1 / D boundary before any write. |`

In `.env.example`, after the Clerk block, add the comment line: `# Access is granted per environment with \`npm run access -- grant <clerkUserId>\` (see README).`

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md DESIGN.md .env.example
git commit -m "docs: document staffing, director grants, operator scripts and database tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 25: Migrate the dev database and grant the developer (needs the user)

**Covers:** tasks.md 8.2

This task changes the shared dev Supabase database and needs the user's Clerk user ID. It runs on the developer's machine (needs `.env.local`), never in a cloud session. The controller (not a subagent) runs it, and only after the user says go. If Tasks 1 to 24 ran in the cloud, first pull the branch locally.

- [ ] **Step 1: Ask the user**, in one message:
  1. Apply the `staffing` migration to the dev DB with `npx prisma migrate deploy` (non-destructive; keeps the SPEC-001 seed people)? Or reset it with the fictional inventory: `npx prisma migrate reset --force` then `npx prisma db seed` (deletes all dev data, which is fictional)?
  2. Their Clerk user ID (`user_...`) for the dev grant, and the director's if they use dev.
  Prisma blocks `migrate reset` when run by an AI agent unless the user consents; if they choose the reset, they can run it themselves with `! npx prisma migrate reset --force` in the prompt.

- [ ] **Step 2: Apply what the user chose and grant access**

```bash
npx prisma migrate deploy        # or the reset + seed, as agreed
npm run access -- grant <user's Clerk user ID>   # shows "Clerk instance: development"; answer yes
npm run access -- list
```

Expected: the migration applies; `list` shows the grant as `enabled`.

- [ ] **Step 3: Prove a database rule on the real dev DB without leaving data behind**

```bash
cat <<'SQL' | npx prisma db execute --stdin
BEGIN;
INSERT INTO "position_assignments" ("employee_id", "position_id", "house_id", "starts_on")
SELECT a."employee_id", a."position_id", a."house_id", a."starts_on"
FROM "position_assignments" a LIMIT 1;
ROLLBACK;
SQL
```

Expected (with the seeded inventory): `conflicting key value violates exclusion constraint "position_assignments_employee_no_overlap"`. With no assignments yet, create one through the UI first (Task 26) and re-run. Record the output in `tasks.md` under 8.2.

- [ ] **Step 4: Tick 8.2 in `tasks.md` and commit**

```bash
git add openspec/changes/roles-and-position-assignments/tasks.md
git commit -m "chore(db): apply the staffing migration to the dev database and record the check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 26: Full verification and browser acceptance

**Covers:** tasks.md 8.4, 8.5

Runs on the developer's machine (Clerk sign-in, the dev database and the gstack browser). Step 1 can also run in a cloud session.

- [ ] **Step 1: Run every check**

```bash
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build
```

Expected: all pass. Paste the summary lines (test counts) into the verify notes.

- [ ] **Step 2: Start the production build**

Run: `npm run build && npm start` (background). Smoke checks run on the production build, not `npm run dev` (SPEC-001 retrospective: prefetch and caching only happen there).

- [ ] **Step 3: Browser acceptance with the gstack `/browse` skill**

Use `/setup-browser-cookies` to import the Clerk session from the user's browser if needed. At desktop (1280px) and mobile (390px) widths, record a screenshot of each step into `openspec/changes/roles-and-position-assignments/evidence/` (`NN-<step>-<width>.png`):

1. `/paulo-freire/team`: people with positions; switch to Llocs (grouped, no honey) and Membres anteriors.
2. Afegir persona: a new fictional person with a vacant position; then a validation error (blank name) with icon and kept values.
3. Editar nom on that person.
4. Position handover on `/paulo-freire/team/positions/<ER>`: Substitueix with a date in the future; check the confirmation lists "acaba el D-1" and "comença el D"; confirm.
5. Rejected operation: try to assign a second person to the same position on an overlapping date; see the Catalan conflict.
6. Future transfer of a person to Carme Aymerich with a destination position (AC-009); today's Paulo Freire list unchanged; the date control on the transfer date shows the change; the history shows both Houses.
7. Switch House from an employee page: lands on `/carme-aymerich/team`.
8. Denied access: `npm run access -- revoke <your ID> --yes`, reload → "Sense accés"; `npm run access -- grant <your ID> --yes`, reload → back in. (AC-019 on a real request.)
9. SPEC-001 behaviour still holds: `/dashboard` redirect to the last House, Catalan 404 at `/casa-inexistent/team` and at `/paulo-freire/team/abc`.

- [ ] **Step 4: Record results and commit the evidence**

Tick 8.4 and 8.5 in `tasks.md` and list any finding (with its screenshot) in the commit body. Fix findings through new commits before verify.

```bash
git add openspec/changes/roles-and-position-assignments/evidence openspec/changes/roles-and-position-assignments/tasks.md
git commit -m "test(acceptance): record browser acceptance of staffing workflows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
