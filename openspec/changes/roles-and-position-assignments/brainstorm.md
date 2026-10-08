# Brainstorm: Roles and Position Assignments (SPEC-002)

Raw capture of the brainstorming session (2026-10-05). Input: SPEC-002 "Roles and Position
Assignments", written by the product owner in another tool. A verbatim copy is stored next to
this file as `SPEC-002-roles-and-position-assignments.md` so the delivery delta can be checked
against it at the end (SPEC-001's source was never stored, which made its delta harder).
Path: **architectural** (new domain models, an access-control cutover, a migration with
hand-written constraints, and the first management UI).

## Background

SPEC-001 delivered two Houses, URL-scoped House context, a minimal `Employee`, dated
`HouseMembership` with a Postgres exclusion constraint, atomic transfer logic (no UI), a
read-only team page and a temporary director gate (`publicMetadata.role === 'director'` in
Clerk). SPEC-002 makes that foundation usable without database edits: roles, positions,
dated occupancy, employee and membership management, transfers, history, former members, and
real application grants replacing the Clerk flag.

Repo state at the time:

- `src/lib/house-membership.ts`: pure membership rules (`isActiveOn`, `membersOn`,
  `findOverlap`, `planTransfer`, `TransferError`).
- `src/server/membership-store.ts` (Prisma, no auth, used by the seed) and
  `src/server/houses.ts` (director-gated reads and `transferEmployee`).
- `src/lib/auth.ts`: `requireUser()`, `isDirector()` (metadata), `requireDirector()` with a
  per-request React `cache` of `currentUser()`.
- `/[house]/team` renders `TeamList` (name + "Des del").
- One migration, `20261005092628_house_context`, with `btree_gist`, the period CHECK and the
  membership exclusion constraint, plus the two House rows.
- No DB integration tests (SPEC-001 retrospective: painful miss, promote candidate "add a DB
  integration harness before the next migration with hand-written constraints").
- Local tooling: Homebrew Postgres 14 (`initdb`, `pg_ctl`, `btree_gist` available); Docker
  installed but the daemon is not running; no CI.
- Branch: `feat/house-context` (SPEC-001) is not merged to `main` yet, so this change branches
  from it (`feat/roles-and-position-assignments`).

## Understanding (written back and accepted)

- **Outcome:** the director manages people and staffing for both Houses without DB edits:
  add/rename employees, membership periods, dated positions (including CT), handovers,
  transfers, team-by-date, former members and individual history.
- **Access:** application grants in our EU database replace the Clerk metadata flag, with no
  fallback. Account links to Clerk users are operator-managed and grant nothing.
- **Hard constraints:** DB-enforced and concurrency-safe overlap and containment rules; atomic,
  idempotent writes; stale forms rejected; Europe/Madrid dates; Catalan UI per DESIGN.md; no
  new sensitive data.
- **Success:** the 24 acceptance scenarios pass, including real database integration tests.

## Decision log

### D1. How are House positions created?
Options: (a) manual entry, multiple slots per role, nothing auto-created; (b) seed a starting
inventory.
**Decision: (a) in the product, plus a realistic dev seed.** The product owner will provide a
real list of positions per House with simulated occupant names "so we can do tests in a
realistic scenario right away". That list feeds the **dev seed only**; production starts with
no seeded inventory and the director creates positions in the UI (SPEC-002 §8.2). Until the
list arrives, the plan uses a placeholder inventory clearly marked for replacement; swapping it
is a data change, not a design change.

### D2. Assignment cardinality
Options: (a) at most one primary position per employee and one occupant per position on any
date; successive substitutes as dated periods; (b) titular + acting occupancy now.
**Decision: (a) one at a time.** Simultaneous titular/acting occupancy, partial shifts and
cross-House coverage stay in a later coverage spec.

### D3. Who gets an application grant?
Options: (a) director-only grants; (b) an extra admin role for the developer.
**Decision: (a) director-only.** Only enabled `director` grants give access. The developer gets
a director grant in the dev environment only. ER, CT and linked employees get nothing. Grants
and account links are created by operator scripts, no UI.

### D4. Management UI scope
Options: (a) add/edit, membership, assignments, handovers, transfers, history and former
members; defer general corrections and cancelling scheduled plans; (b) also cancel future plans.
**Decision: (a).** Existing future plans block conflicting operations with an explicit error;
correcting or cancelling them needs a later spec.

### Q5. Enforcement and testing approach
Options:
- **A, DB-first:** exclusion constraints for assignment overlaps (per employee, per position);
  composite FK `(position_id, house_id)` for the House match; a deferred constraint trigger for
  membership containment; a per-employee row lock (`SELECT ... FOR UPDATE`) at the start of
  every staffing write transaction; operation receipts for idempotency; an ephemeral local
  Postgres for `npm run test:db`.
- **B, application-level:** exclusion constraints only, containment checked in TypeScript inside
  SERIALIZABLE transactions with retry; no triggers.

**Decision: A.** It keeps SPEC-001's principle that foundational invariants hold even outside
the app (FR-011 "not only client validation"). B leaves direct SQL able to strand an
assignment outside its membership and spreads retry loops across call sites. Testing on an
ephemeral local Postgres, because Docker is not running and Supabase branches cost money and
need network. Trade-off accepted: Postgres 14 locally vs 15+ on Supabase; none of the features
used (exclusion constraints, `btree_gist`, deferrable constraint triggers, expression unique
indexes) differ.

## Validated design

### Section 1: Data model and DB enforcement (approved)

Existing tables (`houses`, `employees`, `house_memberships`) and constraints are untouched. One
new migration, `staffing`, adds:

| Table | Columns | Hand-written protections |
|---|---|---|
| `occupational_roles` | `code` PK (PDG, PSI, ER, TFM, TFT, ET, ECS, EN, CT), `label` (Catalan) | Inserted idempotently by the migration; a `ROLES` constant in `src/lib/roles.ts` mirrors it with a sync test (same pattern as `HOUSES`). |
| `positions` | `id`, `house_id`, `role_code`, `label`, `created_at` | Unique index on `(house_id, lower(btrim(label)))`; `UNIQUE (id, house_id)` for the composite FK; a `BEFORE UPDATE` trigger rejects any change to `house_id` or `role_code` (only the label is editable). |
| `position_assignments` | `id`, `employee_id`, `position_id`, `house_id`, `starts_on`, `ends_on` (null = ongoing), `created_at` | Composite FK `(position_id, house_id)` → `positions(id, house_id)` (House must match). `CHECK (ends_on >= starts_on)`. EXCLUDE per employee (one primary position at a time). EXCLUDE per position (one occupant at a time). Containment constraint trigger. |
| `access_grants` | `clerk_user_id` unique, `role` (`CHECK = 'director'`), `granted_at`, `revoked_at` | Enabled = `revoked_at IS NULL`. Not linked to employees, so it never cascades. |
| `employee_account_links` | `employee_id` unique, `clerk_user_id` unique, `linked_at` | One account per employee and vice versa. Unlink deletes the row. |
| `operation_receipts` | `id` (client-generated operation UUID, PK), `kind`, `actor_clerk_user_id`, `result` (JSON of IDs only), `created_at` | Double-submit protection, and a minimal "who did what, when" trail. |

- **Containment trigger:** a deferred constraint trigger on `position_assignments` (insert,
  update) and `house_memberships` (update, delete). At commit, each affected assignment must
  lie entirely within one membership of the same employee and House; an open-ended assignment
  needs an open-ended membership. Deferred, so "close membership + close assignment" may run in
  any order inside one transaction. It raises a custom SQLSTATE that the app maps to a Catalan
  error.
- **Concurrency:** every staffing write transaction starts with
  `SELECT ... FROM employees WHERE id = $1 FOR UPDATE`, so concurrent writes for the same
  person serialise and the trigger sees committed state. Conflicts between different people
  over one position are caught by the position exclusion constraint; the loser gets "position
  occupied" (AC-006).
- **Stale edits:** closed periods are never edited, so "this period is still open" is the
  version check for memberships and assignments. Forms submit the expected open period's ID;
  the server rechecks it after the lock. Name edits use a new `employees.updated_at` as the
  version.
- **Deletes:** employee delete cascades to memberships (as today), assignments and the account
  link. Positions are `RESTRICT`ed while referenced. Grants are untouched.

### Section 2: Domain, server layer, access and operator scripts (approved)

Same layering as SPEC-001: pure rules → store without auth (seed, tests) → auth-wrapped server
layer.

- **`src/lib/roles.ts`:** the catalogue.
- **`src/lib/staffing.ts` (pure):** `occupancyOn(assignments, positions, date)`;
  `teamOn(memberships, assignments, houseId, date)` (members with primary position or none; a
  returning employee appears once); `formerMembers(memberships, houseId, today)`;
  `ctOccupantsOn(...)` (FR-007); `checkContainment` and `findAssignmentOverlap` mirroring the DB.
  Plan functions return close/open plans or throw a typed `StaffingError(reason)`:
  `planHandover(position, outgoing?, incoming, D)` (replace an occupant, or move someone to
  another position); `planEndAssignment`; `planEndMembership(membership, assignments, end)`
  (closes assignments crossing the end, rejects assignments starting after it);
  `planHouseTransfer(source, sourceAssignment?, toHouse, D, destPosition?)` (extends
  SPEC-001's `planTransfer`).
- **`src/server/staffing-store.ts` (Prisma, no auth):** every mutation follows one template
  inside `db.$transaction`: check the receipt (exists → "already applied" with the stored
  result) → lock the employee → re-read current state and verify the expected state (else
  stale) → plan with the domain → write → insert the receipt. Postgres errors 23P01, 23505, the
  custom containment SQLSTATE and 23503 map to the same `StaffingError` reasons. Logs record
  the reason code only, never SQL or names.
- **`src/server/staffing.ts` (`server-only`):** reads call `requireDirector()` first; every
  query is scoped by House ID and verifies records belong to it (FR-009). Employee detail is
  not-found unless the employee has had a membership in that House.
- **Server actions (`src/app/(app)/[house]/team/**/actions.ts`):** `requireDirector()` → House
  from the route slug (never a cookie or hidden field) → zod parse (the same schema runs in the
  browser via react-hook-form) → store → `revalidatePath` → typed result for `useActionState`.
  Forms accept only whitelisted fields, so no request can touch grants or links. Handover,
  transfer and end-membership use two steps: a server-computed preview (no writes), then a
  confirm reusing the same operation ID.
- **`src/lib/auth.ts`:** `requireDirector()` takes `userId` from Clerk `auth()` and requires an
  `access_grants` row with `role = 'director'` and `revoked_at IS NULL`, cached per request only
  (React `cache`), so a revocation applies on the next request. The `publicMetadata` check is
  deleted, no fallback. Signed-out → sign-in; signed in without a grant → `/no-access`
  ("Sense accés"), as today.
- **Operator scripts (tsx, documented in the README):**
  `npm run access -- grant|revoke|list <clerkUserId>` and
  `npm run account-link -- link <employeeId> <clerkUserId> | unlink <employeeId>`. Both verify
  the user exists in the Clerk instance of the current `CLERK_SECRET_KEY` before writing, print
  the target Clerk instance (dev or prod) and DB host, and ask for confirmation. No matching by
  email or name; no bulk conversion of metadata flags. Recovering a lost director grant = run
  `grant` again.

### Section 3: UI and routes (approved)

English segments, Catalan labels, all under the existing **Equip** section; section nav stays
Inici + Equip. Server-rendered pages; forms are small client components (react-hook-form + zod
+ `useActionState`). Add the shadcn primitives the forms need (input, label, select, radio
group, alert), styled with our tokens.

| Route | Content |
|---|---|
| `/[house]/team` | **Equip.** Views via `?view=`: **Persones** (default: name, membership start, position or `Sense lloc assignat`), **Llocs** (every position with role and occupant or `Vacant`), **Membres anteriors**. Date control `?date=YYYY-MM-DD` (default today in Madrid); a different date shows a neutral info banner "Mostrant l'equip del 1 de juliol de 2026" with "Torna a avui". Actions: `Afegir persona`, `Llocs de treball`. |
| `/[house]/team/new` | **Afegir persona.** *Persona nova* (name, start, optional end, optional position) or *Persona existent* (an employee not a member of this House on those dates: returns and cross-House cases). Membership and optional assignment in one transaction. |
| `/[house]/team/[employeeId]` | **Historial.** Name, membership periods across both Houses (each labelled with its House), assignments including future ones. Actions: `Editar nom`, `Assignar lloc` / change position, `Finalitzar lloc`, `Finalitzar pertinença`, `Afegir període` (only with no ongoing membership), `Traslladar` (only with an ongoing membership in this House). 404 unless the employee has had a membership in this House. |
| `…/[employeeId]/edit-name`, `/assign`, `/assignment/end`, `/membership/new`, `/membership/end`, `/transfer` | One page per action (mobile- and keyboard-friendly). Handover, transfer and end-membership show a confirmation (who, Houses/positions, closing D−1 and opening D). `Cancel·la` writes nothing. |
| `/[house]/team/positions` | **Llocs de treball.** Positions grouped by role with today's occupant or `Vacant`; `Nou lloc` (label + role). |
| `/[house]/team/positions/[positionId]` | Occupancy history; `Edita l'etiqueta`; `Assigna ocupant` / `Substitueix` (outgoing → incoming handover with confirmation). |

- **House switcher:** any path deeper than `team/` (employee or position pages) switches to the
  other House's `/team` (FR-006); `switchHousePath` gets a test.
- **Submit:** buttons disabled while pending; each form carries an operation ID generated on
  mount; an uncertain retry that returns "already applied" shows a success message saying so
  (AC-023).
- **Errors:** icon + Catalan text; inline field errors; values kept after failure. Conflicts
  name the conflict ("Aquest lloc ja està ocupat del 1 de juliol per Marta Soler"); stale
  state → "Les dades han canviat; torna a carregar la pàgina".
- **No honey anywhere in this change:** vacancies are muted text, future periods are a neutral
  "Futur" text tag, the selected view uses the Salvia selected style.
- **Empty states:** clay-house mark + copy ("Encara no hi ha llocs de treball a Paulo Freire.").
- **Dates:** `formatDateCa` + `tabular-nums`; native `<input type="date">`; the server validates
  as `IsoDate`.

### Section 4: Migration, cutover, seed, testing, GDPR (approved)

- **Migration:** `prisma migrate dev --create-only`, then hand-add the constraints and triggers,
  then apply. Touches no existing rows; all SPEC-001 constraints stay (AC-022). A sync test
  greps the migration for the hand-written constraints and the nine roles (not proof they work:
  the DB tests are).
- **Cutover:** after migrating dev, run `npm run access -- grant <developer Clerk ID>` (and the
  director's when they use dev). `requireDirector()` switches to grants in the same release as
  the migration. The README gets a "first deploy to an environment" procedure (migrate → grant
  → verify allowed and denied). No production project exists yet: the production cutover is
  documented, not executed, and production gets only the director's grant, never the
  developer's dev flag.
- **Dev seed:** stays fictional, idempotent, with the production guard. Adds the product
  owner's position list for both Houses with simulated occupants, built through the real store
  functions (handovers, a vacancy, a future occupant, Ana's transfer with a destination
  position).
- **Tests:**
  - Unit: pure domain (plans, overlap, containment, team and occupancy on a date, former
    members, CT, Madrid summer and winter boundaries AC-015).
  - Component: lists, date banner, forms (validation, value retention, pending), switcher
    rewrite.
  - Server and actions (mocked store and auth): every action and read calls
    `requireDirector()` before data; tampered House/position/employee IDs and stray permission
    fields ignored (AC-018..AC-020).
  - DB integration (`npm run test:db`, separate Vitest project): `initdb` into a temp dir on a
    free port → `prisma migrate deploy` → tests → teardown. Direct overlap inserts, containment
    via direct SQL, rollback of failed transfers/handovers, concurrent `Promise.all` races
    (AC-006), double-submit receipts (AC-012, AC-023), stale rejection, `positions`
    immutability trigger, cascades, migration over SPEC-001-shaped data. Kept out of
    `npm test` so the default suite stays fast; verify requires both.
  - Browser acceptance: recorded smoke via gstack `/browse` on `npm run build && npm start`,
    desktop and mobile widths: add/edit, handover, future transfer, history, former members, a
    rejected operation, denied access (SPEC-001 retro lesson: smoke on a production build).
- **GDPR:** new personal data = position assignment history, optional Clerk user IDs (links and
  grants), and the actor Clerk ID + timestamp on each operation receipt. No health, contact,
  contract or payroll data. Everything stays in the EU Supabase DB; nothing goes to Clerk
  metadata. Erasure: employee delete cascades to memberships, assignments and the link;
  positions and grants untouched; receipts hold IDs only. No delete button. Retention is
  deferred to the GDPR review after the first deliverable (as agreed in SPEC-001) and listed as
  an open item.

## Trade-offs noted

- **Constraint trigger vs app-only checks:** more hand-written SQL (invisible to
  `schema.prisma`) in exchange for invariants that hold under direct SQL and concurrency.
- **Per-employee row lock:** serialises all writes for one person; negligible at one director's
  write volume.
- **Operation receipts:** one extra table and a client-generated UUID per form; gives
  idempotency for multi-row operations (transfer, handover) where a natural unique key does not
  exist.
- **One page per action vs dialogs:** more routes, but no dialog state, works without JS
  beyond the form, and stays usable on mobile.
- **Local Postgres 14 for DB tests vs Supabase 15+:** features used are identical; requires
  Homebrew Postgres on the developer machine (documented in the README).
- **No production inventory seed:** the realistic list exists only in dev; production
  positions are entered by hand by the director.

## Plan-time updates (2026-10-08)

Found while writing plan.md, after a throwaway spike against a local Postgres 14 and the
real Prisma 7 adapter:

- **Inventory received.** The product owner sent two fictional lists (list 1 = Paulo Freire,
  list 2 = Carme Aymerich): 10 positions per House (PDG, PSI, ER, TFM, TFT, ET, ECS, EN x2,
  CT), all occupied. The dev seed is now exactly those lists, from 2025-09-01, with no
  scripted events; handovers, transfers and former members are exercised in browser
  acceptance instead (design D14 updated).
- **Branch base.** `feat/house-context` was merged to `main` (merge commit), so this branch
  was rebased onto `origin/main`.
- **Prisma error shapes.** Model writes surface Postgres errors as
  `PrismaClientKnownRequestError` with `meta.driverAdapterError.cause.originalCode`;
  exclusion constraints, CHECKs, trigger errors and deferred-trigger errors at commit come
  as a bare `DriverAdapterError` with `cause.originalCode`. The constraint name is only in
  the message. The store maps both shapes (plan Task 8).
- **Hand-written SQL verified.** The full staffing migration (roles, position trigger,
  EXCLUDE constraints, deferred containment trigger) applied cleanly, behaved as designed
  (including accented `lower()` with `en_US.UTF-8`), and a follow-up `migrate diff`
  reported an empty migration: no drift.
- **Local Postgres quirks.** The first `initdb` on PATH is libpq's client-only copy, and
  temp paths are too long for a Unix socket on macOS. The harness uses the binaries next
  to the `postgres` server binary and TCP only.
- **UI simplifications (design D11 updated).** Native `<select>` instead of the Radix
  select; links (URL state) for the Equip views and "Persona nova / Persona existent";
  the House switcher keeps `team`, `team/new` and `team/positions`.
- **Error copy.** Conflict messages do not name the other person (design D8 updated), to
  keep personal data out of the store's error type.
- **Layering.** View types live in `src/lib/staffing-views.ts` so client components never
  import a server module.
