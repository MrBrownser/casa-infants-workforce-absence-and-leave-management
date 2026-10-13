## Context

- `main` holds SPEC-001: two Houses in the URL (`/paulo-freire`, `/carme-aymerich`) with a switcher and an `active-house` cookie, Clerk auth in Catalan, `requireDirector()` reading the Clerk `publicMetadata.role === 'director'` flag, a Catalan 404 and "Sense accés", `todayInMadrid()`, and a dated `Employee` + `HouseMembership` model with an exclusion constraint and transfer logic. The Equip page lists current members read-only.
- SPEC-002 (roles, positions, dated assignments, grants, receipts, triggers) was built on `feat/roles-and-position-assignments` and never merged. It is not the base of this change. Its validated post list (one per House: PDG, PSI, ER, TFM, TFT, ET, ECS, EN 1, EN 2, CT, with fictional occupants) is reused.
- The director validated static prototypes in `public/prototypes/` (Saldos approved; Vacances and El mes being reviewed). They are the approved UI for the product. `brainstorm.md` records how they were built from her spreadsheet and every decision taken. `docs/domain.md` is the domain reference.
- Stakeholders: the director (only user, manages both Houses one at a time) and the product owner (developer, also has the director flag).
- Constraints: Catalan UI, English code; `DESIGN.md`; GDPR (EU data, minimum data, no sick-leave reasons); Next.js 16 conventions (`proxy.ts`, async `params`); no production database exists yet.

## Goals / Non-Goals

**Goals:**
- Give the app the data foundation every later screen needs: who covers each post in each House, each post's weekly schedule, and each person's opening balances per year.
- Keep the domain (posts, schedules, rules) in code, where it is simple to read, test and change.
- Replace the dated membership model with the simplest model the director understands, to ship sooner and iterate.
- Set the navigation to the final sections so later specs only fill them in.
- Leave enough written context (`docs/domain.md`, prototypes, feedback log) for agents implementing SPEC-004 to SPEC-006.

**Non-Goals:**
- Any AP, vacation, sick leave, rota or vacation-plan data or screen.
- Roles, permissions, delegation, staff accounts.
- History of who covered each post and post changes planned for a future date (later spec).
- GDPR retention and erasure procedures (later spec, after research).
- UI to edit posts, schedules, rules or holidays.

## Decisions

### D1: Start from `main`; SPEC-002 stays unmerged
- **Choice**: the working branch is rebuilt from `main`; the prototype commits are carried over; SPEC-002 is not merged.
- **Rationale**: `main` already contains what we keep (auth, routes, Houses, 404, dates, design). Nothing has to be reverted.
- **Alternatives considered**: merge SPEC-002 and delete most of it (large, risky diff); reset to the first skeleton commit (loses tested Houses, switcher, 404 and dates).

### D2: Posts are fixed per House in code
- **Choice**: `src/lib/posts.ts` exports the role labels (PDG Pedagoga, PSI Psicòloga, ER Educadora referent, TFM Treballadora familiar de matins, TFT Treballadora familiar de tardes, ET Educadora de tardes, ECS Educadora de cap de setmana, EN Educadora de nit, CT Corretorn) the **shared posts** `pdg` and `psi` (no House: the Pedagoga and the Psicòloga work for both Houses), and, per House slug, the ordered posts `{ key, roleCode, seats, schedule }`: `er`, `tfm`, `tft`, `et`, `ecs`, `en` (2 seats), `ct`. Both Houses have the same seven own posts today (the list validated for SPEC-002, with PDG and PSI moved to shared after the product owner's review).
- **Rationale**: the product owner decided posts are fixed and only the people change. A constant is trivially testable and versioned.
- **Alternatives considered**: a `positions` table editable from the UI (SPEC-002): more code, migrations and screens for data that does not change.

### D3: A weekly schedule per post, invented for now
- **Choice**: each post has a weekly schedule: for each weekday (Monday to Sunday) a list of ranges `{ from: 'HH:MM', to: 'HH:MM' }` (a range ending earlier than it starts crosses midnight). The same schedule repeats every week; times may differ between weekdays. Weekday posts do not work public holidays; ECS works weekends and holidays; EN seats alternate by ISO week; CT has no fixed schedule. Invented, plausible times (marked provisional in code and in `docs/domain.md`), with staggered arrivals:

| Post | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| TFM | 07:30–15:00 | 07:30–15:00 | 07:30–15:00 | 07:30–15:00 | 07:30–15:00 | | |
| PDG (shared) | 09:00–15:00 | 09:00–15:00 | 09:00–15:00 | 09:00–15:00 | 09:00–15:00 | | |
| PSI (shared) | 09:00–15:00 | 14:00–20:00 | 09:00–15:00 | 14:00–20:00 | 09:00–15:00 | | |
| ER | 09:00–17:00 | 13:00–21:00 | 09:00–17:00 | 13:00–21:00 | 08:00–15:00 | | |
| ET | 14:00–22:00 | 14:00–22:00 | 14:00–22:00 | 14:00–22:00 | 14:00–22:00 | | |
| TFT | 15:00–22:00 | 15:00–22:00 | 15:00–22:00 | 15:00–22:00 | 15:00–22:00 | | |
| ECS | | | | | | 10:30–22:15 | 10:30–22:15 |
| EN | 22:00–08:00 | 22:00–08:00 | 22:00–08:00 | 22:00–08:00 | 22:00–10:30 | 22:00–10:30 | 22:00–08:00 |
| CT | Sense horari fix | | | | | | |

  The night and weekend day times come from the spreadsheet's `FESTIUS` tab; the rest are invented from the post names. Shared posts also say, per weekday, in which House they work (invented: odd ISO weeks Monday to Wednesday in Paulo Freire and Thursday and Friday in Carme Aymerich, even weeks the other way round; to confirm with the director).
- **Rationale**: the product owner prefers invented times visible in the UI (faster to correct) over empty ones. The schedule is also the base of SPEC-005's rota.
- **Alternatives considered**: separate "shifts" grouping several posts (the prototypes' Matí, Tarda, Equip tècnic rows): an invented concept the director never used; the rota rows become the posts themselves.

### D4: A simple `Person` with a seat
- **Choice**: table `people`: `id`, `full_name`, `house_id` (FK to `houses`, **null for a shared post**), `post_key`, `seat` (1 for most posts, 1 or 2 for EN), `started_on` (date, optional), `active` (boolean), `created_at`, `updated_at`. `post_key` and `seat` are validated by the application against the House's inventory (it lives in code, so there is no FK). Two partial unique indexes allow one active person per seat: `(house_id, post_key, seat) WHERE active AND house_id IS NOT NULL`, and `(post_key, seat) WHERE active AND house_id IS NULL` for shared posts. Moving a person updates the row; leaving sets `active = false` and keeps the last post and seat for reference.
- **Rationale**: matches how the director thinks ("who covers this post"), including the night post shared by two people. A vacancy is a seat with no active person.
- **Alternatives considered**: keep dated memberships and add assignments (SPEC-001/002): not needed yet; a history spec comes later. Two separate night posts ("EN 1", "EN 2"): the director sees one night post shared in alternate weeks.

### D5: Balances follow the person
- **Choice**: vacation days, AA days, APs and the calendar surplus belong to the person (`person_years` and, later, the person's AP and vacation records), never to a House. Moving a person keeps them. Records that belong to a House (rota changes and day notes, SPEC-005) will store `house_id`.
- **Rationale**: product owner: each person is entitled to their APs and vacations whatever House they are in.

### D6: Opening balances per person and year
- **Choice**: table `person_years`: `person_id`, `year`, `vacation_days`, `carried_days` (AA), `surplus_minutes` (integer, may be negative), unique `(person_id, year)`. When no row exists the default is shown: vacation days prorated from `started_on` (31 for a full year; `round(31 × days from start to 31/12 / days in year)`, 16 for 1 July), 0 AA, 0 min. Saving creates the row. CHECKs: non-negative days within a sane bound, year within a sane range.
- **Rationale**: Saldos cannot compute anything without these numbers. Minutes as integers avoid decimal rounding with `H:MM` input.
- **Alternatives considered**: storing them on `people` (breaks with a new year); computing AA automatically (needs SPEC-004/006 data; later).

### D7: One standard duration input
- **Choice**: a `DurationInput` component: a text field with a mask that only accepts `H:MM` (digits, the colon inserted automatically, minutes 00 to 59, hours may exceed 24), plus a + / − segmented choice when the value is a surplus. `src/lib/duration.ts` parses to and formats from integer minutes (`3 h 45 min`, signed for the surplus).
- **Rationale**: the product owner asked to standardise time entry instead of accepting several formats. shadcn's time picker is a native `<input type="time">`: it stops at 23:59, cannot be negative and shows AM/PM in some browser languages, so it does not fit durations such as a 55-hour surplus.
- **Alternatives considered**: the prototypes' free-text parser (`3:45`, `3,75`…): more ambiguity, and the director had no preference.

### D8: Navigation with the final sections
- **Choice**: `SECTIONS` becomes Saldos (`saldos`), Vacances (`vacances`), El mes (`mes`) and Equip (`team`), each with an `available` flag. Unavailable sections render as non-links with an "aviat" tag (desktop) or dimmed (mobile tab bar). `/<house>` redirects to the first available section (Equip until Saldos ships). The Inici placeholder page is removed.
- **Rationale**: later specs only flip a flag and add a route; the director sees where the app is going.

### D9: Equip page and its writes
- **Choice**: `/<house>/team` first lists the shared posts under "Compartits entre les dues cases" (the same on both Houses, editable from either), then the House's posts in inventory order, each with its role label, its weekly schedule (compact, for example "dl–dv 07:30–15:00") and the active people of its seats or "Vacant" (the night post shows its two people and "setmanes alternes"). An "Antics membres" list shows inactive people of that House so the director can reincorporate someone who comes back (for example after an excedència) with their balances. Actions: add a person to a vacant seat (name, optional start date), rename, move to a vacant seat of another post or House (rejected with a Catalan message naming the occupant if taken; no implicit swap), mark inactive, reactivate into a vacant seat, and edit the opening balances of a year. One zod schema per form shared by client and server (react-hook-form). Server Functions live in `src/app/(app)/[house]/team/actions.ts`; each calls `requireDirector()`, resolves the House from the route and checks the person belongs to it. Errors carry an icon and text; fields keep their values. Dates in `dd/mm/aaaa`.
- **Rationale**: same patterns as the existing code and `DESIGN.md`; the look follows the prototypes (cards, sheets).

### D10: One clean initial migration
- **Choice**: delete `20261005092628_house_context` and create one migration with `houses` (seeded rows), `people` (the two partial unique indexes written by hand) and `person_years` (CHECKs). Reset the dev database (approved by the product owner). Rewrite `prisma/seed.ts` with the validated list's fictional people (two per night post) and a few inactive people.
- **Rationale**: no production data exists; a single readable migration is easier for every later spec.
- **Alternatives considered**: a second migration that drops the membership tables (history with no value).

### D11: Written context for later specs
- **Choice**: `docs/domain.md` (glossary, posts and schedules, AP rules, vacation rule with FASI's table, surplus, sick leave and GDPR, rota and coverage, the vacation negotiation, holidays, the roadmap and open questions), linked with the prototypes and `docs/prototypes/director-feedback.md` from `AGENTS.md`, `README.md` and `openspec/config.yaml`.
- **Rationale**: the product owner asked that agents implementing the next specs have the same context this session had.

### D12: Testing
- **Choice**: Vitest unit tests for the posts inventory (seven posts per House plus the two shared posts, unique keys, EN with two seats, valid schedules), proration, duration parsing and formatting, the zod schemas and the navigation; component tests for the Equip list (vacant seats, night post with two people, inactive people) and the duration input; Server Function tests with mocked auth and data layer (non-director redirected, House mismatch rejected, occupied seat rejected). The two partial unique indexes are checked by hand against the dev database and recorded in `verify.md`.
- **Alternatives considered**: bringing SPEC-002's real-database harness (useful later, but large for one index).

## Risks / Trade-offs

- [Risk] The invented schedules are wrong → Mitigation: they are constants in one file, marked provisional and visible in the UI, so the director spots and corrects them quickly.
- [Risk] Editing a person in place loses "who covered this post before" → accepted for the first delivery; a history spec is on the roadmap.
- [Risk] Resetting the dev database removes SPEC-002's tables and the current fictional data → accepted (product owner): no real data exists; the seed recreates fictional people.
- [Trade-off] No database-level check that `post_key` and `seat` exist in the code inventory → accepted: the application validates them on every write and only the director writes.
- [Trade-off] Prorating rounds to whole days and may differ from FASI's own calculation → the director can overwrite the value; open question recorded.

## Migration Plan

1. On the working branch (from `main`): replace the schema and the migration, rewrite the seed.
2. Reset the dev database (`prisma migrate reset`) and run the seed; check the partial unique index by hand.
3. Deploy to a Vercel preview with the dev database; the director flag stays as today.
4. Production: create the EU production Supabase project, apply the single migration, set the director flag on the director's Clerk account. No data migration is needed.
5. Rollback: the change is one branch; `main` stays deployable until it is merged.

## Open Questions

- Real weekly schedules of each post (the invented ones are placeholders), and how the shared Pedagoga and Psicòloga split their week between the Houses (the product owner believes three days in one House and two in the other, alternating each week).
- FASI's exact proration formula for people who start mid-year.
- Next specs on the roadmap: history of people and posts (and future-dated changes); GDPR compliance (research first, then retention and erasure); the other prototype sections after the director's detailed review.
