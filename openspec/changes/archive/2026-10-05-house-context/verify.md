# Verification Report

> Produced by the `openspec-verify-change` flow after apply completed, to confirm that the
> implementation matches specs / design / tasks.

**Change**: `house-context`
**Verified at**: `2026-10-05`
**Verifier**: Claude (Sonnet 5.5 subagent) for the Opus 5.5 controller

---

## 1. Structural Validation (`openspec validate --all --json`)

- [x] All items `"valid": true`

**Result**:

```text
openspec validate --all --json (controller run, 2026-10-05)
1 item: change house-context, valid: true, 0 issues; 0 specs
```

| Item | Type | Issues |
|---|---|---|
| none | none | none |

---

## 2. Task Completion (`tasks.md`)

- [x] All `- [ ]` became `- [x]` (31/31)

**Incomplete tasks**: none. Task 9.3 (manual smoke test) was `[~]` (deferred) until the user ran it on 2026-10-05; all 8 checks passed (see section 7).

| Task | Reason incomplete | Blocks archive |
|---|---|---|
| none | none | none |

---

## 3. Delta Spec Sync State

| Capability | Sync state | Notes |
|---|---|---|
| house-context | ✗ Needs sync | `openspec/specs/` is empty; archive will sync it |
| house-membership | ✗ Needs sync | Same; archive will sync it |

Expected for a first change: the sync happens at archive, so this does not block it.

---

## 4. Design / Specs Coherence Spot Check

| Item | design says | specs say | Gap |
|---|---|---|---|
| D1 Employee + membership | `Employee(id, fullName)`, `HouseMembership` dated | "Minimal employee data": only a full name | `Employee.createdAt` also exists (`prisma/schema.prisma:32`). Plan-mandated, not personal data. Ruling accepted. |
| D2 URL + cookie | proxy sets `active-house` (httpOnly, lax, secure in prod, 1y) only when it changes | "Last active House is remembered" | None (`src/proxy.ts:20-31`, `src/lib/active-house.ts:10`) |
| D3 `HOUSES` + migration rows | constant + inserted rows + test | "Code and database agree" | None (`src/lib/houses.ts:4`, migration lines 61-64, `houses-migration.test.ts`) |
| D4 Exclusion constraint | `btree_gist`, EXCLUDE, CHECK | "One House at a time" | None (migration lines 48-59) |
| D5 Pure module + data layer | `todayInMadrid` lives in `house-membership.ts` | "Current team members" (Madrid date) | `todayInMadrid` is in `src/lib/dates.ts` instead (shared `IsoDate` helpers). Harmless refactor. `houseOf` was added beyond the listed API (needed for "Historical membership"). |
| D6 Director gate | `requireDirector()` in every page, layout, data function | "Director-only access" | None. Gate present in layout (`[house]/layout.tsx:23`), pages, dashboard and all three data functions (`src/server/houses.ts:13,18,23`). |
| D7 Switcher | segmented control of `Link`s, `aria-current`, no honey | "Switch active House" | Added `prefetch={false}` (fix c38b660) so prefetch does not overwrite the cookie in production. Not in design.md. Improvement. |
| D8 Pages | h1 "Inici" / "Equip", eyebrow = House | "Active House is always identifiable" | Layout adds `dynamicParams=false` + `generateStaticParams` for early 404 (not in design). Improvement. The first plan said "Hola, {name}", design D8 wins ("Inici"). Ruling accepted. |
| D9 BR-004 contract | written into spec | "House-scoped records keep their own House" | None (contract only, nothing to implement yet) |

**Drift warnings** (non-blocking):

- `Employee.createdAt` vs "only a full name" in spec "Minimal employee data". Judgement: harmless metadata, but either amend the spec wording at archive or drop the column.
- `todayInMadrid` moved to `src/lib/dates.ts` (design D5 puts it in `house-membership.ts`). Judgement: cosmetic; update design.md wording if desired.
- design.md does not mention `prefetch={false}`, `dynamicParams=false` or `React.cache` for the Clerk user (`src/lib/auth.ts:20`). Judgement: post-review hardening; record in the retrospective.
- Commit trailers name Claude Sonnet 5.5 instead of the plan's "Claude Opus 5.5". Judgement: accurate attribution; no action.
- A11y polish deferred (NoAccess `role="alert"` on static content; `TopBar` root is a `<nav>` wrapping two nav landmarks). Judgement: low impact, follow-up.

---

## 5. Implementation Signal

- [x] No unstaged files from this change in the worktree. `git status --short` shows only `?? .agents/` and `?? .codex/hooks.json`, both untracked before the change started and unrelated tooling.
- [ ] Commits pushed: expected NOT yet. Branch `feat/house-context` is intentionally not pushed; the PR is the last step of this schema. Not a failure.

**Commit range**: `19106ab..d47efad` (16 commits: planning 6b5ec73, e595ce1; implementation e595ce1..d47efad, including final-review fix c38b660 and smoke fix d47efad).

**Suite** (controller, after d47efad): lint clean, typecheck clean, 14 test files / 67 tests passing, `npm run build` OK.

---

## 6. Front-Door Routing Leak Detector (warning, non-blocking)

```bash
ls docs/superpowers/specs/*.md 2>/dev/null
```

- [x] No files

**Leaks**: none.

---

## 7. Deferred Manual Dogfood vs Automated Test Equivalence

plan.md has no `[~]` rows. tasks.md 9.3 was deferred and then run by the user on 2026-10-05 (director and non-director Clerk accounts): all 8 checks passed. Two issues were found and fixed in d47efad (the 404 page had no way back on mobile, and its copy was English). The user then confirmed everything works. The table is filled anyway so the retrospective can see which checks have no automated safety net. Source: `.superpowers/sdd/plan/task-12-report.md`.

| Smoke check (tasks 9.3) | Equivalent automated test | Coverage assessment | Real gap? |
|---|---|---|---|
| 1. `/dashboard` goes to `/paulo-freire` | `active-house.test.ts` ("falls back to Paulo Freire without a valid cookie") | Redirect resolution logic only; the `dashboard/page.tsx` redirect and `cookies()` wiring are not exercised | Partial gap (wiring) |
| 2. Equip lists Jordi/Laia, not Ana | `house-membership.test.ts` (membersOn, transfer drops), `server/houses.test.ts`, `membership-store.test.ts`, `team-list.test.tsx` | Domain, data layer (mocked DB), rendering | Partial gap (real seed data and DB not covered; only manual DB checks) |
| 3. Switcher to Carme Aymerich keeps `/team`; Ana "Des del 1 de juliol del 2026" | `houses.test.ts` (switchHousePath), `house-switcher.test.tsx`, `team-list.test.tsx`, `dates.test.ts` (Catalan format) | Path swap, link rendering, date formatting | ❌ Covered |
| 4. Inici <-> Equip stays in House | `section-nav.test.tsx`, `house-switcher.test.tsx` | Hrefs and current marker | ❌ Covered |
| 5. `/dashboard` returns to last House | `active-house.test.ts` (remembered, tampered, update only on change) | Cookie decision logic; the proxy `Set-Cookie` branch (`src/proxy.ts:21-31`) is not tested | Partial gap (proxy) |
| 6. `/casa-inexistent/team` is 404 | `houses.test.ts` (known slugs only, case-sensitive), `not-found.test.tsx` (Catalan 404 page) | Slug validation and 404 page; `dynamicParams=false` / `notFound()` routing not tested | Partial gap (routing) |
| 7. Mobile layout (<768px, bottom tab bar, no horizontal scroll) | none | No component or visual test of responsive layout | ✅ Real gap (manual only) |
| 8. Non-director goes to `/no-access` | `auth.test.ts`, `server/houses.test.ts`, `no-access.test.tsx` | Gate, data layer stops before query, icon + text | ❌ Covered |

Follow-ups for the retrospective: (a) a real gap for check 7 (add a Playwright or visual check, or accept manual); (b) a proxy test for the `Set-Cookie` branch (check 5); (c) a route-level test or e2e for `/dashboard` and unknown-slug 404 (checks 1, 6); (d) a DB integration harness for the exclusion constraint (design Risks), currently covered by manual DB checks only.

---

## 8. Requirement / Scenario Coverage

Legend: Test = automated test; Manual = recorded manual DB check or user smoke test; Structural = guaranteed by absence of any write or assignment path; Contract = rule for future capabilities, nothing to implement yet.

### house-context

| Requirement | Scenario | Implementation | Test / evidence | Status |
|---|---|---|---|---|
| Available Houses | Houses exist after migration | migration.sql:61-64 | `houses-migration.test.ts` "inserts exactly the Houses listed in HOUSES" (static SQL parse); migration applied to dev DB in task 4 | Test |
| Available Houses | Code and database agree | `src/lib/houses.ts:4-7` | `houses-migration.test.ts`, `houses.test.ts` "lists exactly the two Houses..." | Test |
| Active House in the URL | Director selects Paulo Freire | `src/app/(app)/[house]/layout.tsx:19-27`, `[house]/page.tsx:11-19` | User smoke checks 1 and 2 (page-level, no component test) | Manual |
| Active House in the URL | Unknown House | `[house]/layout.tsx:10-14,26`, `houses.ts:18` | `houses.test.ts` "accepts known slugs only"; user smoke check 6 | Manual (plus slug unit test) |
| Active House is always identifiable | Active House is marked | `src/components/house-switcher.tsx` (aria-current), `src/components/house-page-header.tsx` (eyebrow) | `house-switcher.test.tsx` "shows both Houses and marks the active one"; header via smoke checks 3/4 (no test) | Test (switcher) + Manual (header) |
| Active House is always identifiable | Not shown in honey | `src/components/house-switcher.tsx` | `house-switcher.test.tsx` "never uses honey for the active House" | Test |
| Switch active House | Director switches to Carme Aymerich | `src/lib/houses.ts:32-38` | `houses.test.ts` "swaps the House and keeps the section"; `house-switcher.test.tsx` "switches House while keeping the section" | Test |
| Switch active House | Switching writes nothing | Switcher is `Link`s only (`prefetch={false}`); no write function is reachable | Smoke check 3; `house-switcher.test.tsx` "never prefetches" | Structural + Manual |
| Navigation preserves the active House | Navigation keeps Paulo Freire | `src/components/section-nav.tsx` | `section-nav.test.tsx` "keeps every link in the active House..." | Test |
| Last active House is remembered | Return to last House | `src/proxy.ts:20-31`, `src/lib/active-house.ts:10-18`, `(app)/dashboard/page.tsx:8-11` | `active-house.test.ts` "stores the House when entering...", "returns to the remembered House"; smoke check 5 | Test (proxy Set-Cookie branch itself: smoke only) |
| Last active House is remembered | No or invalid cookie | `src/lib/active-house.ts:16-18` | `active-house.test.ts` "falls back to Paulo Freire...", "never redirects to a tampered value" | Test |
| Director-only access | Director enters | `src/lib/auth.ts:39-44`, `[house]/page.tsx:12` | `auth.test.ts` "returns the director"; smoke checks 1-4 | Test |
| Director-only access | Non-director is blocked | `src/lib/auth.ts:42`, `(app)/no-access/page.tsx`, `src/components/no-access.tsx` | `auth.test.ts` "redirects a signed-in non-director to /no-access"; `no-access.test.tsx`; smoke check 8. redirect() throws, so no names render. | Test |
| Director-only access | Data layer rejects non-director | `src/server/houses.ts:13,18,23` | `server/houses.test.ts` "stops before any query" | Test |

### house-membership

| Requirement | Scenario | Implementation | Test / evidence | Status |
|---|---|---|---|---|
| Effective-dated House membership | Membership with a period | `src/lib/house-membership.ts:24-26`, schema.prisma:43-55 (`@db.Date`) | `house-membership.test.ts` "includes both bounds", "treats a missing end as ongoing" | Test |
| One House at a time | Overlap rejected by the domain check | `house-membership.ts:43-45` (`findOverlap`) | `house-membership.test.ts` "detects an overlap in another House" / "same House" / "allows adjacent periods" | Test (see S2: `findOverlap` has no production caller yet) |
| One House at a time | Overlap rejected by the database | migration.sql:54-59 (EXCLUDE gist) | Manual: task-4-report.md, rejected by `house_memberships_no_overlap`; static check in `houses-migration.test.ts` "keeps the hand-written membership constraints" | Manual |
| One House at a time | End before start rejected | migration.sql:50-52 (CHECK) | Manual: task-4-report.md, rejected by `house_memberships_period_check` | Manual |
| Current team members | Employees separated by current membership | `membership-store.ts:22-28`, `server/houses.ts:17-20`, `[house]/team/page.tsx:21` | `house-membership.test.ts` "lists only current members of the given House"; `membership-store.test.ts` "returns only members active on the date, sorted by name"; `team-list.test.tsx`; smoke check 2 | Test |
| Current team members | Madrid date decides the boundary | `src/lib/dates.ts` (`todayInMadrid`), `[house]/team/page.tsx:21` | `dates.test.ts` "flips at Madrid midnight in summer (UTC+2)" / "winter (UTC+1)" | Test |
| Current team members | Transferred employee is not a current member | `house-membership.ts:29-31` | `house-membership.test.ts` "drops a transferred employee from the old House (EC-002)" | Test |
| Historical membership | Records before and after a transfer | `house-membership.ts:34-36` (`houseOf`) | `house-membership.test.ts` "answers for past and later dates (scenario 5)" | Test |
| Transfer does not rewrite history | Transfer closes and opens | `house-membership.ts:68-76`, `membership-store.ts:31-41` | `house-membership.test.ts` "closes the day before and opens...", "never touches the existing start date or House"; `membership-store.test.ts` "closes the ongoing membership and opens the new one in one transaction" | Test |
| Transfer does not rewrite history | Transfer to the same House rejected | `house-membership.ts:70` | `house-membership.test.ts` "rejects a transfer to the same House"; `membership-store.test.ts` "rejects a same-House transfer and writes nothing" | Test |
| Transfer does not rewrite history | Transfer recorded in advance | `house-membership.ts:24-26,72-75` | `house-membership.test.ts` "does not list a membership that starts in the future" (plus planTransfer tests). No single test replays the 2026-05-10 narrative. | Test (composed) |
| House-scoped records keep their own House | Record keeps its House after a transfer | No House-scoped record exists yet | Contract for future capabilities (spec requirement, design D9) | Contract |
| Temporary cross-House work is not membership | Membership independent of other assignments | Schema has no assignment or coverage concept; nothing can alter membership | Structural | Structural |
| Temporary cross-House work is not membership | ER supervising both Houses | One `Employee`, one open `HouseMembership` per employee (EXCLUDE constraint) | Structural (DB constraint, manual task-4) | Structural |
| Minimal employee data | Employee erasure | schema.prisma:49 (`onDelete: Cascade`), migration.sql FK | Manual: task-4-report.md ("employee delete cascades; no leftovers") | Manual |

**Totals**: 15 requirements, 29 scenarios. By automated tests: 20. By manual evidence (DB checks / smoke test): 6 (some with extra unit tests). Structural or contract-only: 3. Uncovered: 0.

---

## Issues by Priority

**CRITICAL**: none.

**WARNING**:

- W1. `prisma/schema.prisma:32` (`Employee.createdAt`) vs spec "Minimal employee data" ("only a full name"). Recommendation: either reword the spec at archive ("a full name and a creation timestamp") or remove the column in the next migration.
  - **Resolved 2026-10-05 (controller):** spec reworded to "only a full name as personal data (technical metadata such as a creation timestamp is allowed)"; `createdAt` kept.
- W2. Exclusion-constraint scenarios ("Overlap rejected by the database", "End before start rejected", "Employee erasure") rely only on one-off manual DB checks (task-4-report.md); the unit test only greps the SQL (`src/lib/houses-migration.test.ts`). Recommendation: add a DB integration harness (test database or Supabase branch) as a follow-up before the migration is reused in production.
- W3. `src/proxy.ts:21-31` (cookie `Set-Cookie` branch), `[house]/layout.tsx:10-26` (404 routing) and the mobile layout have no automated tests, only the user smoke test (section 7). Recommendation: record as retrospective follow-ups.

**SUGGESTION**:

- S1. `src/components/house-page-header.tsx`: the page header showing the House name has no test. Add one asserting the eyebrow shows the House name.
- S2. `src/lib/house-membership.ts:43` `findOverlap` has no production caller; `applyTransfer` relies on `planTransfer` and the DB constraint. Wire it into the future "create membership" path (SPEC-002) or note that it is a helper.
- S3. `src/components/no-access.tsx` / `src/components/top-bar.tsx`: deferred a11y polish (role="alert" on static content, nested nav landmarks). Fix when the top bar is next touched.
- S4. Sync `design.md` wording with the code (D5 `todayInMadrid` location; mention `prefetch={false}`, `dynamicParams=false`, `React.cache` on `currentUser`) before archive.
- S5. Add one composed test for "Transfer recorded in advance" (membersOn on 2026-05-10 after planTransfer with start 2026-07-01).

---

## Overall Decision

- [ ] ✅ PASS
- [x] ⚠️ PASS WITH WARNINGS — no critical issues; every requirement and scenario has an implementation and either an automated test, recorded manual evidence, or a structural guarantee. Warnings: `Employee.createdAt` vs the "only a full name" spec text (W1), DB-constraint scenarios covered only by manual checks (W2), and untested proxy cookie branch, 404 routing and mobile layout covered only by the user smoke test (W3).
- [ ] ❌ FAIL

**Next step**: write the retrospective (record the section 7 gaps and W1 to W3 as follow-ups), then archive (syncs both delta specs into `openspec/specs/`), then `superpowers:finishing-a-development-branch` (push the branch and open the PR).
