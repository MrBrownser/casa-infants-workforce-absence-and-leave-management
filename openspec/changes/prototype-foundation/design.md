## Context

- `main` holds SPEC-001: two Houses in the URL (`/paulo-freire`, `/carme-aymerich`) with a switcher and an `active-house` cookie, Clerk auth in Catalan, `requireDirector()` reading the Clerk `publicMetadata.role === 'director'` flag, a Catalan 404 and "Sense accés", `todayInMadrid()`, and a dated `Employee` + `HouseMembership` model with an exclusion constraint and transfer logic. The Equip page lists current members read-only.
- SPEC-002 (roles, positions, dated assignments, grants, receipts, triggers) was built on `feat/roles-and-position-assignments` and never merged. It is not the base of this change.
- The director validated static prototypes in `public/prototypes/` (Saldos approved; Vacances and El mes being reviewed). They are the approved UI for the product. `brainstorm.md` records how they were built from her spreadsheet and every decision taken.
- Stakeholders: the director (only user, manages both Houses one at a time) and the product owner (developer, also has the director flag).
- Constraints: Catalan UI, English code; `DESIGN.md`; GDPR (EU data, minimum data, no sick-leave reasons); Next.js 16 conventions (`proxy.ts`, async `params`); no production database exists yet.

## Goals / Non-Goals

**Goals:**
- Give the app the data foundation every later screen needs: who covers each post in each House, and each person's opening balances per year.
- Keep the domain (posts, shifts, rules) in code, where it is simple to read, test and change.
- Replace the dated membership model with a model the director understands, without losing the rule that House-scoped records keep their own House.
- Set the navigation to the final sections so later specs only fill them in.
- Leave enough written context (`docs/domain.md`, prototypes, feedback log) for agents implementing SPEC-004 to SPEC-006.

**Non-Goals:**
- Any AP, vacation, sick leave, rota or vacation-plan data or screen.
- Roles, permissions, delegation, staff accounts.
- Membership history, scheduled transfers, cross-House coverage.
- UI to edit posts, shifts, rules or holidays.

## Decisions

### D1: Start from `main`; SPEC-002 stays unmerged
- **Choice**: the working branch is rebuilt from `main`; the prototype commits are carried over; SPEC-002 is not merged.
- **Rationale**: `main` already contains what we keep (auth, routes, Houses, 404, dates, design). Nothing has to be reverted.
- **Alternatives considered**: merge SPEC-002 and delete most of it (large, risky diff); reset to the first skeleton commit (loses tested Houses, switcher, 404 and dates).

### D2: Posts are fixed per House in code
- **Choice**: `src/lib/posts.ts` exports, per House slug, an ordered list of posts `{ key, label, roleCode, shiftKey }`. `key` is stable and unique within the House (for example `en-1`, `en-2`, `ct`); `label` is Catalan ("Educadora de nit 1", "Corretorn"); `roleCode` is one of PDG, PSI, ER, TFM, TFT, ET, ECS, EN, CT. The first inventory is the prototypes' one (Paulo Freire 11 posts, Carme Aymerich 10), marked provisional in code and in `docs/domain.md` until the director confirms it.
- **Rationale**: the product owner decided posts are fixed and only the people change. A constant is trivially testable and versioned.
- **Alternatives considered**: a `positions` table editable from the UI (SPEC-002's approach): more code, migrations and screens for data that does not change.

### D3: Shifts in code, times optional for now
- **Choice**: `src/lib/shifts.ts` exports the shifts in display order: `mati` (Matí), `tarda` (Tarda), `referents` (Referents), `tecnic` (Equip tècnic), `cap-de-setmana` (Cap de setmana i festius), `nit` (Nit) and `ct` (Corretorn). Each has an optional `startsAt` / `endsAt` (`'HH:MM'`) and a note. Only the night (about 22:00 to 10:30) and the weekend day (about 10:30 to 22:15) are known from the spreadsheet; the rest stay `null` and are not shown. Arrivals are staggered, so a shift may later need several start times; the type allows a list.
- **Rationale**: Equip groups posts by shift today; SPEC-005 (El mes) builds the rota on the same definitions.
- **Alternatives considered**: waiting for exact times (blocks the spec for data that only affects SPEC-005).

### D4: A simple `Person`, edited in place
- **Choice**: table `people`: `id`, `full_name`, `house_id` (FK to `houses`), `post_key`, `started_on` (date, optional), `active` (boolean), `created_at`, `updated_at`. `post_key` is validated by the application against the House's inventory (it lives in code, so there is no FK). A partial unique index allows **one active person per post per House**. Moving a person to another post or House updates the row; leaving sets `active = false` and keeps the last post for reference.
- **Rationale**: matches how the director thinks ("who covers this post"). A vacancy is simply a post with no active person.
- **Alternatives considered**: keep dated memberships and add assignments (SPEC-001/002): rejected by the product owner as complexity without a user need.

### D5: House-scoped records keep their own House
- **Choice**: carried over from SPEC-001 as a contract for later specs: every AP, vacation, sick leave, rota change or plan entry stores `house_id` when it is created and never derives it from the person's current House.
- **Rationale**: moving a person to the other House must not move their history.

### D6: Opening balances per person and year
- **Choice**: table `person_years`: `person_id`, `year`, `vacation_days` (entitlement for the year), `carried_days` (AA), `surplus_hours` (numeric, hours, calendar surplus at the start of the year, may be negative), unique `(person_id, year)`. When no row exists, the default is shown: vacation days prorated from `started_on` (31 for a full year; `round(31 × days from start to 31/12 / days in year)`, which gives 16 for a 1 July start), 0 AA, 0 h. Saving creates the row. CHECKs: days between 0 and 31 + a margin for AA, year within a sane range.
- **Rationale**: Saldos cannot compute anything without these numbers; today they live in the spreadsheet.
- **Alternatives considered**: storing them on `people` (breaks with a new year); computing AA automatically from last year (needs SPEC-004/006 data; later).

### D7: Hours input in both formats
- **Choice**: `src/lib/hours.ts` ports the prototype's parser (`3:45`, `3h45`, `3,75`, `3.75`, `8`) and formatter (`3 h 45 min`, signed for the surplus). Used now for `surplus_hours`, later by Saldos.
- **Rationale**: the director asked to keep both formats.

### D8: Navigation with the final sections
- **Choice**: `SECTIONS` becomes Saldos (`saldos`), Vacances (`vacances`), El mes (`mes`) and Equip (`team`), each with an `available` flag. Unavailable sections render as non-links with an "aviat" tag (desktop) or dimmed (mobile tab bar). `/<house>` redirects to the first available section (Equip until Saldos ships). The Inici placeholder page is removed.
- **Rationale**: later specs only flip a flag and add a route; the director sees where the app is going.

### D9: Equip page and its writes
- **Choice**: `/<house>/team` lists the House's posts grouped by shift, each with its active person or "Vacant", plus an "Antics membres" list of inactive people of that House. Actions: add a person to a vacant post (name, optional start date), rename, move to another post or House (rejected with a Catalan message naming the occupant if the target post is taken; no implicit swap), mark inactive, reactivate into a vacant post, and edit the opening balances of a year. One zod schema per form shared by client and server (react-hook-form). Server Functions live in `src/app/(app)/[house]/team/actions.ts`; each calls `requireDirector()`, resolves the House from the route and checks the person belongs to it. Errors carry an icon and text; fields keep their values.
- **Rationale**: same patterns as the existing code and `DESIGN.md`; the look follows the prototypes (cards, sheets, `dd/mm/aaaa` dates).

### D10: One clean initial migration
- **Choice**: delete `20261005092628_house_context` and create one migration with `houses` (seeded rows), `people` (partial unique index written by hand) and `person_years` (CHECKs). Reset the dev database. Rewrite `prisma/seed.ts` with the prototypes' fictional people.
- **Rationale**: no production data exists; a single readable migration is easier for every later spec.
- **Alternatives considered**: a second migration that drops the membership tables (history with no value).

### D11: Written context for later specs
- **Choice**: add `docs/domain.md` (glossary with Catalan terms, AP rules, vacation rule with the FASI table, surplus, sick leave and GDPR, rota and coverage, the CT "corretorn", the vacation negotiation, public holidays 2026 and 2027, open questions) and link it, the prototypes and `docs/prototypes/director-feedback.md` from `AGENTS.md`, `README.md` and `openspec/config.yaml`.
- **Rationale**: the product owner asked that agents implementing the next specs have the same context this session had.

### D12: Testing
- **Choice**: Vitest unit tests for the posts inventory (unique keys, valid role and shift codes), proration, hours parsing, the zod schemas and the navigation; component tests for the Equip list (vacant posts, inactive people); Server Function tests with mocked auth and data layer (non-director redirected, House mismatch rejected, occupied post rejected). The partial unique index is checked by hand against the dev database and recorded in `verify.md`.
- **Alternatives considered**: bringing SPEC-002's real-database harness (useful later, but large for one index).

## Risks / Trade-offs

- [Risk] The provisional post inventory or shift times are wrong → Mitigation: they are constants in one file, marked provisional; the seed and tests read them, so a correction is a small code change.
- [Risk] Editing a person in place loses "who covered this post last year" → Mitigation: later records store the person and House themselves (D5), so history lives in the records, not in the person.
- [Risk] Resetting the dev database removes SPEC-002's tables and the current fictional data → accepted: no real data exists; the seed recreates fictional people.
- [Trade-off] No database-level check that `post_key` exists in the code inventory → accepted: the application validates it on every write and only the director writes.
- [Trade-off] Prorating rounds to whole days and may differ from FASI's own calculation → the director can overwrite the value; open question recorded.

## Migration Plan

1. On the working branch (from `main`): replace the schema and the migration, rewrite the seed.
2. Reset the dev database (`prisma migrate reset`) and run the seed; check the partial unique index by hand.
3. Deploy to a Vercel preview with the dev database; the director flag stays as today.
4. Production: create the EU production Supabase project, apply the single migration, set the director flag on the director's Clerk account. No data migration is needed.
5. Rollback: the change is one branch; `main` stays deployable until it is merged.

## Open Questions

- Real post inventory of each House and exact shift times (staggered arrivals).
- FASI's exact proration formula for people who start mid-year, and how AA days are used.
- Retention period and erasure procedure for inactive people (privacy review before first operational use).
