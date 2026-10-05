## Why

SPEC-001 gave each House a team, but people and memberships can only be entered with the dev seed or direct database edits, there is no notion of role or position (so no CT per House), history and former members have no UI, and access hangs on a hand-set Clerk metadata flag. Before APs (SPEC-101) can attach to stable employees and positions, the director needs to maintain both Houses' staffing in the app, and access must move to explicit, revocable grants in our EU database.

## What Changes

Source: product spec SPEC-002 (verbatim copy in `SPEC-002-roles-and-position-assignments.md`), with review decisions D1-D4 accepted as proposed (D1 adds a realistic dev-seed inventory; see `brainstorm.md`).

- Add the occupational role catalogue (PDG, PSI, ER, TFM, TFT, ET, ECS, EN, CT), configurable positions per House and dated position assignments (one position per employee and one occupant per position on any date), with vacancies, handovers and successive substitutes.
- Add employee creation and name editing, membership lifecycle (add a period, end a membership) and a House transfer workflow that also closes and opens position assignments, all atomic, idempotent and stale-safe.
- Extend the Equip page: people or positions on a selected date, `Membres anteriors`, and an individual history page; add a positions page per House.
- Enforce the staffing invariants in Postgres (exclusion constraints, composite House FK, deferred containment trigger, immutable position House/role) and add a real-database integration test suite (`npm run test:db`).
- Replace the temporary Clerk metadata gate with application grants, add optional operator-managed employee-to-account links and operator scripts to provision both.

**Access gate**
- From: signed-in users with Clerk `publicMetadata.role = "director"` enter.
- To: only users with an enabled `director` grant in `access_grants` enter; the metadata flag is ignored, with no fallback.
- Reason: SPEC-002 FR-008; a flag in Clerk metadata cannot be audited or revoked in our data, and roles such as CT or ER must never imply access.
- Impact: breaking for environments without a grant. Each environment needs `npm run access -- grant <clerkUserId>` before use; the README documents the cutover.

**House transfer**
- From: domain/server logic only, membership rows only.
- To: a confirmed transfer form that also closes the source position assignment on D-1 and optionally opens a destination assignment on D, in one transaction.
- Reason: SPEC-002 FR-006. Impact: non-breaking.

**House switcher on detail pages**
- From: switching keeps the full path.
- To: from employee or position pages, switching goes to the other House's `/team`.
- Reason: an employee or position ID has no relationship with the other House (FR-006). Impact: non-breaking.

## Non-goals

- Schedules, rotations, working-hour percentages, overnight shifts, calendars.
- AP entitlements, requests, approvals, balances or spreadsheet migration.
- Absences, sick-leave reasons, vacations, payroll, annual accounting.
- Temporary or partial coverage, simultaneous titular/acting occupancy, CT coverage calendar, automatic replacement detection.
- ER delegation, staff self-service, invitations, a permissions or account-link UI.
- Editing or cancelling completed or scheduled history (corrections, cancelling a future transfer or assignment), employee deletion UI, position retirement.
- Importing real employee names; seeding a position inventory in production.

## Capabilities

### New Capabilities
- `staffing-positions`: the role catalogue, positions per House, dated position assignments with their invariants, handovers, vacancies and CT occupants per House.
- `staffing-operations`: cross-cutting rules for staffing writes: House scoping and record validation, atomicity, idempotent submissions, stale-state rejection, confirmations and Catalan error behaviour.
- `team-views`: the Equip page on a selected date (people and positions), former members, the individual history page and the positions page.
- `application-access`: director application grants, optional employee-to-account links, operator provisioning and the rule that roles and links never grant access.

### Modified Capabilities
- `house-context`: "Director-only access" now relies on enabled application grants instead of Clerk metadata and also covers mutations; "Switch active House" sends employee and position pages to the other House's team list.
- `house-membership`: transfers also handle position assignments and are rejected for stale or non-ongoing sources; employee creation, name editing and membership lifecycle are added; minimal employee data covers the new cascades.

## Personal data and GDPR

- **New personal data:** position assignment history (which person held which position, when), optional Clerk user IDs (account links and grants), and the acting user's Clerk ID with a timestamp on each operation receipt. No health, contact, identity-document, contract or payroll data; no sick-leave data.
- **Residency:** all of it is stored in the existing Supabase Postgres project in the EU. Nothing is copied into Clerk metadata.
- **Access:** only users with an enabled director grant can read or change staffing data (today: the director, and the developer in dev only). Account links and occupational roles grant nothing.
- **Minimisation:** employees still hold only a full name; receipts store IDs, not names.
- **Erasure:** deleting an employee (operator action, no UI) cascades to memberships, assignments and the account link; positions and grants are untouched. Ending a membership is not erasure.
- **Retention:** not defined here. The GDPR review after the first deliverable must set retention and erasure/anonymisation for staffing history, receipts and backups.
- **Dev seed:** fictional names only, on a realistic position inventory supplied by the product owner.

## Impact

- **Database:** new migration `staffing` (tables `occupational_roles`, `positions`, `position_assignments`, `access_grants`, `employee_account_links`, `operation_receipts`; `employees.updated_at`; hand-written exclusion constraints, composite FK, triggers). SPEC-001 tables and constraints are kept.
- **Code:** `src/lib/auth.ts` (grant-based `requireDirector`), new `src/lib/roles.ts`, `src/lib/staffing.ts`, `src/server/staffing-store.ts`, `src/server/staffing.ts`; `src/lib/houses.ts` (`switchHousePath`); `src/server/houses.ts` and `membership-store.ts` adapt.
- **Routes:** `/[house]/team` (views, date), `/[house]/team/new`, `/[house]/team/[employeeId]` and its action pages, `/[house]/team/positions`, `/[house]/team/positions/[positionId]`.
- **Components:** new shadcn primitives (input, label, select, radio group, alert) and staffing forms and lists.
- **Tooling:** `scripts/access.ts`, `scripts/account-link.ts` (npm scripts), `npm run test:db` with an ephemeral local Postgres (Homebrew `postgresql@14` or newer), `prisma/seed.ts` extended.
- **Operations:** each environment needs a director grant after migrating; the Clerk metadata flag can be cleared afterwards.
