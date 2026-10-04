# Brainstorm: House Context (SPEC-001)

Raw capture of the brainstorming session (2026-10-04). Input: SPEC-001 "House Context",
written by the user in another tool and pasted into the session. Path: **architectural**
(first domain models, and a routing/context layer every later feature depends on).

## Background

The app manages scheduling and absence information for two Cases d'Infants, **Paulo Freire**
and **Carme Aymerich**. The director manages both; each House normally has its own team and
its own corretor (CT). SPEC-001 makes the House the primary operational boundary: one active
House at a time, switchable, preserved across navigation, with employees scoped by dated
House membership, and exceptional cross-House work (CT coverage, ER standing in for the
director) kept separate from membership.

Repo state at the time: bare skeleton. No Prisma models, `requireUser()` with no roles,
`(app)/dashboard` placeholder, `TopBar` with breadcrumb + actions slots, no nav. DESIGN.md
is coordinator-first, no sidebar (top bar desktop, bottom tab bar mobile), honey reserved
for "waiting for a decision".

Domain glossary from the spec: **AP** = assumptes propis; **CT** = corretor (covers other
positions, no fixed schedule); **ER** = role that may temporarily cover the director.

## Review findings on SPEC-001 vs. the repo

1. **Scope contradiction.** Section 9 assigns the effective-dated Person → House membership →
   Role relationship to SPEC-002, but SPEC-001's Definition of Done requires current employees
   scoped by House and preserved membership history. Neither is implementable or testable
   without an employee entity, which does not exist.
2. **FR-008, FR-009, BR-006..BR-008** (corretor, cross-House coverage, ER supervision) depend
   on roles and coverage that are not modelled. In this change they can only be structural
   guarantees, not features.
3. **No director role.** Today every signed-in user sees everything; the spec assumes a director.
4. **The spec does not say where the active House lives** (URL, cookie, user profile). This
   shapes every future route.

## Decision log

### Q1. Scope: how to handle employees and membership?
Options: (a) minimal Employee + dated HouseMembership now, roles/corretor/coverage later;
(b) House context only, membership to SPEC-002; (c) everything including a cross-House
assignment entity and per-House corretor.
**Decision: (a) Minimal Employee + membership.** This change adds House, a bare Employee
(name only) and dated HouseMembership with the one-House-at-a-time rule. SPEC-002 adds
roles/positions and links employees to Clerk users. Corretor and cross-House coverage remain
documented guarantees with no entity yet.

### Q2. Where does the active House live?
Options: (a) URL segment + cookie remembering the last choice; (b) cookie only;
(c) stored on the user (Clerk metadata / DB preference).
**Decision: (a) URL segment + cookie.** Routes become `/paulo-freire/...`,
`/carme-aymerich/...`. The House is visible, bookmarkable and shareable; server components
read it from `params`; links cannot silently lose it. The cookie only picks where `/dashboard`
redirects.

```
/                       landing
/dashboard  ──redirect──▶ /<last-house>
/paulo-freire           Inici (PF)
/paulo-freire/equip     Equip (PF)
/carme-aymerich/equip   Equip (CA)

cookie: active-house=paulo-freire  (only used to pick the redirect)
```

Verified in `node_modules/next/dist/docs`: cookies cannot be set during Server Component
rendering (only Server Functions / Route Handlers), but the proxy can set response cookies;
`params` is a Promise in layouts and pages.

### Q3. Who may enter the House-scoped area?
Options: (a) director flag in Clerk `publicMetadata.role`; (b) any signed-in user with
sign-ups closed in Clerk; (c) both.
**Decision: (a) Director flag in Clerk.** Only users with `publicMetadata.role = 'director'`
(set by hand in the Clerk dashboard) can enter; everyone else sees a friendly "no access"
page. A tiny `requireDirector()` guard that SPEC-002 replaces with real roles.

### Q4. What team UI ships, given profile management and transfers are out of scope?
Options: (a) read-only Equip page + dev seed; (b) Equip + minimal add form; (c) no team UI.
**Decision: (a) Read-only Equip + dev seed.** A read-only "Equip" page per House lists current
members (FR-006), fed by a dev seed with fictional people. Membership/transfer logic lives in
a tested domain module; forms come with SPEC-002.

### Q5. How to enforce one House at a time (BR-002) and temporal membership?
Options: (a) Postgres exclusion constraint + domain check; (b) domain check only in a
serializable transaction; (c) `Employee.currentHouseId` + history table.
**Decision: (a) DB exclusion constraint + domain check.**

```
HouseMembership
  employee_id  ──▶ Employee
  house_id     ──▶ House
  starts_on    date  (inclusive)
  ends_on      date? (inclusive, null = current)

EXCLUDE USING gist (
  employee_id WITH =,
  daterange(starts_on, ends_on, '[]') WITH &&
)
```

Requires `btree_gist`, added in a hand-edited migration (Prisma cannot express exclusion
constraints). The domain module checks first to give a friendly error.

## Validated design

### Section 1: Data model (approved)

- **House**: `id`, unique `slug` (`paulo-freire`, `carme-aymerich`), `name`. The two rows are
  inserted by the migration itself so every environment has them. A code constant `HOUSES`
  (`src/lib/houses.ts`) mirrors slugs and names for routing and the proxy (which must not
  touch the DB).
- **Employee**: `id`, `fullName`. Nothing else: no contact data, no Clerk link (SPEC-002).
- **HouseMembership**: `employeeId`, `houseId`, `startsOn` (date, inclusive), `endsOn` (date,
  inclusive, null = ongoing). Check `endsOn >= startsOn`. `EXCLUDE USING gist` blocks overlaps
  per employee (BR-002).
- **"Current"** = membership where `startsOn <= today <= coalesce(endsOn, +inf)`, with
  *today* computed in **Europe/Madrid** (otherwise a 1 July transfer flips at 02:00 UTC).
- **Transfer** = close the current row (`endsOn` = last day) + open a new one, in one
  transaction. Never edits past rows. Can be recorded ahead of time.
- **BR-004 becomes a contract for future specs**: every House-scoped record (AP, vacation,
  absence, coverage) stores its own `houseId` at creation time. Never derived from the
  employee's current membership, so a transfer cannot move history.
- **Cross-House work (BR-005/007/008) and corretor (FR-009)**: no new tables. Guaranteed by
  membership being its own table; a future `CoverageAssignment` / role assignment references
  employee + House without touching membership. Corretor becomes a role-at-a-House in SPEC-002.

### Section 2: Routing, House context and UI (approved)

- Routes under `src/app/(app)/`:
  - `[house]/layout.tsx`: awaits `params`, resolves the House by slug (`notFound()` for
    unknown), renders the top bar with House switcher + section nav.
  - `[house]/page.tsx`: **Inici**, House-scoped placeholder greeting.
  - `[house]/equip/page.tsx`: **Equip**, read-only list of current members of the active
    House with their "since" date (`tabular-nums`).
  - `/dashboard` redirects to the cookie's House, else Paulo Freire (kept because Clerk's
    after-sign-in redirect points there).
  - Future sections become `[house]/<section>` and inherit the scope (FR-004, FR-005).
- **Active House = URL.** The proxy sets `active-house` (httpOnly, sameSite lax, 1 year)
  whenever the first path segment is a known slug. Only a "last visited" preference, never
  an authorization input.
- **Switching** (FR-003) is a plain link that swaps the first segment and keeps the section
  (`/paulo-freire/equip` → `/carme-aymerich/equip`). No write, so no business data can
  change (EC-001).
- **House-scoped queries** receive the resolved House `id` from the layout via a small helper;
  no query reads the cookie.
- **UI per DESIGN.md**:
  - Top bar (desktop): house mark + wordmark, then a **two-option segmented control**
    ("Paulo Freire · Carme Aymerich"). With two Houses, showing both makes the active one
    unmistakable (FR-002). Active = Salvia clara selected surface + Espresso text; **not honey**.
    Nav pills: Inici, Equip.
  - Mobile: segmented control in the top title area; **bottom tab bar** with Inici, Equip.
  - Page header: micro uppercase eyebrow with the House name ("PAULO FREIRE") above a Fraunces
    h1 ("Equip").
  - Equip empty state: clay house mark + "Encara no hi ha ningú a l'equip de Paulo Freire."
  - Former members (EC-002) are not listed yet; `membersOn(houseId, date)` already supports
    history and is tested, so a "Membres anteriors" view is a later addition.

### Section 3: Access, domain module, testing, GDPR (approved)

- **Access**: `requireDirector()` in `src/lib/auth.ts` builds on `requireUser()` and checks
  `currentUser().publicMetadata.role === 'director'`. `(app)/layout.tsx` checks it once; a
  non-director gets a warm **"Sense accés"** page (icon + text, user button to sign out)
  instead of the House area. Server-side data helpers also call it so a future server action
  cannot bypass it. SPEC-002 replaces the flag with real roles.
- **Domain module** `src/lib/house-membership.ts` (pure TS, no Prisma):
  - `todayInMadrid()` and date helpers on plain `YYYY-MM-DD` dates.
  - `isActiveOn(membership, date)`; `membersOn(memberships, houseId, date)` for current
    (FR-006) and historical (FR-007, EC-002) membership.
  - `findOverlap(existing, candidate)` mirrors the DB constraint for friendly errors.
  - `planTransfer(current, toHouseId, startsOn)` → `{ close, open }`; rejects same-House
    transfers and start dates on or before the current start.
  - Thin Prisma layer `src/server/houses.ts` does reads and runs `planTransfer` in a
    transaction. No transfer UI; the seed exercises it.
- **Dev seed** `prisma/seed.ts`, fictional people only: Ana (PF, then CA from 1 July: the
  transfer scenario), Marta (CA), plus two more per House including a CT and an ER (as plain
  names; roles later).
- **Testing (Vitest)**: unit tests for the domain module (scenarios 4, 5, 8, EC-002), slug
  lookup, switcher path rewrite, `/dashboard` redirect choice, proxy cookie logic (as pure
  functions); component tests for the switcher and Equip list. The DB exclusion constraint is
  verified by a manual task against the dev DB (insert an overlap, expect an error); no test
  database exists yet: recorded as a known gap.
- **GDPR**: new personal data = employee full names + House membership dates. No health data.
  Supabase EU, director-only. Employee delete cascades to memberships (erasure path).
  Retention policy (how long after leaving) deferred to SPEC-002 with the employee lifecycle;
  recorded as an open question.

## Spec review answers (2026-10-04)

- **Retention** after someone leaves: start simple, defer. A GDPR review happens at the end of
  the first deliverable.
- **ER standing in for the director**: platform access is only for the director and the
  developer (users with the Clerk public metadata flag). No ER has access for now, so BR-008
  is a domain rule only.
- **Slugs**: `paulo-freire` and `carme-aymerich` are the real-world House names; permanent.

## Trade-offs noted

- **URL segment vs. cookie**: URL adds a dynamic segment to every route, but makes the context
  explicit and impossible to lose on navigation; cookie-only would hide it and break multi-tab use.
- **Exclusion constraint**: needs a hand-edited migration and `btree_gist`, a Postgres-specific
  feature Prisma will not show in `schema.prisma`; accepted because the invariant is
  foundational and must hold even outside the app.
- **`HOUSES` constant + DB rows**: two sources for slugs; accepted because the proxy cannot
  query the DB. A test keeps them aligned with the migration's inserted rows.
- **Director flag in Clerk metadata**: manual setup, temporary; replaced by SPEC-002 roles.
- **No transfer/profile UI**: data enters via seed only in dev; real data waits for SPEC-002.
