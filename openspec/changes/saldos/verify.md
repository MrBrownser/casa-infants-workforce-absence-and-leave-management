# Verification Report

> Produced by the `openspec-verify-change` skill after the apply phase, to confirm that the
> implementation matches the specs, design and tasks. A failed check sends the work back to the
> artifact concerned before verify is run again.

**Change**: `saldos`
**Verified at**: `2026-10-15 23:40` (Europe/Madrid)
**Verifier**: Claude Code (coordinator) with one traceability subagent (Sonnet), `openspec-verify-change` skill, on branch `ccr-1c111fd4-xxyrxr` at `54c839e`

---

## Summary scorecard

| Dimension | Status |
|---|---|
| Completeness | 23/23 tasks done; 2 delta specs (16 added requirements in `ap-balances`, 2 modified in `house-context`) |
| Correctness | 18/18 requirements implemented; every scenario covered by an automated test or a recorded manual check (`db-check.md`) |
| Coherence | Design D1 to D14 followed; every deviation recorded in `design.md` → "Changed during implementation"; no delta spec text contradicts a deviation |
| Checks | lint, typecheck, test (357/357) and build all green on `54c839e`, run by the verifier |

Findings: **0 CRITICAL, 2 WARNING, 4 SUGGESTION**. Decision: **PASS WITH WARNINGS**, ready to archive.

---

## Checks run by the verifier

All run from the repo root on `54c839e`, Node 24.9.0.

```text
$ npm run lint
> eslint
(no output)                                   exit 0

$ npm run typecheck
> tsc --noEmit
(no output)                                   exit 0

$ npm test
> vitest run
 Test Files  47 passed (47)
      Tests  357 passed (357)                 exit 0

$ npm run build            (Clerk keys from .env.local; values not printed)
▲ Next.js 16.2.9 (Turbopack)
✓ Compiled successfully in 2.4s
├ ƒ /[house]/saldos
├ ƒ /[house]/team                             exit 0
```

Database and browser evidence is not re-run here: see `db-check.md` (§1 migration and CHECKs and §2
two concurrent fifth APs, on a throwaway local Postgres 16; §3 browser check on a throwaway local
Postgres 14 with the seed, desktop 1280px and mobile 390px, both Houses, plus Safari 26.6.2).

---

## 1. Structural Validation (`openspec validate --all --json`)

- [x] Every item `"valid": true`

**Result**:

```text
house-context      spec    valid: true  issues: []
people-and-posts   spec    valid: true  issues: []
saldos             change  valid: true  issues: []
totals: items 3, passed 3, failed 0
```

`openspec validate saldos --strict`: "Change 'saldos' is valid".

| Item | Type | Issues |
|---|---|---|
| none | | |

---

## 2. Task Completion (`tasks.md`)

- [x] Every `- [ ]` is now `- [x]` (23/23; no `[ ]` or `[~]` left)

**Incomplete tasks**: none. Task 5.6 (browser check) was deferred from the cloud session (no Clerk
keys) and done in the product owner's local checkout (`bdac6a2`, `45e2fea`).

| Task | Reason | Blocks archive |
|---|---|---|
| none | | |

Progress was tracked in `tasks.md`; `plan.md` keeps its step checkboxes unticked (the plan header
says `tasks.md` is the tracker).

---

## 3. Delta Spec Sync State

| Capability | Sync state | Notes |
|---|---|---|
| `ap-balances` | ✗ Needs sync | New capability; `openspec/specs/ap-balances/` does not exist yet. Created on archive. |
| `house-context` | ✗ Needs sync | MODIFIES "Product sections" (Saldos available) and "House home opens the first available section" (`/[house]` opens Saldos). Both names exist in the main spec. |

Expected state before archive: `/opsx:archive saldos` applies both deltas.

---

## 4. Design / Specs Coherence Spot Check

| Sample | design | specs | Gap |
|---|---|---|---|
| D1 `aps` table | person, House, kind, year, date, minutes, `created_at`; CHECKs on year, window, minutes | "Minimal AP data", "AP year and date window", "Length of one request" | none |
| D4 rules and copy | one `checkNewAp` for page, form and server; Catalan messages | "AP types and yearly limits" (scenario messages) | Signature named differently in D4 than in code; recorded in "Changed during implementation" |
| D5 lock | person row `FOR UPDATE` in a transaction | "AP types and yearly limits" (concurrent fifth AP) | now also pinned to READ COMMITTED (`6630a06`), recorded |
| D6 undo | snapshot of the deleted AP, restore through `createAp` | "Delete an AP and undo any change" | `deleteAp` returns a boolean so a concurrent second delete gets "already gone" (`85c7a79`), recorded |
| D7 Server Functions | director, House slug, zod re-parse, person belongs here | "Record an AP", "Director-only Saldos" | none |
| D8 view | `buildSaldosView` shared by server and client | "Saldos lists balances of a House", "Former members", "Totals and filters" | Arguments are an object, not positional; recorded |
| D9 page | frame in the page, request reads in an async child | "Saldos year" | Heading and year switcher live in the async child (they read `params`/`searchParams`); recorded |
| D10 form | person, tiles, type, day, hours, shortcut, prefill, preview | "Remaining time in the form", "Public holiday notice" | none |
| Holidays | `docs/domain.md` §9 list | "Public holiday notice" (no count in the spec) | 14 days off, not 16 (`efe5979`), recorded |

**Drift warnings** (non-blocking): none beyond the recorded deviations. D9's body text still
describes the original frame placement; the "Changed during implementation" note overrides it.

---

## 5. Implementation Signal

- [x] No unstaged or untracked files in the worktree (`git status --short` empty)
- [x] All commits pushed to `origin/ccr-1c111fd4-xxyrxr` (PR #27)

**Commit range**: `07495d8..54c839e` (30 commits after the plan; 56 files, +3357 / -57).

Post-plan commits accounted for:

| Commit | Change | Evidence |
|---|---|---|
| `85c7a79` | `deleteAp` reports whether it removed the row | `src/server/aps-store.ts`; `aps-store.test.ts`; `actions.test.ts` (concurrent delete) |
| `d938acc` | Undo toast keeps its countdown paused while "Desfés" is pending | `src/components/undo-toast.tsx`; `undo-toast.test.tsx` (failure after `TOAST_MS`) |
| `d955eff` | Equip writes revalidate Saldos | `src/app/(app)/[house]/team/actions.ts`; `team/actions.test.ts` |
| `22532de` | Hourglass on negative surplus tiles | `saldos-table.tsx`, `person-saldo-sheet.tsx`; their tests |
| `6630a06` | `createAp` pinned to READ COMMITTED | `aps-store.ts`; `aps-store.test.ts` |
| `a7ceab2` | Safari: row is the containing block of its link overlay through a no-op `transform` | `saldos-table.tsx`; `db-check.md` §3 (safaridriver probe and the product owner's check) |
| `efe5979` | 2026 holidays: 14 days off (Tots Sants and Constitució fall on a Sunday) | `src/lib/holidays.ts`; `holidays.test.ts`; `docs/domain.md` §9 |
| `54c839e` | Test for a person moved to the other House | `src/lib/saldos.test.ts` |

---

## 6. Front-Door Routing Leak Detector (warning, non-blocking)

```bash
ls docs/superpowers/specs/*.md 2>/dev/null
# no matches
```

- [x] No files

---

## 7. Deferred Manual Dogfood vs Automated Test Equivalence

`tasks.md` has no `[~]` rows left. The manual checks, and what automated tests cover the same ground:

| Manual check | Equivalent automated test | Coverage assessment | Real gap? |
|---|---|---|---|
| Task 2.2: CHECKs reject a bad date, 0 and 1441 minutes (`db-check.md` §1) | `src/lib/aps-migration.test.ts` (CHECK text present); `balances.test.ts`, `ap-schemas.test.ts` (same rules in code) | Only the manual run proves Postgres enforces them. Done. | No |
| Task 3.2: two concurrent fifth APs save one (`db-check.md` §2) | `aps-store.test.ts` (lock taken before reads; isolation level passed) | Only the manual run proves the lock under real concurrency. Done. | No |
| Task 5.6: browser check, desktop and 390px, both Houses (`db-check.md` §3) | Component tests for the board, sheet, form, toast and dialog | Layout, real Clerk sign-in and the real database only by the manual check. Done. | No |
| Safari row click target (`db-check.md` §3) | none: jsdom has no layout engine | WebKit's containing-block behaviour can only be checked in WebKit. Reproduced and verified with safaridriver and by hand. | **Yes** (W1) |

---

## Requirement and scenario traceability

Paths are relative to the repo root. "Manual" means `db-check.md`.

### `ap-balances` (ADDED)

| Requirement / Scenario | Code | Test | Status |
|---|---|---|---|
| AP types and yearly limits / Sixth AP no recuperable | `src/lib/balances.ts` (`checkNewAp`); `src/server/aps-store.ts` (`createAp`, locked) | `balances.test.ts` "accepts a fifth AP no recuperable and rejects a sixth"; `aps-store.test.ts`; `ap-form.test.tsx`; Manual §2, §3.4 | Covered |
| ... / Yearly hours exceeded | `balances.ts` | `balances.test.ts` (22 h + 2:30) | Covered |
| ... / Exactly the remaining hours | `balances.ts` | `balances.test.ts` | Covered |
| Length of one request / Night plus REE | `balances.ts`; `src/lib/ap-schemas.ts`; migration `aps_minutes_check` | `balances.test.ts`; `ap-schemas.test.ts` | Covered |
| ... / Invalid hours | `ap-schemas.ts`; `duration-input.tsx` | `ap-schemas.test.ts` (9:75, 0:00, 25:00); `ap-form.test.tsx` | Covered |
| AP year and date window / January AP | `balances.ts` (`apDateWindow`); `src/lib/saldos.ts` (`apDateLabel`); migration `aps_date_check` | `balances.test.ts`; `saldos.test.ts` (both years); `person-saldo-sheet.test.tsx`; Manual §1, §3.6 | Covered |
| ... / Date outside the window | same | `balances.test.ts`; Manual §1 | Covered |
| AP recuperable deducted from surplus / Surplus goes negative | `balances.ts` | `balances.test.ts`; `ap-form.test.tsx` | Covered |
| ... / Owed hours shown | `saldos-table.tsx` (`SurplusValue`); `person-saldo-sheet.tsx` | `saldos-board.test.tsx`, `person-saldo-sheet.test.tsx` ("Deu 4 h"); Manual §3.8 ("Deu 6 h 30 min") | Covered (S2) |
| Balances follow the person / Person moved to the other House | `aps-store.ts` (`listApsOf` by person); `saldos.ts` | `saldos.test.ts` "shows a moved person on the new House ..."; `actions.test.ts` (restore keeps the House) | Covered |
| ... / Shared post | `actions.ts` (`belongsHere`) | `actions.test.ts`; `saldos.test.ts`; Manual §3.8 | Covered |
| Minimal AP data / AP fields | migration `aps` table; `ap-schemas.ts` | `aps-migration.test.ts`; `ap-schemas.test.ts` | Covered |
| ... / Delete removes the row | `aps-store.ts` (`deleteAp`, hard delete) | `aps-store.test.ts`; Manual §3.7 | Covered |
| Record an AP / Preview | `ap-form.tsx`; `balances.ts` | `balances.test.ts`; `ap-form.test.tsx` | Covered |
| ... / Person of the other House | `actions.ts` | `actions.test.ts` | Covered |
| Remaining time in the form / Last request prefilled | `balances.ts` (`remainingFor`); `ap-form.tsx` | `balances.test.ts`; `ap-form.test.tsx` | Covered |
| ... / Shortcut | same | `ap-form.test.tsx`; `balances.test.ts` | Covered |
| Public holiday notice / AP on Christmas | `src/lib/holidays.ts`; `balances.ts` | `balances.test.ts`; `ap-form.test.tsx`; `holidays.test.ts`; Manual §3.5 | Covered |
| Delete an AP and undo any change / Undo a new AP | `saldos-board.tsx`; `undo-toast.tsx` | `saldos-board.actions.test.tsx` | Covered |
| ... / Undo a delete | `actions.ts` (`restoreApAction`) | `saldos-board.actions.test.tsx`; `actions.test.ts`; Manual §3.7 | Covered |
| ... / Undo blocked by a limit | `actions.ts`; `undo-toast.tsx` | `actions.test.ts`; `undo-toast.test.tsx` | Covered |
| Saldos lists balances of a House / Vacation with AA | `saldos.ts` (`vacationLabel`) | `saldos.test.ts`; `saldos-board.test.tsx` ("33 dies (2 AA)") | Covered |
| ... / Paulo Freire 2026 | `saldos-content.tsx`; `src/server/saldos.ts`; `saldos.ts` | `saldos.test.ts`; `saldos-board.test.tsx`; `server/saldos.test.ts`; Manual §3.1 | Covered |
| Saldos year / Another year | `saldos-content.tsx`; `dates.ts` (`parseYearParam`); `year-switcher.tsx` | `saldos-content.test.tsx`; `dates.test.ts` | Covered |
| Former members on Saldos | `saldos.ts` | `saldos.test.ts`; `saldos-board.test.tsx`; Manual §3.3 | Covered |
| Saldos totals and filters / Who owes, Search, Nobody matches | `saldos.ts`; `saldos-stats.tsx`; `saldos-toolbar.tsx` | `saldos-board.test.tsx`; `saldos.test.ts`; Manual §3.2, §3.3 | Covered |
| Person details on Saldos / Owes, Record from details | `person-saldo-sheet.tsx`; `saldos-board.tsx` | `person-saldo-sheet.test.tsx`; `saldos-board.actions.test.tsx` | Covered |
| Director-only Saldos / Non-director | `saldos-content.tsx`; `server/saldos.ts`; `actions.ts` | `actions.test.ts`; `saldos-content.test.tsx`; `server/saldos.test.ts` | Covered |

### `house-context` (MODIFIED)

| Requirement / Scenario | Code | Test | Status |
|---|---|---|---|
| Product sections / Sections in this release | `src/lib/sections.ts`; `section-nav.tsx` | `sections.test.ts`; `section-nav.test.tsx`; Manual §3.1 | Covered |
| ... / Unavailable section URL | no route for `vacances`, `mes` | `sections.test.ts` (route exists only when available) | Covered |
| House home opens the first available section | `src/app/(app)/[house]/page.tsx` | `[house]/page.test.tsx` | Covered |

---

## Security, GDPR and docs review

- **Director gate**: the page's async child (`saldos-content.tsx`), `getSaldos()` and every Server
  Function call `requireDirector()` before any query. `aps-store.ts` has no auth, by design, and is
  only imported by `server/saldos.ts`, `saldos/actions.ts` and the seed; no client module imports it.
- **Tampered input**: House slug checked; input re-parsed with `addApSchema`, `apIdSchema`,
  `restoreApSchema` (UUIDs, `dd/mm/aaaa`, 1 to 1440 minutes, years 2000 to 2100, House slug); the
  person must belong to the route's House or a shared post; the store re-checks the limits and the
  date window under the person lock; the database CHECKs are the last line.
- **GDPR**: `aps` holds person, House, kind, year, date, minutes and `created_at`; no reason, no
  health data. Delete is a real delete, and deleting a person cascades. Seed data is fictional.
- **Docs vs code**: `AGENTS.md` (layout, models, Dialog vs Sheet), `README.md` (seed with 15 APs) and
  `docs/domain.md` (FPOL32 summary, 14 holidays) match the code.

---

## Findings

### CRITICAL

None.

### WARNING

- **W1. The Safari row behaviour has no automated test.** jsdom has no layout engine, so the WebKit
  containing-block fix (`a7ceab2`) is only covered by the safaridriver probe and the product owner's
  hand check (`db-check.md` §3). Recommendation: re-check the Saldos table in Safari whenever its row
  markup changes; record it in the retrospective.
- **W2. Final-review minors parked as follow-ups.** A failed "already gone" delete leaves the ghost
  row until the next render; deleting the last AP of a former member with no stored balances drops
  the open sheet without a close animation; a prefilled hours value stays after switching to a
  person or type with no prefill. The final reviewer rated all three "can wait". Recommendation:
  track them as follow-ups in the retrospective.

### SUGGESTION

- **S1. `design.md` D9 body text** still describes the frame (heading, year switcher) in the page;
  the "Changed during implementation" note overrides it. Recommendation: none needed before archive.
- **S2. "Owed hours shown"** is tested with "Deu 4 h", not the spec's "Deu 9 h 18 min" figure.
  Recommendation: none needed; the format is the same and the manual check saw "Deu 6 h 30 min".
- **S3. `personHref` is imported from Equip's `post-card.tsx`** into the Saldos sheet, pulling Equip
  client code into Saldos. Recommendation: move it to `src/lib/team.ts` when Equip is next touched.
- **S4. Zod's default English messages** can reach the UI for crafted POSTs to the Server Functions
  (`year` and non-object input), as in Equip. Recommendation: fall back to the generic Catalan
  message when the failing issue is not a form field.

---

## Overall Decision

- [ ] ✅ PASS
- [x] ⚠️ PASS WITH WARNINGS: no critical issues; Safari row behaviour only manually verified (W1), three UX minors parked as follow-ups (W2)
- [ ] ❌ FAIL

**Next step**:

No critical issues. 2 warnings to consider. Ready for archive: write the retrospective (record W1
and W2 there), then archive with `/opsx:archive saldos`, which syncs the two delta specs.
