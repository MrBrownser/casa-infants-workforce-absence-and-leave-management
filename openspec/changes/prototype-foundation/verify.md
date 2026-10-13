# Verification Report

> Produced by the `openspec-verify-change` skill after the apply phase, to confirm that the
> implementation matches the specs, design and tasks. A failed check sends the work back to the
> artifact concerned before verify is run again.

**Change**: `prototype-foundation`
**Verified at**: `2026-10-13 23:48` (Europe/Madrid)
**Verifier**: Claude Code subagent (Opus), `openspec-verify-change` skill, on branch `ccr-856c263d-ewwg70` at `9a1dc88`

---

## Summary scorecard

| Dimension | Status |
|---|---|
| Completeness | 23/23 tasks done; 3 delta specs (13 added or modified requirements in `people-and-posts`, 2 added and 3 modified in `house-context`, 8 removed in `house-membership`) |
| Correctness | 18/18 added or modified requirements implemented; 31/32 scenarios covered by an automated test or a recorded manual check (1 partially: the AP part of "Move keeps balances", because APs do not exist yet) |
| Coherence | Design followed; 2 decisions drifted after the plan (D3 week counting, D7 input mask) and 1 approved deviation from the proposal (new dependency) |
| Checks | lint, typecheck, test (201/201) and build all green, run by the verifier |

Findings: **0 CRITICAL, 3 WARNING, 6 SUGGESTION**. Decision: **PASS WITH WARNINGS**, ready to archive.

---

## Checks run by the verifier

All four run from the repo root on `9a1dc88` (the parallel deployment commit `38dc920` only touches
`vercel.json`, `README.md` and `.env.example`).

```text
$ npm run lint
> eslint
(no output)                                   exit 0

$ npm run typecheck
> tsc --noEmit
(no output)                                   exit 0

$ npm test
> vitest run
 Test Files  28 passed (28)
      Tests  201 passed (201)
   Duration  3.64s                            exit 0

$ npm run build            (real Clerk keys from .env.local; values not printed)
> next build
▲ Next.js 16.2.9 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 1916ms
  Finished TypeScript in 2.1s ...
✓ Generating static pages using 11 workers (10/10) in 312ms
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /[house]
├ ƒ /[house]/team
├ ƒ /dashboard
├ ƒ /no-access
├ ƒ /sign-in/[[...sign-in]]
└ ƒ /sign-up/[[...sign-up]]
ƒ Proxy (Middleware)                          exit 0
```

Database and browser evidence is not re-run here (no destructive commands): see `db-check.md`
(local Postgres 16.15 and the Supabase dev database `eu-west-1` after the reset approved by the
product owner; browser check at 1280px and 390px).

---

## 1. Structural Validation (`openspec validate --all --json`)

- [x] Every item `"valid": true`

**Result**:

```text
house-context        spec    valid: true  issues: []
house-membership     spec    valid: true  issues: []
prototype-foundation change  valid: true  issues: []
totals: items 3, passed 3, failed 0
```

| Item | Type | Issues |
|---|---|---|
| none | | |

---

## 2. Task Completion (`tasks.md`)

- [x] Every `- [ ]` is now `- [x]` (23/23; `grep -c '^- \[ \]'` returns 0)

**Incomplete tasks**: none.

| Task | Reason | Blocks archive |
|---|---|---|
| none | | |

Note: `plan.md` keeps its 92 step checkboxes as `- [ ]` (progress was tracked in `tasks.md`); it has
no `[~]` rows. See SUGGESTION S4.

---

## 3. Delta Spec Sync State

| Capability | Sync state | Notes |
|---|---|---|
| `people-and-posts` | ✗ Needs sync | New capability; `openspec/specs/people-and-posts/` does not exist yet. Created on archive. |
| `house-context` | ✗ Needs sync | Main spec still has the SPEC-001 wording of "Switch active House", "Navigation preserves the active House" and "Director-only access", and lacks "Product sections" and "House home opens the first available section". |
| `house-membership` | ✗ Needs sync | Main spec still lists the 8 requirements this change removes. Archive removes them. |

Expected state before archive: `/opsx:archive` (or `/opsx:sync`) applies the three deltas.

---

## 4. Design / Specs Coherence Spot Check

| Sample | design | specs | Gap |
|---|---|---|---|
| D2 posts per House | 7 own posts, PDG and PSI shared | "Posts are defined in code per House", "Posts shared by both Houses" | none |
| D3 schedules | table of times; "EN seats alternate by ISO week"; shared posts by "odd ISO weeks" | "Weekly schedule per post", "Weekends, holidays, nights and the CT" (say "by week", no ISO) | Code counts weeks from a fixed Monday (`weekIndex`), see W1 |
| D4 person and seat | two partial unique indexes | "People per post", "Minimal personal data" | none |
| D5 balances follow the person | `person_years` per person | "Balances follow the person" | none |
| D6 defaults | 31, prorated, 16 for 01/07 | "Default opening balances" | none |
| D7 duration input | "a mask that only accepts `H:MM`" | "Duration input" (only accepts that format, error with icon) | Letters now stay visible and fail validation on blur, see W1 |
| D8 navigation | Saldos, Vacances, El mes, Equip with `available` | "Product sections", "House home opens the first available section" | D8 and task 4.1 place `SECTIONS` in `section-nav.tsx`; the code has it in `src/lib/sections.ts` (AGENTS.md is correct). Cosmetic. |
| D9 Equip writes | `requireDirector()`, House from the route, person belongs to it | "Writes are scoped to the active House" | none |
| D12 testing | partial indexes checked by hand and recorded | "Second active person rejected by the database" | Recorded in `db-check.md` rather than here; cited below |

**Drift warnings** (non-blocking): W1.

---

## 5. Implementation Signal

- [x] No unstaged or untracked files in the worktree (`git status --short` empty)
- [x] Commits are on the branch; pushing is left to the finishing step

**Commit range**: `767baed..9a1dc88` (merge base with `origin/main` to the last change commit; 36
commits, including the prototype commits carried over by D1). `38dc920` (deployment, parallel
work) is outside this verification.

Post-plan commits accounted for (`d0b7d02..9a1dc88`):

| Commit | Change | Evidence |
|---|---|---|
| `766d93e` | Move form clears after a successful move | `src/components/team/place-form.tsx:32`; test `src/components/team/person-sheet.test.tsx:103` |
| `1d3bc67` | Neutral Catalan copy (no "Mou-la", "la pots reincorporar") | test `src/components/team/person-sheet.test.tsx:133`; `db-check.md` browser check |
| `3e2f749` | "Desat." kept after save: react-hook-form `values` instead of remount keys | `src/components/team/rename-form.tsx:19`, `src/components/team/balances-section.tsx:37`; tests `person-sheet.test.tsx:64`, `balances-section.test.tsx:60`, `:73` |
| `55df422`, `2321b02` | Side sheet wraps the shadcn Drawer (Base UI `@base-ui/react` pinned `1.8.0`): animated, right on desktop and bottom on mobile, swipe to dismiss, focus trap, scroll lock, focus return | `src/components/ui/drawer.tsx`, `src/components/sheet.tsx:34-81`, `package.json:20`; tests `src/components/sheet.test.tsx:13`, `:47`, `:66`, `:86`, `:92` |
| `2a5b095` | Letters in a duration field stay visible and show the `H:MM` error on blur | `src/components/duration-input.tsx`; tests `duration-input.test.tsx:27`, `balances-section.test.tsx:82` |
| `eb27b3f`, `9a1dc88` | `allowedDevOrigins` from `ALLOWED_DEV_ORIGINS`; README explains that sign-in over `http://<lan-ip>` fails (not a secure context, Clerk needs Web Crypto) | `next.config.ts:6-13`; `README.md:74-80`. Dev-environment limitation, not an app defect. |

### Approved deviation from the proposal

- **New dependency `@base-ui/react@1.8.0`** (shadcn Drawer). `proposal.md` → Impact says "No new
  dependencies". The product owner approved this dependency explicitly for the animated, swipeable
  side sheet. The version is pinned exactly (`package.json:20`). Recorded here; no action needed
  beyond S3.

---

## 6. Front-Door Routing Leak Detector (warning, non-blocking)

```bash
ls docs/superpowers/specs/*.md 2>/dev/null
# no matches
```

- [x] No files

| File | Captured in the change | Action |
|---|---|---|
| none | | |

---

## 7. Deferred Manual Dogfood vs Automated Test Equivalence

`plan.md` has no `[~]` rows, so this section may be empty. The manual checks that were run, and one
known gap, are recorded for completeness:

| Manual check | Equivalent automated test | Coverage assessment | Real gap? |
|---|---|---|---|
| Plan Task 5 Step 4: partial unique indexes and CHECKs by hand (`db-check.md`, local and Supabase dev) | `src/lib/houses-migration.test.ts:23`, `:32` (migration text contains the indexes and CHECKs); `src/server/people-store.test.ts:65` (P2002 to `SeatTakenError`) | Tests prove the SQL is present and the mapping works; only the manual run proves Postgres enforces it. Manual run done and recorded. | No |
| Plan Task 14: browser check, desktop 1280px and mobile 390px, both Houses (`db-check.md`) | Component tests for the board, sheet, forms and nav (`team-board.test.tsx`, `person-sheet.test.tsx`, `balances-section.test.tsx`, `section-nav.test.tsx`) | Layout, real Clerk sign-in and the real database are only covered by the manual check. Done and recorded. | No |
| Swipe to dismiss the sheet on a real phone (after `2321b02`) | `src/components/sheet.test.tsx:13` covers Escape, the close button and the backdrop only | Synthetic pointer events do not trigger Base UI's swipe; not verified on a device. The product owner confirmed the drawer on desktop ("se ve perfecto"). | **Yes** (W2): record in retrospective Misses |

---

## Requirement and scenario traceability

Paths are relative to the repo root. "Manual" means the browser or database check in `db-check.md`.

### `people-and-posts` (ADDED)

| Requirement / Scenario | Code | Test | Status |
|---|---|---|---|
| Posts are defined in code per House / Inventory of each House | `src/lib/posts.ts:66-74`, `:88`, `:97` | `src/lib/posts.test.ts:22`, `:29`, `:34` | Covered |
| Posts shared by both Houses / Shared posts have no House | `src/lib/posts.ts:83-86`; `src/server/people-store.ts:69-74` (null `house_id`) | `posts.test.ts:42`, `:50`; `people-store.test.ts:50`; `actions.test.ts:55`, `:98` | Covered |
| ... / Shared posts on both Equip pages | `src/lib/team.ts:64`, `:70`; `src/components/team/team-board.tsx:43` | `team-board.test.tsx:33`; `team.test.ts:33`; Manual (House switch shows shared people) | Covered |
| Role labels / Labels on the Equip page | `src/lib/posts.ts:8` | `posts.test.ts:57`; `team-board.test.tsx:42` | Covered |
| Weekly schedule per post / Schedule shown with the post | `src/lib/posts.ts:44-63`, `:131`, `:147`; `src/components/team/post-card.tsx:24` | `posts.test.ts:68`, `:81`, `:87`; `team-board.test.tsx:42` | Covered |
| ... / Different times per weekday | `src/lib/posts.ts:51` (ER) | `posts.test.ts:87`, `:100` | Covered |
| Weekends, holidays, nights and the CT / Night alternation | `src/lib/posts.ts:170` | `posts.test.ts:121`, `:126` | Covered |
| ... / Weekend mornings and afternoons | `src/lib/posts.ts:54-55`, `:159` | `posts.test.ts:105`, `:110`, `:115` | Covered |
| ... shared post House per weekday (requirement text) | `src/lib/posts.ts:179`, `:189` | `posts.test.ts:132`, `:138` | Covered |
| Minimal personal data / Person fields | `prisma/schema.prisma` (`Person`); `src/components/team/add-person-form.tsx:27`, `:37`; `src/lib/people-schemas.ts:42` | `people-schemas.test.ts:9`, `:17` | Covered |
| People per post / Night post with two people | `src/lib/team.ts:70`; `post-card.tsx:24` | `team-board.test.tsx:59`; `team.test.ts:48` | Covered |
| ... / Vacant seat | `post-card.tsx:43` | `team-board.test.tsx:42`; `team.test.ts:40` | Covered |
| ... / Second active person rejected by the database | `prisma/migrations/20261013102029_init/migration.sql:55`, `:57` | `houses-migration.test.ts:23`; Manual (`db-check.md`, both databases) | Covered |
| Equip lists posts and people / Paulo Freire team | `src/server/people.ts:14`; `src/lib/team.ts:70`; `team-board.tsx:79` | `team.test.ts:40`, `:56`, `:62`; `team-board.test.tsx:69`; `people.test.ts:35` | Covered |
| Add a person to a vacant seat / Add to a vacant post | `actions.ts:59-64`; `people-store.ts:104` | `actions.test.ts:49`; `people-store.test.ts:36`; Manual | Covered |
| ... / Seat taken in the meantime | `people-store.ts:91-102`; `actions.ts:43-45`; `add-person-form.tsx:53` | `people-store.test.ts:57`, `:65`; `actions.test.ts:75` | Covered (UI error rendering of this case has no component test, S5) |
| Rename a person / Name corrected | `actions.ts:66-72`; `people-store.ts:125` | `actions.test.ts:86`; `person-sheet.test.tsx:54` | Covered |
| Move a person / Move to the other House | `actions.ts:75-82`; `people-store.ts:130` | `actions.test.ts:110`; `person-sheet.test.tsx:96`; Manual | Covered |
| ... / Target seat occupied | `people-store.ts:94-95` | `actions.test.ts:122`; `people-store.test.ts:57` | Covered |
| Mark inactive and reactivate / Person leaves | `actions.ts:84-91`; `people-store.ts:137` | `actions.test.ts:133`; `people-store.test.ts:97`; `person-sheet.test.tsx:114`; Manual | Covered |
| ... / Person comes back | `actions.ts:93-100` | `actions.test.ts:139`, `:145`; `person-sheet.test.tsx:124`; Manual | Covered |
| ... no delete offered | no delete action or UI (no `delete` call in `src/` outside generated code) | n/a | Covered |
| Opening balances per person and year / Balances saved | `actions.ts:102-108`; `people-store.ts:148` | `actions.test.ts:153`; `balances-section.test.tsx:35`; Manual | Covered |
| Default opening balances / Default for a full year | `src/lib/rules.ts:20`, `:28`; `people.ts:31` | `rules.test.ts:13`, `:31`; `people.test.ts:41`; `balances-section.test.tsx:21` | Covered |
| ... / Prorated default | `rules.ts:20` | `rules.test.ts:19`, `:25`; Manual (Aina Martín Serra, 16) | Covered |
| Duration input / Negative surplus | `src/lib/duration.ts:6`, `:18`; `people-schemas.ts:51-63` | `people-schemas.test.ts:56`, `:61`; `balances-section.test.tsx:43`; `duration.test.ts:25` | Covered |
| ... / Invalid duration | `duration.ts:3`; `duration-input.tsx` | `duration.test.ts:12`; `balances-section.test.tsx:82`, `:96`; `actions.test.ts:159` | Covered |
| Balances follow the person / Move keeps balances | `people-store.ts:130-134` (only the `people` row changes; `person_years` keyed by person) | `people-store.test.ts:83` | Partial: vacation and surplus parts hold by construction; APs and "days left" do not exist until SPEC-004 |
| Writes are scoped to the active House / Person from the other House | `actions.ts:54-57`; `src/lib/team.ts:64` | `actions.test.ts:92`, `:103`; `people.test.ts:57` | Covered |
| ... / Unknown post or seat | `src/lib/posts.ts:104`, `:114`; `people-schemas.ts:13-20`; `people-store.ts:92` | `actions.test.ts` (`rejects the unknown seat`, after line 59); `people-schemas.test.ts` (`rejects the seat`); `posts.test.ts:148`, `:164`; `people-store.test.ts:73` | Covered |

### `house-context` (MODIFIED and ADDED)

| Requirement / Scenario | Code | Test | Status |
|---|---|---|---|
| Switch active House / Director switches to Carme Aymerich | `src/components/house-switcher.tsx`; `src/lib/houses.ts` (`switchHousePath`) | `house-switcher.test.tsx:24`; `houses.test.ts:47`; Manual | Covered |
| ... / Switching writes nothing | Switcher is links only (no Server Function); proxy only sets the `active-house` cookie | `house-switcher.test.tsx:36` | Covered by construction |
| Navigation preserves the active House | `src/lib/sections.ts` (`sectionHref`); `section-nav.tsx` | `sections.test.ts:21`; `section-nav.test.tsx:12` | Covered |
| Director-only access / Director enters | `src/app/(app)/[house]/team/page.tsx:29` | Manual (signed in as director) | Covered |
| ... / Non-director is blocked | `src/lib/auth.ts:39-44`; `[house]/layout.tsx:23`; `team/page.tsx:29`; `people.ts:15`, `:20`, `:26` | `auth.test.ts:38`; `people.test.ts:21`; `no-access.test.tsx:8` | Covered (no page-level test of `team/page.tsx`, S5) |
| ... / Data layer rejects non-director | `actions.ts:35`; `people.ts`; `src/server/houses.ts:9` | `actions.test.ts:38`; `people.test.ts:21`; `houses.test.ts:12` | Covered |
| Product sections / Sections in this release | `src/lib/sections.ts:10-13`; `section-nav.tsx:22-38`, `:78` | `sections.test.ts:8`; `section-nav.test.tsx:20`, `:31`; Manual | Covered |
| ... / Unavailable section URL | No route for `saldos`, `vacances`, `mes` | `sections.test.ts:28` (route exists only when available); Manual (Catalan 404) | Covered |
| House home opens the first available section / House home in this release | `src/app/(app)/[house]/page.tsx:8-14` | `[house]/page.test.tsx:21`, `:27`, `:33`; Manual | Covered |

### `house-membership` (REMOVED)

All 8 requirements removed. `src/lib/house-membership.ts`, `src/server/membership-store.ts`,
`src/components/team-list.tsx`, `transferEmployee` and `listCurrentMembers` are gone; no reference
to `Employee`, `HouseMembership` or `house_memberships` remains in `src/`, `prisma/`, `AGENTS.md` or
`README.md` (the only hit is the generic "Employee data stays in EU-hosted Supabase" in
`README.md:206`). The single migration `20261013102029_init` has no membership table.

---

## Security, GDPR and docs review (adversarial)

- **Director gate**: every page (`[house]/page.tsx:9`, `[house]/team/page.tsx:29`,
  `dashboard/page.tsx:9`), the House layout (`[house]/layout.tsx:23`), every read
  (`src/server/people.ts:15`, `:20`, `:26`; `src/server/houses.ts:9`) and every Server Function
  (through `run`, `actions.ts:35`) calls `requireDirector()` before any query. `no-access` needs only
  a signed-in user, by design. `src/server/people-store.ts` has no auth, by design (AGENTS.md), and
  is only imported by `people.ts`, `actions.ts` and the seed.
- **Tampered input**: House slug checked (`actions.ts:36`); input re-parsed with the form schema
  (`actions.ts:37`); person ids must be UUIDs (`people-schemas.ts:9`); seat strings decoded and
  validated against the code inventory (`posts.ts:114-120`) and again in the store
  (`people-store.ts:92`); a person must belong to the route's House or a shared post
  (`actions.ts:54-57`); an add to the other House's seat is rejected (`actions.ts:61`). Moves and
  reactivations may target the other House on purpose (spec "Move a person to another post or
  House"). Surplus input is capped at `999:59` (`duration.ts:3`), inside the DB CHECK of
  ±60000 minutes. No leak of the other House: `listPeopleOf` reads only the House and shared rows
  (`people-store.ts:54-57`), `buildTeamView` filters again (`team.ts:71`), `getPersonDetails`
  returns null for the other House (`people.ts:29`). `getVacantSeats` lists both Houses' vacant
  seats (no names), needed for moves.
- **GDPR**: `people` holds only name, House, post, seat, optional start date, active flag and
  timestamps; `person_years` only the three balances. No health, contact or identity data. The seed
  is fictional and refuses to run in production (`prisma/seed.ts:15`). No delete in the UI; retention
  and erasure deferred to a GDPR spec, as the proposal says.
- **Docs vs code**: `AGENTS.md` layout, models and data rules match the code. `docs/domain.md`
  schedules match `src/lib/posts.ts:47-63` and record the `weekIndex` change. `README.md` status and
  reset instructions match. Gaps: W1 (design.md), S3 (Base UI not named in AGENTS.md or README).

---

## Findings

### CRITICAL

None.

### WARNING

- **W1. design.md drifted after the plan (two decisions).** D3 says the night seats alternate "by
  ISO week" and the shared posts split by "odd ISO weeks"; the code counts weeks from a fixed Monday
  (`src/lib/posts.ts:170`, `:179`, via `weekIndex`) because 2026 has 53 ISO weeks.
  `docs/domain.md` §3 records it; `design.md` D3 and task 1.2 do not. D7 says the mask "only accepts
  `H:MM`"; since `2a5b095` letters stay visible and are rejected on blur with the error and icon (the
  spec is still met). Recommendation: add a short "Changed during apply" note under D3 and D7 in
  `design.md` before archive, or carry it into the retrospective.
- **W2. Swipe to dismiss not verified on a real phone.** Base UI swipe is not triggered by synthetic
  pointer events, so neither the tests (`src/components/sheet.test.tsx`) nor the agent's browser
  check exercised it; the desktop drawer was confirmed by the product owner. Recommendation: one
  manual check on a phone (over HTTPS, see `README.md:74-80`) and record it in the retrospective
  Misses until done.
- **W3. Approved deviation: new dependency.** `proposal.md` says "No new dependencies";
  `@base-ui/react@1.8.0` was added for the Drawer with the product owner's explicit approval.
  Non-blocking; recorded so the archive is honest. Recommendation: mention it in the retrospective.

### SUGGESTION

- **S1. Unexpected server errors fall back to Next's English error screen.** `run` in
  `actions.ts:42-46` rethrows anything that is not `SeatTakenError` (for example a database outage,
  or Prisma `P2025` if a person disappears between the check and the write), `useServerAction`
  (`src/components/team/use-server-action.ts:15-23`) has no `try/catch`, and there is no `error.tsx`
  under `src/app/`. Recommendation: catch in `useServerAction` and show a Catalan message with an
  icon, or add a Catalan `error.tsx` (DESIGN.md: errors carry icon and text).
- **S2. Dead code.** `getHouseBySlug` in `src/server/houses.ts:8` is only used by its test.
  Recommendation: remove it, or keep it and note that it is for later specs.
- **S3. Base UI not named in the docs.** `AGENTS.md` (Stack) and `README.md` do not mention
  `@base-ui/react` or that `src/components/sheet.tsx` wraps the shadcn Drawer. Recommendation: one
  line in AGENTS.md Stack and Layout.
- **S4. plan.md checkboxes left unticked.** 92 `- [ ]` steps, 0 ticked; progress lives in
  `tasks.md`. Recommendation: tick them or add a note at the top of `plan.md` that `tasks.md` is the
  tracker.
- **S5. Two UI paths without a component or page test.** The add form showing the `SeatTakenError`
  message with an icon (`add-person-form.tsx:53`), and `team/page.tsx` rendering no names for a
  non-director (logic is covered in `actions.test.ts:75` and `people.test.ts:21`). Also,
  `balances-section.test.tsx:82` is titled "as soon as letters are typed" but asserts the error after
  blur. Recommendation: add the two tests and rename the third.
- **S6. design.md D8 and task 4.1 name the wrong file for `SECTIONS`** (`section-nav.tsx`; the code
  and AGENTS.md use `src/lib/sections.ts`). Recommendation: fold into the W1 note.

---

## Overall Decision

- [ ] ✅ PASS
- [x] ⚠️ PASS WITH WARNINGS: no critical issues; design.md drift (W1), swipe to dismiss on a real
  phone not verified (W2), approved new dependency (W3)
- [ ] ❌ FAIL

**Next step**:

No critical issues. 3 warnings to consider. Ready for archive (with noted improvements):
optionally add the W1 note to `design.md`, then run `finishing-a-development-branch`, write the
retrospective (record W2 and W3 there, plus S1 to S5 as follow-ups), and archive with
`/opsx:archive prototype-foundation`, which syncs the three delta specs.
