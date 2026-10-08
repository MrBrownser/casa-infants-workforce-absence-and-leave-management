## Context

SPEC-001 (archived as `2026-10-05-house-context`) delivered two Houses, URL-scoped House context (`/[house]/...`), a minimal `Employee` (full name), dated `HouseMembership` protected by a Postgres exclusion constraint, a pure membership module (`src/lib/house-membership.ts`), a Prisma store without auth used by the seed (`src/server/membership-store.ts`), director-gated reads (`src/server/houses.ts`), a read-only Equip page and a temporary gate on Clerk `publicMetadata.role === 'director'`.

SPEC-002 (verbatim in `SPEC-002-roles-and-position-assignments.md`) asks for staffing management without database edits, with invariants that hold under concurrency and direct writes, and for explicit application grants. Review decisions D1-D4 were accepted as proposed (`brainstorm.md`), and the DB-first enforcement approach was chosen.

Constraints:
- Next.js 16: layouts and pages render in parallel, so every page, data function and Server Function checks access itself. `params` and `searchParams` are Promises. Server Functions use `useActionState`, `revalidatePath` and `redirect`.
- Prisma 7 with the `PrismaPg` adapter: it cannot express exclusion constraints, triggers or expression indexes. Hand-written SQL that Prisma would see as drift (expression indexes) must be avoided; CHECK, EXCLUDE and triggers are tolerated, as SPEC-001 showed.
- DESIGN.md (honey only for pending decisions, errors with icon and text, Fraunces at 20px and above only, `tabular-nums` for dates), Catalan UI, English code, GDPR minimisation.
- Local tooling: Homebrew Postgres 14 with `btree_gist`; Docker is not running; no CI.

Stakeholders: the director (only operational user), the developer (dev access, operator scripts), and the product owner (spec review, dev seed inventory).

## Goals / Non-Goals

**Goals:**
- The director can create and rename employees, manage membership periods, create and relabel positions, assign, hand over and end positions, and transfer people between Houses with previews, all in Catalan.
- The Equip page answers "who is in this House, in which position, on date X", including vacancies, former members and individual history.
- Staffing invariants (no overlaps, House match, assignment within membership, immutable position House and role) hold in Postgres for direct SQL and concurrent requests.
- Writes are atomic, idempotent under retries and rejected when stale.
- Access depends only on enabled director grants in our database. Roles and account links grant nothing.
- A real-database integration suite (`npm run test:db`) proves the constraints, rollback and races.

**Non-Goals:**
- Schedules, coverage, simultaneous titular/acting occupancy, ER delegation, staff self-service.
- Correcting or cancelling recorded history or scheduled plans; deleting employees or positions from the UI.
- A permissions or account-link UI; automatic account matching.
- A production Supabase project (the production cutover is documented, not executed).
- CI for the DB suite.

## Decisions

### D1: Role catalogue as a table plus a code constant
- **Choice:** `occupational_roles(code PK, label)` with the nine rows inserted by the migration (`ON CONFLICT DO NOTHING`). `src/lib/roles.ts` exports `ROLES` (`code`, `label`), `RoleCode` and `findRole`. A unit test parses the migration SQL and asserts that it matches `ROLES`, mirroring `houses-migration.test.ts`.
- **Why:** Positions need a foreign key target, and the UI needs labels without a query (role select, grouping).
- **Alternatives:** A Postgres enum (harder to extend, no label). A constant only (no referential integrity).

### D2: Positions with a DB-normalised label key and immutable House and role
- **Choice:** `positions(id, house_id, role_code, label, label_key, created_at)`.
  - `@@unique([houseId, labelKey])`, `@@unique([id, houseId])` (target of the composite FK).
  - A `BEFORE INSERT OR UPDATE` trigger `positions_normalise_and_freeze` sets `label := btrim(label)` and `label_key := lower(label)`, and raises SQLSTATE `CI002` if an UPDATE changes `house_id` or `role_code`.
  - `CHECK (label <> '')`.
  - Prisma declares `labelKey String @default("")`; the trigger always overwrites it.
- **Why:** Case-insensitive, trimmed uniqueness (FR-001) enforced for direct writes too, without an expression index, which Prisma would treat as drift and try to drop. Freezing House and role stops historical assignments from being repurposed.
- **Alternatives:** An expression unique index on `lower(btrim(label))` (drift risk). App-only normalisation (bypassable). A generated column (not supported by Prisma 7).

### D3: Position assignments enforced by exclusion constraints, a composite FK and a containment trigger
- **Choice:** `position_assignments(id, employee_id, position_id, house_id, starts_on, ends_on, created_at)`.
  - FK `employee_id → employees` `ON DELETE CASCADE`.
  - FK `(position_id, house_id) → positions(id, house_id)` `ON DELETE RESTRICT` (modelled in Prisma).
  - FK `house_id → houses` `RESTRICT`.
  - `CHECK (ends_on IS NULL OR ends_on >= starts_on)`.
  - `EXCLUDE USING gist (employee_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)` (one primary position per employee).
  - `EXCLUDE USING gist (position_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)` (one occupant per position).
  - **Containment:** `CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED FOR EACH ROW` on `position_assignments` (INSERT, UPDATE) and `house_memberships` (UPDATE, DELETE). It calls `enforce_assignment_containment()`, which:
    1. locks the affected employee row (`SELECT ... FROM employees WHERE id = ... FOR UPDATE`);
    2. for each still-existing assignment of that employee in the affected House, requires one membership with the same employee and House where `m.starts_on <= a.starts_on` and `coalesce(m.ends_on, 'infinity') >= coalesce(a.ends_on, 'infinity')`;
    3. raises SQLSTATE `CI001` with the assignment ID only (no names) if not.
- **Why:** BR-003, BR-004, BR-005 and FR-011 must hold outside the app. Deferring the check lets a transaction close a membership and its assignment in any order. Taking the employee lock inside the trigger means even direct SQL serialises per employee at commit, and READ COMMITTED gives the check statement a fresh snapshot after the lock.
- **Alternatives:** App-level checks in SERIALIZABLE transactions with retry (bypassable by SQL, retry loops everywhere). A non-deferred trigger (forces a fragile write order).

### D4: Per-employee lock and one transaction template for every staffing write
- **Choice:** `src/server/staffing-store.ts` (Prisma client passed in, no auth, no `server-only`) runs every mutation through `runOperation(db, { operationId, kind, actor }, async (tx) => ...)`:
  1. `INSERT INTO operation_receipts (id, kind, actor_clerk_user_id) VALUES (...)`. A concurrent duplicate blocks on the primary key until the first commits, then fails with 23505.
  2. `SELECT ... FROM employees WHERE id = ANY($ids) ORDER BY id FOR UPDATE` (sorted to avoid deadlocks).
  3. Re-read current state, verify the House scope (D7) and the expected state (D6).
  4. Plan with the pure domain module (D8), then write.
  5. `UPDATE operation_receipts SET result = $ids`.

  A 23505 on `operation_receipts_pkey` makes the store read the receipt. If the kind matches, it returns `{ status: 'already-applied', result }`; if not, `StaffingError('operation-conflict')`.
- **Why:** One template gives FR-011's atomicity, double-submit safety and serialisation in one place. Inserting the receipt first makes concurrent duplicates wait, rather than racing into an exclusion error.
- **Alternatives:** Natural unique keys per operation (none exist for transfers and handovers). Client-only button disabling (does not survive network retries, AC-023).

### D5: Operation receipts double as the minimal audit trail
- **Choice:** `operation_receipts(id uuid PK, kind text, actor_clerk_user_id text, result jsonb null, created_at)`. `result` holds IDs only. The operation ID is a `crypto.randomUUID()` generated when the form mounts and sent with every submit of that form instance.
- **Why:** Satisfies "minimal operational timestamps/actor references" (SPEC-002 §8) without copying names.
- **Alternatives:** A separate audit table (duplicate writes). No audit (no traceability).

### D6: Stale detection by open-period IDs, versions and plan tokens
- **Choice:**
  - **Name edit:** sends `expectedUpdatedAt` (`employees.updated_at`, Prisma `@updatedAt`).
  - **End assignment and end membership:** send the ID of the period they expect to be open; it must still have `ends_on IS NULL`.
  - **Two-step operations** (handover, transfer, end membership): the preview returns `planToken = sha256(canonical JSON of the plan's closes and opens)`. The confirm recomputes the plan under the lock and rejects with `stale` if the token differs.
- **Why:** Closed periods are immutable, so "still open" is a complete version for periods. The token catches any change between preview and confirm (a new future assignment, a changed occupant) without per-field versioning.
- **Alternatives:** A `version` column on every table (more schema, same effect).

### D7: House scoping inside the store
- **Choice:** Every store operation receives `houseId`, resolved by the caller from the validated route slug (`findHouseBySlug`, then the DB row), never from a cookie or form field.
  - Position operations require `position.house_id = houseId`.
  - Employee operations require a membership of the employee in `houseId` that is relevant to the operation (the ongoing one for transfer and end, the containing one for assign).
  - New-membership flows may pick any existing employee (the director manages both Houses).
  - Transfers validate the destination House separately (a known House, different from the source).
  - A mismatch raises `not-found` (no hint that the record exists in the other House).
- **Why:** FR-009 and AC-020; hidden IDs are untrusted.

### D8: One pure staffing module and one error type
- **Choice:** `src/lib/staffing.ts` holds the `Position`, `Assignment` and plan types, plus:
  - **Queries:** `isAssignmentActiveOn`, `occupancyOn`, `teamOn` (members on a date with their position or null; one row per employee), `formerMembers`, `ctOccupantsOn`, `findAssignmentOverlap`, `checkContainment`.
  - **`planHandover({ position, outgoing?, incomingEmployeeId, incomingCurrent?, startsOn, endsOn? })`:** closes the position's assignment crossing D on D-1 and the incoming employee's assignment crossing D on D-1, then opens the new one. It rejects when an outgoing assignment starts on or after D, or when either side has a later future assignment.
  - **`planEndAssignment`:** requires an ongoing assignment and an end on or after its start.
  - **`planEndMembership`:** requires an ongoing membership and an end on or after its start. It closes every assignment that crosses the end, and rejects if an assignment starts after the end.
  - **`planNewMembership`:** checks the period against existing memberships.
  - **`planHouseTransfer`:** composes SPEC-001's close/open membership rule with closing the source assignment crossing D on D-1 and an optional destination assignment starting D. It rejects a future source assignment starting on or after D, a same-House transfer, D on or before the source start, and a non-ongoing source.
  - **`planToken(plan)`.**

  `StaffingError(reason)` replaces `TransferError`. Its reasons: `invalid-dates`, `not-ongoing`, `same-house`, `starts-too-early`, `membership-overlap`, `employee-has-position`, `position-occupied`, `outside-membership`, `future-assignment-blocks`, `label-taken`, `stale`, `not-found`, `operation-conflict`. `planTransfer` keeps its behaviour but throws `StaffingError`, and its existing tests are updated. `src/lib/staffing-messages.ts` maps each reason to one Catalan sentence and renders plan previews as Catalan lines (who, which position and House, which date closes or opens). Error messages do not name the conflicting person, to keep the store's error type free of personal data. The store maps Postgres errors to the same reasons: 23P01 by constraint name, 23505 by constraint name, `CI001` → `outside-membership`, `CI002` → `not-found` (immutable fields are never sent by the app), 23503 → `not-found`.
- **Why:** The previews, the friendly errors and the database share one vocabulary, and the rules are unit-testable without a database.

### D9: Grant-based `requireDirector()` with a per-request cache only
- **Choice:**
  - `src/lib/auth.ts` resolves `userId` via Clerk `auth()`, wrapped in React `cache` (per request).
  - It loads the grant with `prisma.accessGrant.findUnique({ where: { clerkUserId } })`, also per-request cached, and checks the pure `isEnabledDirectorGrant(grant)` (`role === 'director' && revokedAt === null`).
  - Signed-out callers throw `Error('Not authorized')`, as today (the proxy already sends them to sign-in). Signed-in callers without a grant `redirect('/no-access')`.
  - `isDirector(publicMetadata)` is deleted, so nothing reads the metadata.
  - The return value becomes `{ userId }`; the display name is not used by callers (verified in the plan).
  - Every page under `[house]`, every function in `src/server/houses.ts` and `src/server/staffing.ts`, and every Server Function calls it first.
- **Why:** FR-008, AC-018 and AC-019. React `cache` is scoped to one request, so a revocation applies on the next request, with no process-wide cache.
- **Alternatives:** Grants in Clerk metadata (not in our EU DB, editable outside the app). Keeping the metadata as a fallback (forbidden by SPEC-002 §8.4).

### D10: Account links and grants via operator scripts
- **Choice:** `src/server/access-store.ts` (no auth, no `server-only`) provides `grantDirector`, `revokeDirector`, `listGrants`, `linkAccount` and `unlinkAccount`, with the client passed in. `scripts/access.ts` and `scripts/account-link.ts` (run with `tsx`, wired as `npm run access` and `npm run account-link`):
  1. load `.env.local`;
  2. verify the Clerk user exists via `@clerk/backend` `createClerkClient({ secretKey }).users.getUser(id)`;
  3. print the Clerk instance type (`sk_test_` = development, `sk_live_` = production) and the database host;
  4. ask for `yes` unless `--yes` is passed;
  5. write.

  Links use `employee_account_links(employee_id unique, clerk_user_id unique, linked_at)`. Duplicates raise 23505, which the script reports and exits non-zero on (AC-021).
- **Why:** SPEC-002 makes provisioning a trusted operator procedure. Verifying against the right Clerk instance stops a dev ID from being granted in production by mistake.
- **Alternatives:** An admin UI (out of scope). Raw SQL instructions (error-prone, no verification).

### D11: Routes, Server Functions and forms
- **Choice:**
  - **Pages** (all under `src/app/(app)/[house]/team/`; each page calls `requireDirector()`, validates the slug, then loads through `src/server/staffing.ts`):
    - `page.tsx` (views `?view=people|positions|former`, labelled Persones, Llocs, Membres anteriors, `?date=`);
    - `new/`;
    - `[employeeId]/` (Historial), plus `edit-name/`, `assign/`, `assignment/end/`, `membership/new/`, `membership/end/`, `transfer/`;
    - `positions/` (list and `Nou lloc`);
    - `positions/[positionId]/` (history, relabel, `Assigna ocupant` / `Substitueix`).
  - An invalid `?date` falls back to today. An unknown view falls back to `people`.
  - **Server Functions** live in an `actions.ts` next to each route. Each is bound to the House slug by the page (`action.bind(null, slug)`) and receives a plain object:
    1. `requireDirector()`;
    2. resolve the House;
    3. `schema.safeParse` (the zod schemas live in `src/lib/staffing-schemas.ts` and are shared with react-hook-form);
    4. call the store with `actor = userId`;
    5. `revalidatePath(`/${slug}/team`, 'layout')`;
    6. on success or already-applied, `redirect` to the relevant page with `?done=<kind>` (and `&repeat=1` for already-applied); on errors, return `{ status: 'error', reason, message, fieldErrors? }`.

    Two-step actions also accept `intent: 'preview' | 'confirm'`; a preview returns `{ status: 'preview', summary, planToken }`.
  - **Client forms:** react-hook-form with `zodResolver`; `useActionState` gives pending state; the submit is disabled while pending. The operation ID comes from `useState(() => crypto.randomUUID())`. The confirmation step renders the server summary with `Confirma` and `Cancel·la`, where `Cancel·la` returns to the form without writing.
  - **Feedback:** errors use an `Alert` with an icon. A `?done` value shows a neutral success note.
  - **UI primitives added** in the shadcn style (`src/components/ui/`): `Input`, `Label`, `NativeSelect` and `Alert`, styled with our tokens. Native `<select>` replaces the Radix select (mobile-native pickers, no portal, testable in jsdom). The view switcher on the Equip page and the "Persona nova / Persona existent" choice on `/team/new` are links (`?view=`, `?mode=existing`), so they work without client state and keep the choice in the URL.
  - **Switcher:** `switchHousePath` keeps `/<house>/team`, `/<house>/team/new` and `/<house>/team/positions` (no record in the path) and maps every other path below `/<house>/team/` (employee and position pages) to `/<other>/team`.
- **Why:** Pages per action keep each form small, keyboard- and mobile-friendly, and testable. Binding the slug server-side keeps the House out of client control.

### D12: Team data loading
- **Choice:** `src/server/staffing.ts` loads a House's memberships (with employee names), positions and assignments in three scoped queries, and computes views with the pure functions; data volumes are tens of rows. The employee history loads that employee's memberships and assignments across both Houses (FR-005, "with their own Houses") only after checking the employee has had a membership in the route House. `listCurrentMembers` in `src/server/houses.ts` is replaced by `getTeamView(houseId, date)`.
- **Why:** Reuses the tested pure functions and avoids complex SQL.

### D13: Real-database test harness
- **Choice:** `vitest.db.config.ts` (environment `node`, `include: ['src/**/*.db.test.ts']`, `globalSetup: 'test/db/global-setup.ts'`, `fileParallelism: false`). The default `vitest.config.ts` excludes `*.db.test.ts`. Global setup:
  1. finds `initdb` and `pg_ctl` (the `PG_BIN` env var, otherwise `PATH`);
  2. runs `initdb --locale=en_US.UTF-8 -E UTF8` into a temp directory;
  3. starts Postgres on a free port with its socket in the temp directory;
  4. creates the database;
  5. runs `npx prisma migrate deploy` with `DATABASE_URL` and `DIRECT_URL` set to the local URL (dotenv does not override existing variables);
  6. exports the URL to tests and tears everything down at the end.

  It refuses to run if the URL host is not `localhost` or `127.0.0.1`. `test/db/helpers.ts` provides `createTestClient()` and `resetData(db)` (truncates everything except `houses` and `occupational_roles`) plus fixtures. `npm run test:db` runs it.
- **Why:** Real constraint, rollback and concurrency evidence (SPEC-002 §9; SPEC-001 retrospective miss). The `en_US.UTF-8` locale matches Supabase for `lower()`.
- **Alternatives:** Testcontainers (needs Docker running). Supabase branches (paid, network). PGlite (single connection, no real concurrency).

### D14: Dev seed from the product owner's inventory
- **Choice:** `prisma/seed-data.ts` exports `SEED_START` (`2025-09-01`) and `SEED_INVENTORY`: the product owner's two lists of fictional staff (list 1 = Paulo Freire, list 2 = Carme Aymerich), 10 positions per House with labels `PDG`, `PSI`, `ER`, `TFM`, `TFT`, `ET`, `ECS`, `EN 1`, `EN 2`, `CT` and one occupant each. `prisma/seed.ts` creates every position and every person (membership plus assignment from `SEED_START`) through `staffing-store.ts` (the real paths) with the actor `seed`, keeps its production guard and its "skip if employees exist" rule. No scripted events: handovers, transfers, vacancies and former members are produced through the UI during browser acceptance, so the seed stays a faithful copy of the lists. The dev DB is refreshed with `npx prisma migrate reset --force` then `npx prisma db seed` (fictional data only), followed by re-granting the developer.
- **Why:** A realistic dev scenario (D1) without hard-coding real data into production paths.

## Risks / Trade-offs

- [Risk] Prisma drift on hand-written SQL (triggers, EXCLUDE, the composite FK). → Mitigation: no expression indexes (D2); after creating the migration, a follow-up `prisma migrate dev --create-only` must produce an empty migration; the migration sync test asserts the hand-written blocks exist.
- [Risk] The containment trigger is wrong or too slow. → Mitigation: DB tests for direct SQL, deferred order and races; per-employee row counts are tiny.
- [Risk] Deadlocks between the in-trigger lock and app locks. → Mitigation: the app locks the same employee rows first, sorted by ID, so the trigger re-acquires locks the transaction already holds.
- [Risk] Lock-out after the cutover (no grant in an environment). → Mitigation: the README procedure runs `npm run access -- grant` before using a migrated environment; `/no-access` explains the situation; recovery is to grant again.
- [Risk] The local Postgres 14 harness differs from Supabase (15+). → Mitigation: only long-standing features are used; the harness prints the server version; a manual check on the dev DB after migrating is recorded in tasks.
- [Risk] The harness cannot run where Homebrew Postgres is missing. → Mitigation: the README prerequisite plus the `PG_BIN` override; verify requires a `test:db` run.
- [Risk] `migrate reset` on the dev DB wipes the developer's grant and any manual dev data. → Mitigation: fictional data only; the README and task note to re-grant; the reset is run only with the user's go-ahead.
- [Trade-off] Hand-written SQL is invisible in `schema.prisma`. → Accepted; comments in the schema point to the migration, as in SPEC-001.
- [Trade-off] One page per action means more routes than dialogs. → Accepted for mobile, keyboard and testability.
- [Trade-off] Previews cost an extra round trip. → Accepted; they are what makes the plan token stale-safe.

## Migration Plan

1. `prisma migrate dev --create-only --name staffing`, then hand-add the triggers, constraint triggers, EXCLUDE and CHECK constraints and the role rows. A second `--create-only` must produce an empty migration (no drift).
2. Run `npm run test:db` against the fresh local database (the migration plus all DB tests).
3. Apply to the dev Supabase DB (`npm run db:migrate`, or `npx prisma migrate reset` to reseed with the new inventory).
4. `npm run access -- grant <developer Clerk user ID>` against dev (plus the director's ID if they use dev). Verify that an allowed user enters and that a signed-in user without a grant sees `/no-access`.
5. Optionally clear the old `publicMetadata.role` flag in Clerk (it no longer has any effect).
6. Production (later, its own Supabase project): `prisma migrate deploy`, then `npm run access -- grant <director Clerk user ID>` with production keys (the script shows "production"), then verify allowed and denied users. The developer's dev grant is never copied. No seed.
7. Rollback: revert the app commit, which brings back the metadata gate. The migration only adds tables and columns, so it can stay in place; a follow-up migration drops them if the change is abandoned.

## Open Questions

- **Retention and erasure** of staffing history, receipts and backups: the GDPR review after the first deliverable. Not blocking.
- **Production Supabase project and production Clerk instance:** not yet created; the cutover steps are documented only.
