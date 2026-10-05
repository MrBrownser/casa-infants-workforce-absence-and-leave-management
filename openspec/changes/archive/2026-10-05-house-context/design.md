## Context

Casa d'Infants is a time and leave app for two Houses, **Paulo Freire** (PF) and **Carme Aymerich** (CA). The director manages both; each House has its own team and its own corretor (CT). The user's SPEC-001 establishes the House as the primary operational boundary. This design adapts it to the repo (decisions Q1 to Q5 in `brainstorm.md`).

Current state: Next.js 16 App Router skeleton. No Prisma models, `requireUser()` with no roles, `(app)/dashboard` placeholder, `TopBar` with breadcrumb and action slots, no nav. Next 16 calls middleware `proxy` (`src/proxy.ts`, Clerk). Cookies cannot be set during Server Component rendering, but the proxy can set response cookies. `params` is a Promise in layouts and pages.

Constraints: UI copy in Catalan, code in English; DESIGN.md (no sidebar, honey only for pending decisions, Fraunces for headings at 20px and above only); GDPR (EU residency, minimisation); Prisma 7 with the `PrismaPg` adapter on Supabase (pooled at runtime, direct for migrations).

Stakeholders: the director (only user for now); later, educators and the ER standing in for the director.

## Goals / Non-Goals

**Goals:**
- The two Houses exist in every environment and in code.
- One active House at a time, visible, switchable without writes, and preserved across navigation.
- Every future House-specific route inherits the House scope just by living under `[house]/`.
- Employees have dated membership. Overlaps are impossible at the DB level, transfers never rewrite past rows, and "current" is computed in Europe/Madrid.
- Cross-House work and the corretor can be added later without touching membership.
- Only the director can see House data.

**Non-Goals:**
- Employee or transfer forms, roles and positions, the corretor association, coverage, delegation, schedules, APs, vacations, absences, holidays.
- A "former members" view (the domain module supports it; there's no UI yet).
- A test database or DB integration test harness.

## Decisions

### D1: Pull minimal Employee + dated membership into this change
- **Choice**: Add `Employee(id, fullName)` and `HouseMembership(employeeId, houseId, startsOn, endsOn?)` now. Roles/positions, the Clerk link and the corretor stay in SPEC-002.
- **Why**: SPEC-001's Definition of Done (current employees scoped by House, preserved history) can't be built or tested without them. Membership is the House-scoping primitive.
- **Alternatives**: House context only (nothing House-scoped to show, DoD unmet). Model coverage and the corretor too (structures built ahead of the specs that use them).

### D2: Active House lives in the URL; a cookie remembers the last one
- **Choice**: Routes are `src/app/(app)/[house]/...` with slugs `paulo-freire` and `carme-aymerich`. When the first path segment is a known slug, the proxy sets `active-house` (httpOnly, `sameSite: lax`, `secure` in production, `path: /`, 1 year). `/dashboard` redirects to the cookie's House if valid, otherwise to `paulo-freire`.
- **Why**: The context is explicit, bookmarkable and works in several tabs, and server components read it from `params`. The proxy is the only place outside Server Functions that can set cookies on a plain navigation. The cookie never authorizes anything.
- **Alternatives**: Cookie only (invisible context, one House per browser). Clerk metadata or a DB preference (a write on every switch, no House in URLs).

### D3: `HOUSES` constant in code plus House rows inserted by the migration
- **Choice**: `src/lib/houses.ts` exports `HOUSES = [{ slug: 'paulo-freire', name: 'Paulo Freire' }, { slug: 'carme-aymerich', name: 'Carme Aymerich' }] as const`, plus `findHouseBySlug`, `isHouseSlug` and `DEFAULT_HOUSE_SLUG`. The first migration inserts matching `House` rows. A unit test parses the migration SQL and asserts the slugs match the constant.
- **Why**: The proxy must not hit the DB. The rows give foreign keys a target and make prod self-seeding.
- **Alternatives**: DB only (proxy can't validate slugs). Constant only (no foreign keys for future records).

### D4: Exclusion constraint for one House at a time
- **Choice**: The migration enables `btree_gist` and adds `EXCLUDE USING gist (employee_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)` and `CHECK (ends_on IS NULL OR ends_on >= starts_on)`. Dates are `@db.Date`, both bounds inclusive, null `ends_on` meaning ongoing. The migration is created with `prisma migrate dev --create-only` and edited by hand.
- **Why**: BR-002 is foundational and must hold even for SQL edits and concurrent writes.
- **Alternatives**: A domain check only in a serializable transaction (bypassable). `Employee.currentHouseId` plus history (two sources of truth).

### D5: Pure domain module plus a thin data layer
- **Choice**: `src/lib/house-membership.ts` has no Prisma and works on plain `YYYY-MM-DD` strings (`IsoDate`):
  - `todayInMadrid(now?)` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })`.
  - `isActiveOn(m, date)`.
  - `membersOn(memberships, houseId, date)` returns the employee ids active in that House on that date.
  - `findOverlap(existing, candidate)`.
  - `planTransfer(current, toHouseId, startsOn)` returns `{ close: { id, endsOn }, open: { employeeId, houseId, startsOn } }`. `endsOn` is the day before `startsOn`. It throws `TransferError` for the same House, for `startsOn <= current.startsOn`, or for a current row that already has an `endsOn`.

  `src/server/membership-store.ts` (no auth, no `server-only`, takes the Prisma client as a parameter) has `applyTransfer(db, employeeId, toHouseId, startsOn)`, which runs `planTransfer` inside `db.$transaction`, plus the row mappers. `src/server/houses.ts` (`server-only`) has `getHouseBySlug`, `listCurrentMembers(houseId, date)` and `transferEmployee(...)`. Each calls `requireDirector()` first and then delegates to the store with the app's client. The seed uses `membership-store.ts` directly with its own client, because `server-only` cannot be imported outside Next.
- **Why**: The rules are testable without a DB, and the data layer stays small. The DB constraint is the backstop.
- **Alternatives**: Logic inside Prisma queries (hard to test). A full repository abstraction (YAGNI).

### D6: Director gate via Clerk public metadata
- **Choice**: `requireDirector()` in `src/lib/auth.ts` returns `{ userId, name }` when `currentUser().publicMetadata.role === 'director'`. Otherwise it calls `redirect('/no-access')`, which throws and stops the caller. `isDirector(user)` is a pure helper for tests. Every House page, the `[house]` layout, `/dashboard` and every function in `src/server/houses.ts` call it. `src/app/(app)/no-access/page.tsx` renders a `NoAccess` component ("Sense accés", icon + text, `UserButton` in the top bar) and does not call `requireDirector()`.
- **Why**: Employee names become personal data now, and the sign-up page is open. This is the smallest guard that holds until SPEC-002 brings real roles. Next.js renders layouts and pages **in parallel**, so a gate that only lives in a parent layout does not stop a child page's data query. Each page and data function must check for itself.
- **Alternatives**: A gate only in `(app)/layout.tsx` (leaks because of parallel rendering). `forbidden()` (still experimental in Next 16, needs `experimental.authInterrupts`). Relying on closing sign-ups in Clerk (configuration, not code; easy to undo by mistake).

### D7: House switcher as links that keep the section
- **Choice**: A `HouseSwitcher` client component uses `usePathname()` and a pure `switchHousePath(pathname, toSlug)` that swaps the first segment (`/paulo-freire/team` becomes `/carme-aymerich/team`). It renders a two-option segmented control of `Link`s with `aria-current="page"` on the active one. The active style is the `secondary` (Salvia clara) surface with `foreground` text; never `accent` (honey). It sits in the top bar on desktop and in the top title area on mobile.
- **Why**: With two Houses, both options visible at once make the active House obvious (FR-002). Plain links mean switching writes nothing (FR-003, EC-001).
- **Alternatives**: A dropdown (hides the other House, extra click). A server action plus redirect (an unneeded write path).

### D8: Section nav and House-scoped pages
- **Choice**:
  - `[house]/layout.tsx` awaits `params`, calls `findHouseBySlug` (`notFound()` if unknown), renders `TopBar` with the switcher and `SectionNav` (Inici, Equip), and on mobile a `BottomTabBar` with the same items.
  - `SectionNav` builds hrefs from the active slug.
  - `[house]/page.tsx` shows the eyebrow (House name, micro uppercase) and the h1 "Inici".
  - `[house]/team/page.tsx` shows the eyebrow and h1 "Equip", then the list of current members (name plus "Des del <date>", `tabular-nums`, Catalan date format) in a `rounded-2xl` `shadow-clay` panel. When empty, it shows the house mark and "Encara no hi ha ningú a l'equip de <House>."
- **Why**: Follows DESIGN.md (no sidebar, top bar on desktop, bottom tab bar on mobile). Future sections slot in as `[house]/<section>`.

### D9: BR-004 contract for future House-scoped records
- **Choice**: Written into the `house-membership` spec as a requirement: House-scoped records store their own `houseId` set at creation time and never derive it from current membership.
- **Why**: Keeps BR-004 true by construction once APs, vacations and coverage exist.

## Risks / Trade-offs

- [Risk] The hand-edited migration drifts from `schema.prisma`, because Prisma doesn't model exclusion constraints, and a later `migrate dev` could try to "fix" the drift. → Mitigation: add a comment in `schema.prisma` pointing to the migration. Prisma ignores constraints it doesn't know about; verify `migrate dev` stays clean after the change.
- [Risk] `btree_gist` isn't enabled on Supabase. → Mitigation: `CREATE EXTENSION IF NOT EXISTS btree_gist` in the migration (it's available on Supabase).
- [Risk] Nothing automated covers the exclusion constraint (no test DB). → Mitigation: a manual verification task against the dev DB. Recorded as a known gap for verify §7.
- [Risk] `HOUSES` and the DB rows diverge. → Mitigation: a unit test checks the migration SQL against the constant.
- [Risk] The proxy cookie set on every House request adds a `Set-Cookie` header. → Mitigation: only set it when the value changes.
- [Trade-off] A director flag in Clerk metadata is manual setup. → Accepted as temporary until SPEC-002.
- [Trade-off] Without forms, real data can't be entered yet. → Accepted; this change is a foundation, and the seed covers dev.

## Migration Plan

1. `prisma migrate dev --create-only --name house_context`, then hand-edit: `CREATE EXTENSION IF NOT EXISTS btree_gist`, the CHECK and EXCLUDE constraints, and `INSERT` the two Houses.
2. Apply to the dev DB (`npm run db:migrate`), then run the seed (`npx prisma db seed`).
3. Set `publicMetadata.role = "director"` on the director's Clerk user.
4. Deploy. Rollback: revert the app commit. The migration only adds tables, so it can stay, or be dropped by a follow-up migration if abandoned.
5. Production (its own Supabase project, later) gets the same migration. The seed runs only in dev.

## Open Questions

None blocking. Questions resolved during review (2026-10-04):

- **Retention**: deferred on purpose. A GDPR review (including retention after someone leaves) is scheduled at the end of the first deliverable.
- **Who has access**: only the director and the developer, both flagged with `publicMetadata.role = "director"` in Clerk. No ER or educator has platform access for now, so an ER standing in for the director is a domain concept only (BR-008), not an access concern.
- **Slugs**: `paulo-freire` and `carme-aymerich` are the real House names and are the permanent URL slugs.
