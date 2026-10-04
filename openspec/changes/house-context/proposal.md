## Why

The director manages two Cases d'Infants, Paulo Freire and Carme Aymerich, each with its own team. Every upcoming feature (APs, calendar, vacations, absences, coverage) must be scoped to one House, and a person's House can change over time without rewriting history. The app is still a bare skeleton with no domain model, so the House boundary and dated membership must exist before any feature is built on top of them.

## What Changes

- Add the first domain models: `House` (two rows inserted by the migration), `Employee` (name only) and dated `HouseMembership` with a Postgres exclusion constraint so an employee can never belong to two Houses at once.
- Add House-scoped routing: `/[house]/...` (e.g. `/paulo-freire/team`). The URL holds the active House; the proxy remembers the last visited House in a cookie used only to redirect `/dashboard`.
- Add a House switcher (two-option segmented control) in the top bar that keeps the current section when switching, plus section nav (Inici, Equip) on desktop and a bottom tab bar on mobile.
- Add a read-only **Equip** page listing the active House's current members.
- Add a pure domain module for membership (current/historical members, overlap check, transfer planning, "today" in Europe/Madrid) and a thin Prisma data layer.
- Add a temporary `requireDirector()` guard based on Clerk `publicMetadata.role = 'director'`; non-directors see a "Sense accés" page.
- Add a dev seed with fictional people, including a transfer.
- Record that every future House-scoped record stores its own `houseId` at creation time (BR-004 contract).

**Adapted from SPEC-001 (user's original spec):**
- Employee and dated membership are pulled into this change (SPEC-001 §9 assigned them to SPEC-002, but its Definition of Done needs them). SPEC-002 keeps roles/positions and the Clerk link.
- FR-008, FR-009 and BR-005..BR-008 (corretor, cross-House coverage, ER supervision) are satisfied as structural guarantees (membership is its own table), not as entities. They become features in later specs.

## Non-goals

- Employee profile management, add/edit forms, transfer workflow UI.
- Roles and positions (CT, ER, director as a modelled role), role assignment lifecycle.
- Corretor association per House, coverage assignments, director delegation.
- Schedules, APs, vacations, absences (including sick leave), holidays, hours accounting.
- Listing former members in the UI (supported by the domain module only).
- A separate production Supabase project (dev database only).

## Capabilities

### New Capabilities
- `house-context`: the two Houses, the active House held in the URL, switching, preservation across navigation, House-scoped pages and the director-only access gate (`/no-access`).
- `house-membership`: employees and their effective-dated House membership, one House at a time, transfers that never rewrite history, current vs. historical team members, and the rule that temporary cross-House work is not membership.

### Modified Capabilities
<!-- None: openspec/specs/ is empty. -->

## Personal data and GDPR

- **New personal data**: employee full names and House membership dates (start/end). No health data and no absence data in this change.
- **Residency**: stored in Supabase Postgres, EU region (`eu-west-1`, dev project).
- **Access**: only signed-in users with the Clerk `director` flag can see House pages or call the data layer. For now that is the director and the developer; no other staff have platform access.
- **Minimisation**: Employee holds only a full name; no contact details, no identifiers.
- **Erasure**: deleting an Employee cascades to their memberships.
- **Retention**: how long data is kept after someone leaves is deliberately deferred to a GDPR review at the end of the first deliverable.
- **Dev seed**: fictional names only.

## Impact

- `prisma/schema.prisma`, first migration (hand-edited for `btree_gist` + exclusion constraint + House rows), `prisma/seed.ts`, `package.json` (seed config).
- `src/proxy.ts` (active-house cookie), `src/lib/auth.ts` (`requireDirector`), new `src/lib/houses.ts`, `src/lib/house-membership.ts`, `src/server/houses.ts`.
- Routes: `src/app/(app)/[house]/layout.tsx`, `[house]/page.tsx`, `[house]/team/page.tsx`; `/dashboard` becomes a redirect; new `/no-access` page (the access gate).
- Components: House switcher, section nav / bottom tab bar, no-access page, Equip list.
- Clerk dashboard: set `publicMetadata.role = "director"` on the director's user by hand.
