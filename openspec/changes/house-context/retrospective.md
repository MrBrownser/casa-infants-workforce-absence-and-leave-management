# Retrospective: house-context

> Written: 2026-10-05 (after verify passed: PASS WITH WARNINGS, W1 resolved)
> Commit range: `e595ce1..d47efad` (implementation); planning `19106ab..e595ce1`
> Worktree: main checkout, branch `feat/house-context` (worked in place, see §4)

---

## 0. Evidence

- **Commit range**: `e595ce1..d47efad` (14 commits: 12 plan tasks, 1 final-review fix, 1 smoke-test fix). Planning: `6b5ec73`, `e595ce1`.
- **Diff size**: +2031 / -73 lines across 44 files (+1511 / -73 across 43 files without `package-lock.json`).
- **Tasks done**: 31/31 (9.3 deferred `[~]` until the user ran the smoke test, then `[x]` in `d47efad`).
- **Active hours**: about 1 hour of implementation wall-clock (first task commit 11:23, docs 11:36, final fix 11:43, smoke fix 12:05). The user's manual smoke test and verify came on top of that.
- **Subagent dispatches**: 31 total. 12 implementers + 12 task reviewers (all Sonnet), 1 final whole-branch review (Opus), 1 fix wave + 1 scoped re-review, 1 smoke-fix implementer + 1 review, 1 verify writer (Sonnet). 0 fix rounds were needed in the per-task loop.
- **New external dependencies**: `lucide-react` 1.52.0 (ISC, runtime icons), `tsx` 4.23.15 (MIT, dev, runs the seed).
- **Bugs encountered post-merge**: none yet (not merged). Bugs caught before merge: 2 by the final review (switcher prefetch overwrote `active-house` in production; uncached `currentUser()`), 2 by the user smoke test (404 page had no way back on mobile; 404 copy in English).
- **OpenSpec validate state at archive**: pass (`openspec validate --all --json`: 1 item, valid, 0 issues).
- **Test coverage signal**: Vitest 14 files / 67 tests, up from 1 file / 2 tests at baseline. Lint, typecheck and `npm run build` are clean.

Commit chain (chronological):

```
6b5ec73 docs(openspec): propose house-context change (SPEC-001)
e595ce1 docs(openspec): add house-context plan and plan-time corrections
c8082f0 feat(houses): add House constants and path helpers
84622f5 feat(dates): add IsoDate helpers and Madrid today
22e830d feat(membership): add dated House membership rules and transfer planning
7bce67d feat(db): add House, Employee and HouseMembership with no-overlap constraint
d34f46d feat(auth): add temporary director gate and no-access page
cc47a13 feat(houses): add director-only House data layer and membership store
9dde27b chore(db): add dev seed with fictional employees and a transfer
b0b670d feat(houses): remember the last House and redirect /dashboard to it
26d5435 feat(ui): add House switcher, section nav and House page header
4109c49 feat(houses): add House-scoped layout with switcher and Inici page
c6e8372 feat(houses): add read-only team page with current members
8b86dbd docs: document House context, director flag and dev seed
c38b660 fix(houses): stop switcher prefetch, memoize Clerk user, 404 unknown slugs early
d47efad fix(ui): add Catalan 404 page with a way back to the dashboard
<archive commit pending>
```

---

## 1. Wins

- **A plan with complete code made cheap implementers viable.** Every task brief carried the exact code and tests, so every Sonnet implementer finished in one dispatch. All 12 task reviews came back clean with 0 fix rounds (see §0).
- **The pure domain module carried the hard rules.** The membership rules live in a pure module (`src/lib/house-membership.ts`), backed by a DB exclusion constraint (`prisma/migrations/20261005092628_house_context/migration.sql`). Overlaps, inclusive bounds, future and ended memberships, and transfers are unit-tested without a DB (`house-membership.test.ts`). The constraint was proven against the dev DB: the overlap and end-before-start inserts were rejected, and employee deletion cascades (task-4 evidence in `verify.md` §8).
- **The review focus list in `plan.md` paid off.** The open redirect from a tampered cookie, wrong-case paths, the Madrid midnight in both DST regimes, and the non-director gate before any query all have explicit tests (`active-house.test.ts`, `houses.test.ts`, `dates.test.ts`, `server/houses.test.ts`).
- **The Opus final review caught a production-only bug that every per-task review and the dev-server smoke test would miss.** Next auto-prefetches `<Link>`s in production, and the switcher's prefetch of the other House went through the proxy and overwrote `active-house`. It was fixed with `prefetch={false}` plus a test in `c38b660`.
- **Pipelining saved wall-clock.** Each task's read-only reviewer ran in parallel with the next task's implementer, so 12 tasks landed in about 13 minutes of commit time.

## 2. Misses

- 🟡 [painful | evidence: user smoke test, `d47efad`] **No Catalan 404 page.** The plan never covered Next's built-in English 404 page, so the "Unknown House" scenario rendered English copy with no way back on mobile. No reviewer flagged it, because nothing in the diff was wrong; the file was simply missing. The user found it.
- 🟡 [painful | evidence: `verify.md` W2] **No automated DB tests.** The DB constraint scenarios are covered only by one-off manual checks. The migration sync test only greps the SQL. There is still no test database or integration harness.
- 🟡 [painful | evidence: `verify.md` §7 row 7, W3] **Untested proxy, routing and layout.** The mobile layout has no automated test. The proxy `Set-Cookie` branch, the `/dashboard` wiring and the `dynamicParams` 404 routing are covered only by the user's smoke test.
- 📌 [nit | evidence: Task 3 and Task 6 reports] **Thin implementer reports.** Two reports gave full-suite results as "see status" instead of output. The controller re-ran the suite to fill the gap.
- 📌 [nit | evidence: `c38b660` report] **The F1 prefetch test was never seen failing.** The implementer's stash attempt failed, so its RED state was established only by reading the mock (re-review confirmed it would fail without the prop).

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Global constraints (all commits) | Trailers name `Claude Sonnet 5.5` instead of the mandated `Claude Opus 5.5` | Accurate attribution: Sonnet subagents wrote the commits (controller ruling) |
| Task 4 step 8 | The drift check produced an empty migration, not "Already in sync" | Prisma 7 behaviour; the empty migration means no drift, so it was deleted and not committed |
| Task 6 | Regenerated the stale Prisma client with `db:generate` | Prisma 7 `migrate dev` did not regenerate the client after Task 4 |
| Task 10 | Inici h1 is "Inici" instead of "Hola, {name}" | Design D8 is the authority; the spec only needs the House name in the header |
| Task 12 step 4 | Smoke test deferred `[~]`, then run by the user | It needs a signed-in director plus a non-director Clerk account in a browser |
| (new) final fix `c38b660` | `prefetch={false}` on the switcher, `React.cache` around `currentUser`, `dynamicParams = false` + `generateStaticParams`, team-page slug guard | Final whole-branch review findings |
| (new) smoke fix `d47efad` | Root `src/app/not-found.tsx` in Catalan with a "Torna a l'inici" button to `/dashboard` | User smoke-test findings |
| Spec `house-membership` | "Minimal employee data" reworded to "only a full name as personal data" | Resolves verify W1: `createdAt` is plan-mandated technical metadata |

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ (`brainstorm.md`, 2026-10-04) |
| superpowers:writing-plans                        | ✓ (`plan.md`) |
| superpowers:using-git-worktrees                  | ✓ (invoked; Step 0 detection ran; worked in place, see below) |
| superpowers:subagent-driven-development          | ✓ (ledger, per-task brief/report/review, final review, fix wave) |
| (transitive) superpowers:test-driven-development | ✓ (RED evidence in every implementer report except the F1 note in §2) |
| (transitive) superpowers:requesting-code-review  | ✓ (12 task reviews + Opus final review + 2 scoped re-reviews) |
| superpowers:finishing-a-development-branch       | pending (runs after archive) |

### Deliberately Skipped Skills

- **`superpowers:using-git-worktrees`, sub-step "Create Isolated Workspace"**
  - **What was skipped**: creating a new linked worktree. The skill ran (Step 0 detection plus a clean baseline, 2/2 tests), but its Step 1 was not executed.
  - **Why this cycle**: Step 0 found the session already on `feat/house-context`, a dedicated and clean feature branch created for this change (`git status` showed only two pre-existing untracked tooling paths). A worktree would have needed a second branch for the same change.
  - **How to prevent recurrence**: `scope-judgment rule`. If the current branch is already a clean, dedicated `feat/<change>` branch, Step 0 counts that as isolation and records it as "worked in place". The schema instruction could say this explicitly so it does not show up as a skip.

## 5. Surprises

- Prisma 7 `migrate dev --create-only` reports "no drift" by writing an empty migration, not by printing "Already in sync" as the plan expected.
- Prisma 7 `migrate dev` did not regenerate the client, so typecheck broke in the next task until `db:generate` ran.
- In Next 16, the router's prefetch reaches the proxy with the `next-router-prefetch` header stripped. Any proxy that writes a cookie from the path is therefore exposed to background prefetches. The fix belongs on the `Link` (`prefetch={false}`), not in the proxy.
- Clerk 7 `currentUser()` is not memoized per request. The "check the director in every page and data function" rule multiplied backend calls (3 to 5 per render) until it was wrapped in `React.cache`.
- `tsx` resolved the `@/` tsconfig paths for the seed with no extra configuration.

## 6. Promote candidates → long-term learning

- [ ] 🟡 **Every app needs a Catalan root `not-found.tsx` (and, when errors appear, `error.tsx`) with a way back.** → **Promote to** project CLAUDE.md (AGENTS.md "Conventions" or "Design system")
  > **Why**: Next's built-in 404 page is English and has no navigation. It slipped past the plan and every review, and the user found it in the smoke test (`d47efad`).
  > **How to apply**: when planning any change that adds routes or `notFound()` calls, check that `src/app/not-found.tsx` exists and is in Catalan.

- [ ] 🟡 **Links that point outside the current context must use `prefetch={false}` when the proxy writes state from the path.** → **Promote to** project CLAUDE.md (AGENTS.md "Layout", next to the `active-house` cookie line)
  > **Why**: production auto-prefetch silently overwrote the remembered House (`c38b660`). Dev mode hides it.
  > **How to apply**: whenever a `Link` targets another House, or the proxy sets a cookie or header based on the pathname.

- [ ] 🟡 **Run cookie and redirect smoke checks on `npm run build && npm start`, not `npm run dev`.** → **Promote to** schema (plan template, smoke-test step)
  > **Why**: prefetching and caching only happen in production builds, and the prefetch bug was invisible in dev.
  > **How to apply**: any manual smoke step that touches cookies, redirects, caching or prefetch.

- [ ] 🟡 **Add a DB integration harness (test database or Supabase branch) before the next migration with hand-written constraints.** → **Promote to** one-off follow-up (next change touching the schema)
  > **Why**: exclusion, CHECK and cascade behaviour is only manually verified (`verify.md` W2).
  > **How to apply**: when a migration adds constraints Prisma cannot model, or before the production Supabase project is created.

- [ ] 📌 **Cheap-model implementers work when the plan carries complete code; keep the Opus seat for the final whole-branch review.** → **Promote to** memory (feedback; extends `subagent-model-preference`)
  > **Why**: 12/12 Sonnet tasks passed review first time, and only the Opus final review found the production-only bug.
  > **How to apply**: when running subagent-driven development from a code-complete plan.

- [ ] 📌 **Prisma 7 CLI quirks: an empty `--create-only` migration means "no drift", and run `db:generate` after `migrate dev`.** → **Promote to** project CLAUDE.md (AGENTS.md "Commands")
  > **Why**: both surprised this cycle (Task 4, Task 6).
  > **How to apply**: any task that changes `schema.prisma`.

- [ ] 📌 **Follow-ups from verify §7 and the final review.** → **One-off** (track for the next House-scoped change)
  > **Why**: gaps that are real but not blocking: no mobile layout test; no tests for the proxy `Set-Cookie` branch or `dynamicParams` routing; deferred a11y polish (NoAccess `role="alert"`, TopBar `<nav>` root); before the first transfer form, validate dates with zod, map the exclusion error (23P01) to `TransferError`, and harden the seed's production guard.
  > **How to apply**: pick these up when the transfer UI or the next House section is planned.
