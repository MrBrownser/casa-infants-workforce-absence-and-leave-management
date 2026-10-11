## Why

After two specs the director still had no screen for her daily work: vacations, APs, sick leave and the monthly rota. SPEC-002 (roles, dated assignments, grants) grew far beyond the need and was never merged. Static prototypes built from her spreadsheet were validated with her instead (Saldos approved: "M'agrada, ho faria servir"). This change resets `main` toward those prototypes: it keeps auth, routes and Houses, replaces dated memberships with a simple "who covers each post" model, and records the whole domain so the next specs (Saldos, El mes, Vacances) can be built quickly and correctly.

## What Changes

**People model**
- From: `Employee` plus dated `HouseMembership` periods, a Postgres exclusion constraint and transfer logic (SPEC-001).
- To: a `Person` with a name, a House, a post of that House and an active flag, edited in place; plus per-year opening balances (vacation days, AA days, calendar surplus).
- Reason: the director manages who covers each fixed post; dated history and transfers add complexity she does not need.
- Impact: breaking for the database (single clean initial migration, dev database reset). No production database exists yet.

**Domain in code**
- New: posts per House, shifts with (provisional) times and the AP and vacation constants live in `src/lib/`. Changing them is a code change. Public holidays are documented now and coded with SPEC-005, the first spec that uses them.

**Equip page**
- From: a read-only list of current members with "Des del <date>".
- To: the posts of the House with the person covering each one (or "Vacant"); add a person, rename, move to another post or House, mark as inactive or reactivate, and edit opening balances per year.

**Navigation**
- From: Inici and Equip.
- To: Saldos, Vacances, El mes and Equip. The first three show "aviat" (coming soon) until their spec ships; the House home redirects to the first available section.

**Domain reference**
- New `docs/domain.md`: every concept and rule learned from the spreadsheet, the prototypes and the director, with open questions. The prototypes (`public/prototypes/`) become the approved UI reference for later specs.

**Not merged**
- SPEC-002 (`feat/roles-and-position-assignments`) stays unmerged as a reference branch.

## Non-goals

- Recording APs, vacations, sick leave, the rota or the vacation plan (SPEC-004 Saldos, SPEC-005 El mes, SPEC-006 Vacances).
- Roles, permissions or access for anyone other than the director and the product owner.
- Dated membership history, scheduled transfers, cross-House coverage.
- Editing posts, shifts, rules or holidays from the UI.
- Staff self-service, notifications, imports from the spreadsheet.

## Personal data (GDPR)

- New personal data: a person's full name, House, post, active flag and opening balances (vacation days, AA days, calendar surplus in hours). No contact, identity, contract or health data. Sick leave arrives in SPEC-005 and will be stored only as "Baixa" with dates, never a reason (Art. 9).
- Residency: Supabase Postgres in the EU, as today.
- Access: only users with the Clerk `director` flag, checked in every page, data function and Server Function.
- Retention: marking a person inactive keeps their data. A retention period and an erasure procedure must be defined in the privacy review before the first operational use; this change adds no deletion button.

## Capabilities

### New Capabilities
- `people-and-posts`: posts per House defined in code, the people who cover them, active and inactive people, and per-year opening balances, managed from the Equip page.

### Modified Capabilities
- `house-context`: section navigation changes to Saldos, Vacances, El mes and Equip, sections not yet built are shown as "aviat", and the House home redirects to the first available section.
- `house-membership`: removed. Dated membership, the one-House-at-a-time constraint, transfers and historical membership are replaced by `people-and-posts`. The rule that House-scoped records keep their own House moves to `people-and-posts`.

## Impact

- Database: `prisma/schema.prisma` rewritten (`House`, `Person`, `PersonYear`); the `house_context` migration replaced by one initial migration; `prisma/seed.ts` rewritten with fictional people from the prototypes; the dev database must be reset.
- Code removed: `src/lib/house-membership.ts`, `src/server/membership-store.ts`, `src/components/team-list.tsx` and their tests; `transferEmployee` in `src/server/houses.ts`.
- Code added: `src/lib/posts.ts`, `src/lib/shifts.ts`, `src/lib/rules.ts`, `src/lib/hours.ts`, a people data layer with Server Functions, the new Equip page and forms, section navigation changes.
- Docs: `docs/domain.md`, `AGENTS.md`, `README.md`, `openspec/config.yaml` context.
- No new dependencies.
