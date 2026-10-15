# Retrospective: saldos

> Written: 2026-10-15 (after verify passed: PASS WITH WARNINGS; W1 and W2 recorded below)
> Commit range: `07495d8..54c839e` (implementation and follow-ups); planning `ad0ff68..07495d8`
> Worktree: branch `ccr-1c111fd4-xxyrxr`, worked in place (cloud session, then the product owner's local checkout)

---

## 0. Evidence

- **Commit range**: `07495d8..54c839e` (30 commits: 16 plan-task commits plus 2 task fix rounds, 5 final-review fixes, 2 fixes from the product owner's checks (Safari rows, holidays), 1 verify test, 4 record-keeping commits). Planning: `ad0ff68`, `07495d8`.
- **Diff size**: +3357 / -57 lines across 56 files (no `package-lock.json` change).
- **Tasks done**: 23/23 in `tasks.md` (5.6 done in the local session; evidence in `db-check.md` §3).
- **Active hours**: plan tasks 1 to 16 plus the final-review fixes landed in about 50 minutes of commit time in the cloud session (subagent-driven); the local session (browser check, Safari fix, holidays, verify, archive) took about 2 hours on 2026-10-15.
- **Subagent dispatches**: 41. 1 pre-flight plan scan (Opus); 16 implementers (Sonnet) plus 2 fix rounds by resuming them; 16 task reviewers (Sonnet for tasks 1 to 4, 9, 10, 14 to 16; Opus for 5 to 8 and 11 to 13) and 2 scoped re-reviews (Sonnet); 1 final whole-branch review (Opus), 1 final fix wave (Sonnet), 1 scoped re-review (Opus); 1 verify traceability sweep (Sonnet).
- **New external dependencies**: none (`@base-ui/react` 1.8.0 was already a dependency; `Dialog` uses `@base-ui/react/dialog`).
- **Bugs encountered post-merge**: none yet (not merged). Caught before merge: 4 plan defects by the pre-flight scan (a nav test the plan forgot, a Vitest 4 mock reset, a trimmed-text matcher, 15 vs 16 seeded APs); a concurrent double delete handing out two undo snapshots (Task 6 review, `85c7a79`); a false sentence in `docs/domain.md` (Task 15 review, `d7b194f`); an undo toast that could unmount mid-undo and Equip writes not revalidating Saldos (final review, `d938acc`, `d955eff`); every desktop row click opening the last row in Safari (product owner, `a7ceab2`); 16 holidays instead of 14 (product owner, `efe5979`).
- **OpenSpec validate state at archive**: pass (`openspec validate --all --json`: 3 items valid, 0 issues).
- **Test coverage signal**: Vitest 47 files / 357 tests (from 31 files / 209 tests at the start of the change). Lint, typecheck and `npm run build` are clean.

Commit chain (chronological):

```
ad0ff68 docs(openspec): propose saldos (SPEC-004)
07495d8 docs(openspec): add the saldos implementation plan
d3236f0 feat(rules): add the 2026 public holidays in code
ed21bad feat(rules): compute AP balances and check a new AP
b5a733e feat(saldos): add the AP form schemas shared by client and server
6392755 feat(saldos): build the Saldos view, totals and labels
807445c feat(db): add the aps table with year, date window and minutes checks
51068c6 feat(saldos): add the AP store with the limits checked under a person lock
85c7a79 fix(saldos): report whether deleteAp removed the AP
7e3400b feat(saldos): add the director-gated Saldos read and a generic action result
30e5710 feat(saldos): add the Server Functions to record, delete and restore APs
ccf6e07 feat(ui): add a centred Dialog for short forms (Base UI)
196e965 feat(ui): add the undo toast and a message callout with icons
f430b00 feat(saldos): list balances per House with totals, filter, search and year
9e9929a feat(saldos): add the AP form with live rule checks and the last-request prefill
c5b68d2 feat(saldos): open a person's APs, record and delete them with undo
1d52e61 feat(db): seed fictional 2026 APs through the AP rules
cc5ad19 docs: document Saldos, the AP rules and FASI's instruction FPOL32
d7b194f docs: correct the holiday count note in the domain doc
6e51db3 docs(openspec): record the saldos checks and tick the tasks
734eeda docs(openspec): put the pending note on task 5.6
d938acc fix(saldos): keep the undo toast open while Desfés is pending
d955eff fix(team): revalidate Saldos after Equip writes
22532de fix(saldos): show the hourglass on negative surplus tiles
6630a06 fix(saldos): pin createAp to READ COMMITTED
4c1e61c docs(openspec): record the final review fixes for saldos
a3abb0f docs(openspec): update the saldos checks after the final review fixes
bdac6a2 docs(openspec): record the saldos browser check
a7ceab2 fix(saldos): keep each table row's click target inside the row in Safari
efe5979 fix(saldos): list the 14 days off of 2026, without the two Sunday holidays
45e2fea docs(openspec): record the Safari row check
54c839e test(saldos): cover a moved person's APs on the new House
<verify, retrospective and archive commits pending>
```

---

## 1. Wins

- **A pre-flight scan of the plan paid for itself before Task 1.** One Opus agent ran every task's code on a copy of the repo and found four defects (D-1 to D-4 in §0). Each became a ruling carried into the right task's dispatch, so none cost a fix round.
- **Per-task reviews caught two real bugs that tests passed over.** The Task 6 reviewer traced two concurrent deletes both returning an undo snapshot (`85c7a79`); the Task 15 reviewer caught a false claim about the holiday table (`d7b194f`).
- **The final whole-branch review earned its Opus seat.** It walked the five Review Focus cases end to end and found two Important issues no task review could see across files: the undo toast's timer during a slow "Desfés" and Equip writes not revalidating Saldos (`d938acc`, `d955eff`).
- **Concurrency was proven, not assumed.** Two concurrent fifth APs on a real Postgres saved exactly one (`db-check.md` §2), and the isolation level the lock relies on is now pinned (`6630a06`).
- **Driving the real Safari made the WebKit bug provable.** `safaridriver`, a component rendered by Vitest and the dev server's compiled CSS reproduced "every row opens Núria" without signing in, compared six candidate fixes, and confirmed the chosen one (`db-check.md` §3).
- **The ledger kept 41 dispatches honest.** Every ruling, fix round and deferred minor was written down, and the final reviewer triaged the deferred minors from it.

## 2. Misses

- 🟡 [painful | evidence: `a7ceab2`, product owner's Safari report] **The Safari row bug reached the product owner.** The final reviewer had flagged `relative` on a `<tr>` as "check in Safari" (Minor #3), but the browser check ran in Chromium only, so the risk was only closed when the product owner tried Safari. The main user has a Mac and an iPhone.
- 🟡 [painful | evidence: previous retrospective §6, this session's two failed handoffs] **The headed-browser watchdog bit again.** The previous change already learned that gstack `browse` handoff needs `BROWSE_PARENT_PID=0` and logged it as a gstack learning, but this session never consulted it and lost two handoffs before re-deriving the fix.
- 🟡 [painful | evidence: `efe5979`] **The 2026 holiday list carried two Sunday holidays.** `docs/domain.md` §9 copied the director's FESTIUS tab (16 rows, including Tots Sants and Constitució on Sundays) while FPOL32 says 14. The mismatch was spotted as an open question but only resolved when the product owner answered.
- 📌 [nit | evidence: Task 11 and Task 13 reports] **Two UI tasks recorded no RED run.** Implementers wrote tests and code together; the reviews accepted it because the assertions were behavioural, but TDD evidence is missing for those two tasks.
- 📌 [nit | evidence: Task 15 report] **An implementer trusted a truncated file read.** It "saw" 12 holiday rows and wrote a false sentence; the reviewer caught it with `git show`.
- 📌 [nit | evidence: Task 16, `734eeda`] **A note landed on the wrong task** (3.2 instead of 5.6) and needed a second commit.
- 📌 [nit | evidence: `db-check.md` §3] **A local-database seed and a signed-in browser were set up twice** (cloud, then local), because the cloud container had no Clerk keys.

**Follow-ups (verify W2)**: a failed "already gone" delete leaves a ghost row until the next render; deleting the last AP of a former member with no stored balances drops the open sheet without animation; a prefilled hours value stays after switching to a person or type with no prefill.

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| 6 / 8 | `deleteAp` returns a boolean; the delete action answers "already gone" when it is false | Two concurrent deletes would both hand out an undo snapshot (`85c7a79`) |
| 8 | "Already gone" test sets `findAp` to null explicitly | Vitest 4 `clearAllMocks` keeps return values between tests (pre-flight D-2) |
| 11 | `section-nav.test.tsx` updated with the task; heading and year switcher inside the async child | The plan forgot the nav test (D-1); the heading reads `params`/`searchParams` (S-1) |
| 13 | Toast dismissed only if its key is still current | A late dismiss from a slow undo could clear a newer toast |
| 14 / 15 | 15 seeded APs, not 16 | The plan's AP list has 15 entries (D-4) |
| (final review) | Undo countdown paused while pending; Equip revalidates Saldos; hourglass on warning tiles; READ COMMITTED pinned | Final review findings (`d938acc`, `d955eff`, `22532de`, `6630a06`) |
| (local) | Row containing block through a no-op `transform`; 14 holidays | Safari ignores `relative` on rows (`a7ceab2`); Tots Sants and Constitució fall on Sundays (`efe5979`) |

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ (`brainstorm.md`, before this session) |
| superpowers:writing-plans                        | ✓ (`plan.md`, `07495d8`) |
| superpowers:using-git-worktrees                  | ✗ |
| superpowers:subagent-driven-development          | ✓ (16 tasks, one implementer and one reviewer each, final review) |
| (transitive) superpowers:test-driven-development | ✓ (RED then GREEN in 14 of 16 task reports; the holiday fix test written first) |
| (transitive) superpowers:requesting-code-review  | ✓ (per-task reviews and the Opus final review) |
| superpowers:finishing-a-development-branch       | ✓ (PR #27) |

### Deliberately Skipped Skills

- **`superpowers:using-git-worktrees`**
  - **What was skipped**: the whole skill; work happened in place on `ccr-1c111fd4-xxyrxr`.
  - **Why this cycle**: the cloud session was an ephemeral container and the product owner named the dedicated feature branch that held the plan ("Implement OpenSpec change `saldos` ... on branch ccr-1c111fd4-xxyrxr"); the local session continued on the same branch.
  - **How to prevent recurrence**: `scope-judgment rule`, same as prototype-foundation: a dedicated non-default branch in a fresh container already isolates the work. Second cycle with the same answer, so it is a §6 candidate for the schema.

## 5. Surprises

- Safari 26.6 still ignores `position: relative` on table rows; `transform` (2D or 3D), `translate` and `clip-path` make the row a containing block, while `will-change: transform` and `contain: layout` do not.
- Safari WebDriver's synthetic pointer moves do not trigger `:hover`, and a `file://` page in Safari cannot load stylesheets from `http://localhost`.
- Safari's automation window is a separate, signed-out session, so a rendered-component page was the fastest way to test the real markup.
- `next build` succeeded in the container with no environment variables at all.
- Vitest 4's `vi.clearAllMocks()` keeps `mockResolvedValue` values between tests.

## 6. Promote candidates → long-term learning

- [ ] 🟡 **A whole-row link overlay in a table needs a row that Safari treats as a containing block.** → **Promote to project CLAUDE.md** (`AGENTS.md` Design system section)
  > **Why**: `relative` on `<tr>` made every row open the last person in Safari (`a7ceab2`).
  > **How to apply**: when a table row is made clickable with a link's `::after`, put a no-op `transform` on the row (or make the whole row a non-table element), and check it in Safari.

- [ ] 🟡 **Check layout-sensitive UI in Safari before merge, not only in Chromium.** → **Promote to project CLAUDE.md** (`AGENTS.md` Commands section)
  > **Why**: the main user is on a Mac and an iPhone, and the Safari bug was found by hand after the Chromium check passed.
  > **How to apply**: for any new table, overlay or positioned layout, drive Safari with `safaridriver` (Settings → Developer → "Allow remote automation") against a locally served page, or ask the product owner to check it.

- [ ] 🟡 **Before a gstack `browse` handoff, export `BROWSE_PARENT_PID=0`.** → **Promote to memory** (type: feedback; the gstack learning alone did not prevent it)
  > **Why**: the headed window closes about 15 s after each CLI call otherwise; this happened in two cycles.
  > **How to apply**: whenever the product owner needs to sign in through a browse handoff.

- [ ] 📌 **A holiday list counts days off: a holiday on a Sunday that is not moved is left out.** → **One-off** (recorded in `src/lib/holidays.ts` and `docs/domain.md` §9)
  > **Why**: 16 vs 14 for 2026 (`efe5979`).
  > **How to apply**: when adding the 2027 list.

- [ ] 📌 **A pre-flight run of the plan's code on a copy of the repo before execution.** → **Promote to schema** (superpowers-bridge apply phase)
  > **Why**: it found four plan defects before Task 1, each fixed by a ruling instead of a fix round.
  > **How to apply**: for plans that carry complete code, run every task's code once on a scratch copy and record the failures as rulings.

- [ ] 📌 **Working in place on a dedicated branch in a fresh container is not a worktree skip.** → **Promote to schema** (apply phase guidance)
  > **Why**: recorded as a deliberate skip in two consecutive cycles with the same reason.
  > **How to apply**: accept a dedicated non-default branch in a fresh clone as satisfying `using-git-worktrees`.
