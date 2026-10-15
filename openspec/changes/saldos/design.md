## Context

- `main` holds SPEC-003 (`prototype-foundation`): two Houses in the URL, people who cover seats of posts defined in code (`src/lib/posts.ts`), shared posts PDG and PSI with no House, per-year opening balances (`person_years`: vacation days, AA days, calendar surplus in minutes) edited on the Equip page, the AP and vacation constants (`src/lib/rules.ts`), `H:MM` durations (`src/lib/duration.ts`, `DurationInput`), `dd/mm/aaaa` dates (`DateInput`), the app's `Sheet` (Base UI Drawer) and `useServerAction`. Navigation shows Saldos, Vacances and El mes as "aviat".
- The director validated `public/prototypes/saldos.html` (`docs/prototypes/director-feedback.md`, round 1). It is the approved UI: stats that double as filters, a table (cards on mobile), a person sheet with every entry and delete, an "Apuntar" form with live checks, and "Desfés".
- FASI's instruction FPOL32 (núm. 04, 17/12/2019, "gestió i organització del temps de treball i de descans") was reviewed during brainstorming. It confirms the AP model and adds one rule that shapes the data: the year closes on 31 January.
- Stakeholders: the director (only user, one House at a time, desktop and mobile) and the product owner.
- Constraints: Catalan UI, English code; `DESIGN.md` (honey only for pending decisions; errors with icon and text); GDPR (EU data, minimum data); Next.js 16 rules in `AGENTS.md` (`requireDirector()` everywhere, `revalidatePath` after writes, pages shaped for Cache Components); migrations backward compatible; `brainstorm.md` holds the decision log (Q1 to Q12).

## Goals / Non-Goals

**Goals:**
- Let the director record and delete APs (non-recoverable and recoverable) per person and year, with FASI's limits enforced, and undo any change right after.
- Show, per House and year, every person's vacation entitlement, AP balances and calendar surplus, with the totals she checks daily (AP hours used, who owes hours).
- Keep the balance rules in one pure, tested module shared by the screen, the form preview and the server.
- Make Saldos the House home.

**Non-Goals:**
- Vacation periods and the FASI period rule (SPEC-006); returned hours; editing an AP in place; the 5 days' notice; absence incompatibilities; holidays beyond 2026; computing the surplus from schedules (see the proposal's Non-goals).

## Decisions

### D1: One `aps` table, hard delete
- **Choice**: Prisma enum `ApKind` (`non_recoverable`, `recoverable`, mapped to `ap_kind`) and model `Ap` (table `aps`): `id` uuid, `person_id` (FK `people`, `onDelete: Cascade`, like `person_years`), `house_id` (FK `houses`, NOT NULL, `onDelete: Restrict`), `kind`, `year` int, `date` date, `minutes` int, `created_at`. Index `(person_id, year)`. A new migration adds only these (backward compatible), plus hand-written CHECKs: `year BETWEEN 2000 AND 2100`, `date BETWEEN make_date(year, 1, 1) AND make_date(year + 1, 1, 31)`, `minutes BETWEEN 1 AND 1440`. Deleting removes the row.
- **Rationale**: the smallest model that holds what the director records. Hard delete keeps no data she removed (GDPR minimisation). A Prisma enum gives typed kinds; adding a kind later is an additive `ALTER TYPE … ADD VALUE`.
- **Alternatives considered**: soft delete with `deleted_at` (every read filters, rows accumulate, needs a retention rule); a generic "balance entries" ledger for APs, returned hours and vacation days (designs for unanswered questions; vacations are date ranges with request states and would not fit).

### D2: `house_id` is the House where the AP was recorded
- **Choice**: `house_id` is the House in the URL when the director records the AP (for a shared PDG or PSI person, whichever House she was in). It never changes when the person moves. Balances ignore it: they sum the person's APs of the year wherever they were recorded.
- **Rationale**: issue #9 and AGENTS.md: records belong to the person and keep their own House. Later screens (El mes) can tell where an absence happened.

### D3: An explicit AP year with a window up to 31 January
- **Choice**: each AP stores the `year` whose allowance and surplus it counts against. Its date must be between 01/01 of that year and 31/01 of the next. The year is the one selected in Saldos; on Saldos 2026 a date in January 2027 counts toward 2026, and on Saldos 2027 the same date counts toward 2027. January dates of the next year are labelled in the person sheet ("gener 2027").
- **Rationale**: FPOL32 §1: "es poden demanar vacances i AP de l'any anterior fins el 31 de gener, que computaran pel saldo de jornada de l'any anterior". The year cannot be derived from the date.
- **Alternatives considered**: year = the date's year (cannot record a January AP for last year's balance).

### D4: Balance rules are pure functions in `src/lib/balances.ts`
- **Choice**:
  - `personBalances(opening, aps)` for one person and year: `vacationTotal` = vacation days + AA (`vacationToPlan` = `vacationTotal` until SPEC-006); APNR minutes used, minutes left (max(0, 24 h − used)), request count; APR minutes used, request count; `surplusNow` = opening surplus − APR minutes used.
  - `checkNewAp({ balances, kind, year, date, minutes })` returns `errors` (blocking) and `notices` (allowed): errors for a date outside the D3 window ("La data ha de ser entre el 01/01/2026 i el 31/01/2027."), the request limit reached ("Ja ha fet servir els 5 dies que permet aquest tipus d'AP."), the yearly hours exceeded ("Supera el màxim de 24 h: només li queden 2 h.") and minutes outside 1 to 1440; notices for a public holiday ("És festiu (Nadal): segons la instrucció no es poden demanar AP en festius.") and an APR taking the surplus below zero ("L'excedent passarà de +2 h a −4 h: haurà de retornar 4 h. Es pot apuntar igualment."). It also returns the preview line ("Li quedaran 6 h d'AP no recuperables (dia 4 de 5).", "L'excedent passarà de … a …").
  - `remainingFor(balances, kind)`: minutes left (capped at 24 h) and whether the next request is the last allowed one.
  - Every AP recorded for the year counts as used, including future-dated ones: the director records only approved APs.
- **Rationale**: one implementation used by the page, the form's live preview and the Server Function, so the screen and the server never disagree; trivially unit-tested.

### D5: Limits are enforced inside a transaction that locks the person
- **Choice**: `createAp` (in `src/server/aps-store.ts`) runs an interactive Prisma transaction: `SELECT id FROM people WHERE id = $1 FOR UPDATE`, then reads the opening balances (stored or `defaultOpeningBalances`) and the person's APs of the year, runs `checkNewAp`, and inserts, or throws `ApRuleError` with the first Catalan error. Restoring a deleted AP goes through the same function.
- **Rationale**: the yearly limits depend on rows that a concurrent write could change; locking the person serialises writes for that person only. Interactive transactions work through the pooled connection (pgbouncer in transaction mode keeps one server connection for the whole transaction).
- **Alternatives considered**: database triggers (rules would live in two places); `SERIALIZABLE` isolation (retries to handle).

### D6: Undo by re-inserting
- **Choice**: `addApAction` returns the new AP's id; undo deletes it. `deleteApAction` returns a snapshot of the deleted AP (`personId`, `kind`, `year`, `date`, `minutes`, original House); undo calls `restoreApAction(snapshot)`, which re-creates it with its original `house_id` through `createAp`, so the rules run again and an undo fails with the rule's message if the allowance filled up meanwhile. The restored AP gets a new id (nothing refers to AP ids). The toast keeps only the last change, for 6 seconds, as in the prototype.
- **Rationale**: the hard-delete model (D1) with "Desfés" after every change (`docs/domain.md` §10).

### D7: Server Functions follow the Equip pattern
- **Choice**: `src/app/(app)/[house]/saldos/actions.ts` exports `addApAction`, `deleteApAction` and `restoreApAction(houseSlug, input)`. Each calls `requireDirector()`, checks the House slug, re-parses its input with the form's zod schema (`src/lib/ap-schemas.ts`), and checks the person belongs to the route's House or to a shared post (`belongsTo`); for a delete the AP's person decides it. Inactive people can still be corrected. After a write, `revalidatePath('/[house]/saldos', 'page')` (both Houses: shared people show on both); no `router.refresh()`. `ActionResult` becomes `ActionResult<T = void>` (`{ ok: true; data: T }` when `T` is not void), so existing callers do not change.
- **Rationale**: a Server Function is reachable by a direct POST (AGENTS.md).

### D8: Reads and the Saldos view
- **Choice**: `getSaldos(house, year)` in `src/server/saldos.ts` calls `requireDirector()`, then loads the people of the House plus the shared posts (`listPeopleOf`), their `person_years` of the year and their APs of the year (three queries). A pure `buildSaldosView(house, people, openings, aps, year)` in `src/lib/saldos.ts` returns `rows` (active people, sorted by name), `former` (inactive people with APs or stored balances that year, for the collapsed "Antics membres" group) and `totals` (`apnrUsedMinutes`, `apnrCapMinutes` = active people × 24 h, `owePeople`, `oweMinutes`, from active people only). The person sheet uses the row already loaded (no extra read).
- **Rationale**: balances need every AP of the year anyway; three small queries per page load suit two Houses of about a dozen people.

### D9: Saldos page
- **Choice**: `src/app/(app)/[house]/saldos/page.tsx` renders the frame (House eyebrow, "Saldos <year>", year switcher previous / current / next as links with `?year=`) and an async child inside `<Suspense>` that reads `params`, `searchParams` and `getSaldos()`; no route segment config. `?person=<id>` opens the person sheet (like Equip). Client components in `src/components/saldos/`:
  - Stats: two cards. "AP no recuperables usats" (`38 h 30 min`, "de 264 h de tot l'equip"); "Han de retornar hores" ("2 persones", "13 h 15 min en total, per cobrir necessitats puntuals" or "Ningú té l'excedent en negatiu"), which toggles the "Deuen hores" filter with a `ring-primary`.
  - Toolbar: "Equip" heading, segmented Tothom / Deuen hores, search "Busca una persona" (accent- and case-insensitive).
  - Desktop table: Persona (initials avatar, name, post label), Vacances ("34 dies (3 AA)" for 31 days plus 3 AA, as the prototype), AP no recuperables (bar and "Queden 12 h · 3/5 dies"), AP recuperables ("6 h 30 min usades · 1/3" or "Cap"), Excedent calendari (signed, or a warning chip with an hourglass "Deu 9 h 18 min"), chevron. Mobile: cards with three tiles. "Ningú coincideix amb aquest filtre." when empty.
  - "Antics membres": a collapsed group under the list with the same rows.
  - Person sheet (`Sheet`): tiles (Vacances, AP no recuperables left, Excedent with a warning background when negative), "Ha de retornar 9 h 18 min treballant quan calgui." when negative, an "Apuntar AP" button, the APNR and APR lists sorted by date ("dc. 08/04/2026", hours, delete button; "(gener 2027)" for next-January dates; APR rows say "Descomptat de l'excedent"), the vacation line "34 dies (3 AA) · Els períodes s'apuntaran a Vacances.", and "Excedent a l'inici de l'any: +14 h 30 min" with a link "Edita'l a Equip" to the Equip person sheet of that year.
- **Rationale**: the approved prototype, minus vacation periods (Q1, Q5) and plus the year switcher (Q3). Cache Components shape per AGENTS.md.

### D10: The "Apuntar AP" form opens in a centred `Dialog`
- **Choice**: add the shadcn Dialog in its Base UI flavour (`src/components/ui/dialog.tsx`, `@base-ui/react/dialog`, already a dependency) and an app wrapper `src/components/dialog.tsx` that is centred on desktop and a bottom sheet on mobile, always has a title, and can open over the person `Sheet`. The form (react-hook-form + `addApSchema`): Persona (`NativeSelect`, active people first), the chosen person's three balance tiles with the relevant one highlighted, "Què apuntes?" (AP no recuperable / AP recuperable with the prototype's descriptions), Dia (`DateInput`), Hores (`DurationInput` without sign), the "La resta (6 h)" shortcut, the last-request prefill with "És l'últim dia: li queden 6 h", live errors (error tokens with an icon), notices (warning tokens with an icon), the preview line (success tokens), "Cancel·la" and "Apunta-ho" (disabled while there are errors). Opened from the person sheet, the person is preselected.
- **Rationale**: the prototype shows the form as a centred modal on desktop and a bottom sheet on mobile (product owner's choice, Q11). `Sheet` stays for detail panels.
- **Alternatives considered**: the existing `Sheet` (no new component, but differs from the prototype and stacks two side panels).

### D11: Undo toast
- **Choice**: `src/components/undo-toast.tsx`: a fixed toast (bottom, above the mobile tab bar) with `role="status"`/`aria-live="polite"`, the text ("Apuntat AP no recuperable de 4 h a Laia Puig.", "Esborrat.") and a "Desfés" button; it disappears after 6 seconds or after undo. A failed undo shows its message with an icon. *Changed during planning:* the toast is portalled into `<body>`: rendered next to an open Sheet, Base UI hides it from screen readers (aria-hidden), so "Desfés" right after deleting from the sheet would be unreachable (checked in jsdom; clicking the portalled toast does not close the sheet).
- **Rationale**: the prototype's toast; no toast library for one use.

### D12: Holidays in code
- **Choice**: `src/lib/holidays.ts` exports `HOLIDAYS: Record<number, Record<IsoDate, string>>` with 2026 from `docs/domain.md` §9 and `holidayOn(date)`. Years without a list return nothing, so no notice is shown (2027 is added when the official calendars are published).
- **Rationale**: FPOL32 §2 says APs cannot be requested on the 14 annual holidays but also describes what happens when they are; the director decides, so the form only warns (Q10). The list is reused by El mes later.

### D13: Navigation
- **Choice**: `saldos` gets `available: true` in `src/lib/sections.ts` and the `scale` icon in `src/components/section-nav.tsx` (as in the prototypes); `/[house]` redirects to Saldos (first available section).

### D14: Testing
- **Choice**: Vitest unit tests for `balances` (sums, time left, current surplus, negative surplus), `checkNewAp` (window edges 31/12/2025, 01/01/2026, 31/01/2027, 01/02/2027; 5th APNR accepted, 6th rejected; 3rd APR accepted, 4th rejected; 24:00 in total accepted, 24:01 rejected; an APR going negative is a notice; a holiday is a notice; remaining time and last request), `holidays`, `buildSaldosView` (House people plus shared posts, never the other House; former members only with data that year; totals from active people only), `ap-schemas` and the search normaliser; store tests with a mocked Prisma client (as `people-store.test.ts`); Server Function tests with mocked auth and store (non-director, unknown House, person of the other House, rule error message, delete snapshot, restore over the limit, `revalidatePath`); component tests (stats and filter, "Deu" chip, person sheet lists and labels, form errors / prefill / shortcut / holiday notice, undo toast, dialog title and Escape); `sections.test` and the House home redirect. By hand on a throwaway local Postgres: the migration's CHECKs and two concurrent fifth APNRs for the same person (exactly one saved), recorded in `db-check.md`. A browser check of the page on desktop and mobile.

## Risks / Trade-offs

- [Risk] Two saves for the same person at once exceed a limit → Mitigation: the person row lock (D5), checked by hand with two concurrent writes.
- [Risk] Holiday notices are missing for 2027 → Mitigation: documented in `docs/domain.md`; add the list when the calendars are published.
- [Risk] The director picks the wrong year for a January AP → Mitigation: the year is always visible in the heading and the form, and January dates of the next year are labelled in the person sheet.
- [Trade-off] An undone delete gets a new id → accepted: nothing refers to AP ids.
- [Trade-off] Limits live in the app, not in the database → accepted: rules are code (AGENTS.md) and only the director writes; the CHECKs still reject impossible rows.
- [Trade-off] The vacation column shows the entitlement only until SPEC-006 → accepted (Q5).

## Migration Plan

1. Add the `aps` migration (only new enum, table, index, FKs and CHECKs: backward compatible). Verify it on a throwaway local Postgres (apply, CHECKs, concurrent writes) before any shared database.
2. Dev database: apply with `prisma migrate deploy` (no reset needed); the seed adds APs only when the database has no APs.
3. Production: merging to `main` deploys to Vercel Production, whose build applies pending migrations (`scripts/vercel-build.sh`).
4. Rollback: an instant rollback leaves the table in place, which the previous code ignores; the migration is never edited after merge.

## Open Questions

- Recording returned hours so the surplus goes back up (director).
- FPOL32: are APs on holidays forbidden, or allowed with another holiday assigned? (the form warns meanwhile).
- 2027 public holidays.

## Changed during implementation

- `deleteAp` returns a boolean (true when it removed the row, false when the AP was already gone) so the delete action can tell a concurrent second delete that the AP is already gone, and only one of two concurrent deletes hands out an undo snapshot.
- `deleteApAction` uses the boolean from `deleteAp`: when `findAp` finds the AP but `deleteAp` returns false (a concurrent delete won), it returns the same "Aquest AP ja no existeix." failure as when `findAp` returns null, hands out no undo snapshot and does not revalidate. A failure returned from inside the write helper skips `revalidatePath`.
- Test plan fix: in "says so when the AP is already gone", `vi.mocked(aps.findAp).mockResolvedValue(null)` is set explicitly, because `vi.clearAllMocks()` (Vitest 4) keeps the return values set by earlier tests. The `deleteAp` mocks resolve `true` where a delete is expected to succeed, and one test covers `deleteAp` resolving false.
- The Saldos frame's heading (House name and "Saldos <year>") and the year switcher render inside the async child (`SaldosContent` through `SaldosBoard`) because they read `params` and `searchParams`; the page itself still has no segment config and every request-time read sits under `<Suspense>`, so it survives Cache Components.
- The board's `UndoToast` `onDismiss` clears the toast only if it is still the current one (`current?.key === toast.key`), so a late dismiss from an older toast (for example after a slow undo) cannot clear a newer toast.
- Test plan fix: in `person-saldo-sheet.test.tsx` the matcher is `/31 dies ·/` (without the trailing space), because Testing Library trims the text it matches. The board actions test also covers an inactive person with no data that year (GONE), which opens no sheet either.
- The seed (Task 14) adds 15 fictional APs, not the 16 the plan text says: the plan's AP list has 15 entries (5+2+2+1+3+1+1), so the list is the source of truth and the seed prints "Seeded 15 fictional APs." (verified: 15 rows in the database).
- The undo toast's 6 s countdown pauses while an undo is pending and restarts when it settles (its effect depends on `[failure, pending]`), so a slow Server Function cannot unmount the toast before a failure message or error is shown.
- Equip's Server Functions also `revalidatePath('/[house]/saldos', 'page')`, because the people, moves and opening balances they write are what Saldos shows.
- `createAp`'s transaction is pinned to `READ_COMMITTED` (Prisma `isolationLevel`): the person-row lock only stops a sixth AP when each statement takes a fresh snapshot after the lock is granted.
