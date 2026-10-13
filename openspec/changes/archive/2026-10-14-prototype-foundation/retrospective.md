# Retrospective: prototype-foundation

> Written: 2026-10-14 (after verify passed: PASS WITH WARNINGS; W1 resolved in `5ad12b2`, W2 closed by the product owner's phone test, W3 approved)
> Commit range: `d0b7d02..7b6e4dc` (implementation and follow-ups); planning `760b97c..d0b7d02`
> Worktree: branch `ccr-856c263d-ewwg70`, worked in place (cloud session, then the product owner's local checkout)

---

## 0. Evidence

- **Commit range**: `d0b7d02..7b6e4dc` (32 commits: 15 plan-task commits, 1 final-review fix, 6 fixes from the local browser check and the product owner's feedback, 3 dev/deploy commits, 7 verify follow-ups). Planning: `760b97c`, `241e90b`, `f0ebb3e`, `d0b7d02`.
- **Diff size**: +4728 / -795 lines across 85 files (+4652 / -795 across 84 files without `package-lock.json`).
- **Tasks done**: 23/23 in `tasks.md` (2.4 and 6.5 were done in the local session; evidence in `db-check.md`).
- **Active hours**: plan tasks 1 to 15 landed in about 10 minutes of commit time (10:19 to 10:28, inline execution); the whole cycle, including the local checks, the Drawer change, deployment and verify follow-ups, ran over about 14 hours of wall clock on 2026-10-13/14.
- **Subagent dispatches**: 9. 1 final whole-branch review (Opus, cloud session); 1 verify writer (Opus); 1 deployment preparer (Sonnet); 6 verify-suggestion implementers (S1 and S5 on Sonnet, S2, S3, S4 and S6 on Haiku). No per-task implementers or reviewers (inline execution, see §4).
- **New external dependencies**: `@base-ui/react` 1.8.0 (MIT, pinned exact; runtime, behind the shadcn Drawer). Approved deviation from the proposal's "No new dependencies".
- **Bugs encountered post-merge**: none yet (not merged). Caught before merge: 1 by the final review (move form kept a stale seat, `766d93e`), 1 by the agent's browser check (gendered Catalan copy, `1d3bc67`), 1 by the agent while reviewing a subagent's work (the House `error.tsx` drew a second top bar, `a699425`), 1 deployment misconfiguration (variables only in Vercel Preview while the dev project serves Production; fixed in Vercel, documented in `7b6e4dc`).
- **OpenSpec validate state at archive**: pass (`openspec validate --all --json`: 3 items valid, 0 issues).
- **Test coverage signal**: Vitest 31 files / 209 tests (from 14 files / 67 tests at the start of the change). Lint, typecheck and `npm run build` with real keys are clean.

Commit chain (chronological):

```
760b97c docs(openspec): propose prototype-foundation (SPEC-003)
241e90b docs(openspec): apply the product owner's review to prototype-foundation
f0ebb3e docs(openspec): make PDG and PSI posts shared by both Houses
d0b7d02 docs(openspec): add the prototype-foundation implementation plan
3204492 feat(posts): define House and shared posts with weekly schedules
c7810d8 feat(rules): add AP and vacation rules, durations and dd/mm/aaaa dates
7c4fad5 feat(db)!: replace dated membership with people and opening balances
afa4488 feat(people): add the people store with seat checks
8173469 feat(db): seed fictional people and record the seat index check
d1ff3b7 feat(nav): show Saldos, Vacances, El mes and Equip and open the first available
8b15fc7 feat(people): add the form schemas shared by client and server
a1e1918 feat(people): build the team view and the director-gated reads
a3c4fd2 feat(people): add the Equip Server Functions
1f7a7f1 feat(ui): add the field, sheet, duration and date inputs
6ceaf4c feat(team): list posts, people, vacant seats and former members
ff948a5 feat(team): rename, move, deactivate and reactivate people
30fa6fe feat(team): edit opening balances per person and year
c7a0588 docs: document people and posts for the next specs
766d93e fix(team): clear the move form after a successful move
1d3bc67 fix(team): use copy that fits any person and record the local checks
3e2f749 fix(team): keep the saved message after a save refreshes the values
55df422 fix(ui): keep focus inside the sheet, lock the page scroll and return focus on close
2a5b095 fix(ui): show an error for letters in a duration field instead of dropping them
2321b02 feat(ui): animate the side sheet with the shadcn Drawer (Base UI)
eb27b3f chore(dev): allow other devices on the local network to load dev resources
9a1dc88 docs(dev): explain the LAN IP setting and why sign-in needs HTTPS on a phone
38dc920 chore(deploy): pin Vercel functions to Dublin and document the preview deployment
b9a5998 docs(openspec): add the prototype-foundation verify report
5ad12b2 docs(openspec): bring design D3 and D7 in line with the implementation
2cd116c docs(openspec): name src/lib/sections.ts as the home of SECTIONS in D8 and task 4.1
23c3542 docs(openspec): tick the plan steps and point to tasks.md as the tracker
d6063e5 refactor(server): remove the unused getHouseBySlug
192c43f test(team): cover the seat-taken message and the Equip page guards
90958e8 docs: name Base UI and the Sheet wrapper, and fix stale paths in AGENTS.md
a699425 feat(ui): show Catalan errors when a save or a House page fails unexpectedly
7b6e4dc docs(deploy): explain that a dev Vercel project needs the variables in Production too
<archive commit pending>
```

---

## 1. Wins

- **A plan with complete code made inline execution cheap.** Every task brief carried exact code and tests, so the executor transcribed and ran them: 15 tasks in about 10 minutes of commit time (§0), each watched red then green, one ledger line per task.
- **Planning-time spikes removed two unknowns before any code.** A throwaway local Postgres proved that Prisma 7 keeps hand-written partial unique indexes (empty `drift_check` migration) and that `@prisma/adapter-pg` raises `P2002` for them. Both facts went into the plan; the store's race handling (`people-store.ts`, `writeToSeat`) worked first time and was confirmed again on Supabase dev (`db-check.md`).
- **The Review Focus list caught a real calendar bug at plan time.** ISO week parity breaks in 53-week years (2026). The plan anchored alternation to a fixed Monday (`weekIndex`), with tests for `2026-12-28` vs `2027-01-04` (`dates.test.ts`, `posts.test.ts`).
- **A local throwaway Postgres made database work verifiable in the cloud session.** The init migration, the seed (run twice) and the hand checks of indexes and CHECKs ran without touching Supabase, which was reset only after the product owner's explicit confirmation (Prisma's AI-agent guard enforced it).
- **The browser check found what unit tests could not.** Gendered copy ("Mou-la", "la pots reincorporar") and the stale-URL edge case were found by driving the real app (`db-check.md`, Browser check).
- **Model choice per subagent kept cost low.** Haiku for four mechanical doc edits, Sonnet for code and tests, Opus only for the final review and verify (§0). All six suggestion agents finished in one dispatch with disjoint file sets and no merge conflicts.

## 2. Misses

- 🟡 [painful | evidence: `2321b02`, product owner feedback] **The hand-made sheet had no animation.** "No new dependencies" pushed the plan to a custom `Sheet`; the product owner found it abrupt. It was replaced by the shadcn Drawer on Base UI after the fact, rewriting the focus tests (`sheet.test.tsx`). Choosing the overlay component during design would have saved a cycle.
- 🟡 [painful | evidence: `3e2f749`] **Forms keyed on saved values remounted and lost "Desat.".** The plan used `key` to reset forms after a save; the final review flagged it as Minor and the product owner saw it. Fixed with react-hook-form `values`.
- 🟡 [painful | evidence: `.next/dev/logs`, `9a1dc88`] **Phone testing over `http://<lan-ip>` broke Clerk sign-in.** The page is not a secure context, so Clerk cannot use Web Crypto. It took a round of debugging (and a misleading first explanation of `allowedDevOrigins`, corrected in `9a1dc88`) to see it was not an app bug.
- 🟡 [painful | evidence: Vercel logs, `7b6e4dc`] **The first deployment returned 500 everywhere.** The runbook (`38dc920`) told the product owner to add variables to Preview only, but a dedicated `-dev` Vercel project serves its main URL from Production.
- 🟡 [painful | evidence: browse daemon logs] **The headed browser kept closing.** gstack `browse` shuts down headed mode 15 s after the CLI exits; it took two failed handoffs to find `BROWSE_PARENT_PID=0` (now a gstack learning).
- 📌 [nit | evidence: S1 report, `a699425`] **A subagent's `error.tsx` drew a second top bar** (a segment's error boundary renders inside that segment's layout). Caught in the coordinator's review with a failing test before commit.
- 📌 [nit | evidence: `verify.md` S5] **Two UI paths had no test until verify** (seat-taken message in the add form, Equip page guards). Added in `192c43f`.
- 📌 [nit | evidence: curl to `/paulo-freire/team`] **Non-browser requests to protected pages get 500** (`requireUser()` throws when the proxy lets a non-document request through). Browsers are redirected to sign-in correctly. Not fixed in this change.

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| 1.2 / design D3 | Week alternation counted from a fixed Monday instead of ISO week parity | 2026 has 53 ISO weeks; parity would give the same night seat two weeks in a row (`5ad12b2`) |
| 2.4 | Index checks first on a local Postgres, Supabase reset later in the local session | No database credentials in the cloud session; the reset is destructive and needed explicit consent (`db-check.md`) |
| 4.1 / design D8 | `SECTIONS` in `src/lib/sections.ts`, not `section-nav.tsx` | A Server Component (the `/[house]` redirect) calls it; a `'use client'` module only exports client references (`2cd116c`) |
| 6.1 / design D7 | Letters stay visible in the duration field and show the error on blur | The spec says letters show an error; the mask had silently dropped them (`2a5b095`) |
| 6.1 / 6.3 | Custom `Sheet` replaced by the shadcn Drawer on Base UI; `@base-ui/react` added | Product owner wanted the animation and swipe behaviour; approved deviation from "No new dependencies" (`2321b02`) |
| 6.3 | Saved values flow back through react-hook-form `values` instead of remount keys | Keeps "Desat." visible after a save (`3e2f749`) |
| 6.5 / 14 | Browser check done by the agent with the product owner's session in the local checkout | No Clerk keys in the cloud session (`db-check.md`) |
| (new) | Catalan error handling, LAN dev origins, Vercel config and runbook | Verify suggestion S1, phone testing, first deployment (`a699425`, `eb27b3f`, `38dc920`, `7b6e4dc`) |

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ (`brainstorm.md`, before this session) |
| superpowers:writing-plans                        | ✓ (`plan.md`, `d0b7d02`) |
| superpowers:using-git-worktrees                  | ✗ |
| superpowers:subagent-driven-development          | ✗ (superpowers:executing-plans used instead) |
| (transitive) superpowers:test-driven-development | ✓ (every plan step red then green; post-plan fixes each with a failing test first) |
| (transitive) superpowers:requesting-code-review  | ✓ (Opus final review; verify by Opus) |
| superpowers:finishing-a-development-branch       | ✓ (PR opened at the end of this cycle) |

### Deliberately Skipped Skills

- **`superpowers:using-git-worktrees`**
  - **What was skipped**: the whole skill; work happened in place on `ccr-856c263d-ewwg70`.
  - **Why this cycle**: the cloud session was an ephemeral container already checked out on the dedicated feature branch the product owner named ("Continúa la change prototype-foundation en la rama ccr-856c263d-ewwg70"); the local session continued on the same branch with the product owner's dev server running from that checkout.
  - **How to prevent recurrence**: `scope-judgment rule`: when the session starts on a dedicated, non-default feature branch in a fresh clone or container, the branch already gives the isolation the worktree skill provides; record that in the plan's execution notes instead of creating a nested worktree.

- **`superpowers:subagent-driven-development`**
  - **What was skipped**: the per-task implementer and reviewer loop; superpowers:executing-plans ran the plan inline with one final Opus review.
  - **Why this cycle**: at the plan handoff the agent recommended inline execution because the plan carried complete code and tightly chained interfaces, and the product owner accepted ("si aún así recomiendas hacer la implementación en esta misma sesión, adelante"). The ledger and the final review replaced per-task reviews.
  - **How to prevent recurrence**: `skill description tightening`: the superpowers-bridge schema's apply phase should list superpowers:executing-plans as an accepted alternative when the plan carries full code and the product owner chooses it, so this is not recorded as a skip.

## 5. Surprises

- Prisma 7 refuses `migrate reset` when it detects an AI agent, and requires the user's consent text in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Good guard; plan for it.
- Base UI does not animate a drawer that mounts already open (`useTransitionStatus` only starts when it goes from closed to open), so the person sheet opens one frame after mounting.
- `allowedDevOrigins` takes the host typed in the phone's address bar (the Mac's LAN IP), not the phone's IP.
- Plain `http://<lan-ip>` is not a secure context: `crypto.subtle` is undefined and Clerk's session cookies cannot be prepared, so the server renders signed-out after sign-in until a reload.
- Vercel's `region` in request logs is the entry point (for example `cdg1`), not where the function ran; `vercel inspect` showed every function in `dub1`.
- shadcn ships the same components in two flavours (Radix and Base UI); the product owner did not know and preferred Base UI once the difference was explained.

## 6. Promote candidates → long-term learning

- [ ] 🟡 **Pick overlay and animation primitives at design time, not after the first browser check.** → **Promote to project CLAUDE.md** (`AGENTS.md` Design system section)
  > **Why**: the custom sheet built to honour "No new dependencies" was replaced one day later by the shadcn Drawer (`2321b02`), rewriting its tests.
  > **How to apply**: when a spec adds a modal, sheet, popover or toast, name the shadcn Base UI component in design.md and include the dependency in the proposal's Impact.

- [ ] 🟡 **A dedicated `-dev` Vercel project serves Production; its variables must be in Production too.** → **Promote to memory** (type: feedback)
  > **Why**: the first deployment of `casa-infants-dev` returned 500 everywhere because the runbook set variables for Preview only (Vercel logs, `7b6e4dc`).
  > **How to apply**: whenever preparing a Vercel runbook, ask whether the project is dev-only and list the environments the variables need.

- [ ] 🟡 **Test signed-in screens on a phone over HTTPS (Vercel or a tunnel), never `http://<lan-ip>`.** → **Promote to project CLAUDE.md** (`AGENTS.md` Commands section)
  > **Why**: Clerk sign-in silently fails over plain HTTP on a LAN IP (no secure context, `9a1dc88`).
  > **How to apply**: when the product owner wants to try the app on a real device.

- [ ] 📌 **Use `values`, not `key`, to refresh react-hook-form after a Server Function revalidates.** → **Promote to project CLAUDE.md** (`AGENTS.md` Conventions)
  > **Why**: remount keys reset local UI state such as "Desat." (`3e2f749`).
  > **How to apply**: any form whose defaults come from server props that change after a save.

- [ ] 📌 **A segment's `error.tsx` renders inside that segment's layout; do not repeat the layout's chrome.** → **One-off** (recorded in the file's comment)
  > **Why**: caught in review (`a699425`); Next's docs state it, so a comment in the file is enough.

- [x] 📌 **gstack `browse` headed mode needs `BROWSE_PARENT_PID=0` in Claude Code.** → **Promoted to gstack learnings** (logged in this session)
  > **Why**: the headed window closed 15 s after each CLI call until the watchdog was disabled.
  > **How to apply**: before any `browse handoff` or `--headed` run.

- [ ] 📌 **Redirect instead of throwing in `requireUser()`** → **One-off** (follow-up task)
  > **Why**: non-browser requests to protected pages get a 500 instead of a redirect or 401.
  > **How to apply**: next time `src/lib/auth.ts` is touched (SPEC-002 roles).
