## 1. Rules in code

- [x] 1.1 Add `src/lib/holidays.ts` with the 2026 public holidays of `docs/domain.md` §9 and `holidayOn(date)`; tests (16 dates, names, a year without a list returns nothing).
- [x] 1.2 Add `src/lib/balances.ts`: `personBalances` (vacation total with AA, APNR used / left / count, APR used / count, current surplus), `remainingFor` (minutes left capped at 24 h, last request flag) and `checkNewAp` (errors, notices and preview line with the Catalan copy of design D4); tests for every edge in design D14.
- [x] 1.3 Add `src/lib/ap-schemas.ts` (add: person, kind, year, `dd/mm/aaaa` date, `H:MM` hours from 0:01 to 24:00; id; restore snapshot with the original House) with Catalan messages; tests.
- [x] 1.4 Add `src/lib/saldos.ts`: `buildSaldosView` (rows of active people of the House and shared posts sorted by name, former members with data that year, totals from active people) and the accent- and case-insensitive name matcher; tests.

## 2. Database

- [x] 2.1 Add the `ApKind` enum and the `Ap` model to `prisma/schema.prisma` (relations on `Person` and `House`) and a new migration with the hand-written CHECKs on year, date window and minutes (design D1); regenerate the client.
- [x] 2.2 Apply the migration on a throwaway local Postgres; check by hand that the CHECKs reject a date outside the window, 0 and 1441 minutes, and record the results in `db-check.md`.
- [ ] 2.3 Extend `prisma/seed.ts` with fictional 2026 APs (people under the limit, one person at 5 of 5 APNR, an APR that makes a surplus negative), added only when the database has no APs.

## 3. Data layer

- [x] 3.1 Add `src/server/aps-store.ts`: `createAp` in an interactive transaction that locks the person row and runs `checkNewAp` (throws `ApRuleError`), `deleteAp` reporting whether it deleted the row, `listApsOf(personIds, year)`, `listOpeningBalancesOf(personIds, year)`; tests with a mocked Prisma client.
- [x] 3.2 Check by hand on the local Postgres that two concurrent fifth APNRs for the same person save exactly one; record it in `db-check.md`.
- [x] 3.3 Add `src/server/saldos.ts` with the director-gated `getSaldos(house, year)`; tests (non-director redirected, three reads, view built).
- [x] 3.4 Make `ActionResult` generic (`ActionResult<T = void>`) without changing existing callers.
- [x] 3.5 Add `src/app/(app)/[house]/saldos/actions.ts` (`addApAction`, `deleteApAction`, `restoreApAction`) following design D7; tests (non-director, unknown House, person of the other House, rule error message, delete snapshot, restore over the limit, `revalidatePath`).

## 4. Overlays and feedback

- [x] 4.1 Add the shadcn Dialog on Base UI (`src/components/ui/dialog.tsx`) and the app wrapper `src/components/dialog.tsx` (centred on desktop, bottom sheet on mobile, always titled); component tests (title, focus, Escape, over a `Sheet`).
- [x] 4.2 Add `src/components/undo-toast.tsx` ("Desfés", 6 seconds, `aria-live`, error state with an icon); component tests with fake timers.

## 5. Saldos page

- [ ] 5.1 Make Saldos available in `src/lib/sections.ts` with the `scale` icon in `src/components/section-nav.tsx`; update the navigation and House home tests (`/[house]` opens Saldos).
- [ ] 5.2 Add `src/app/(app)/[house]/saldos/page.tsx`: the frame (eyebrow, "Saldos <year>", year switcher) and an async child in `<Suspense>` reading `params`, `searchParams` and `getSaldos()`; unknown House 404; page tests.
- [ ] 5.3 Add the stats, toolbar (filter and search), desktop table, mobile cards and the collapsed "Antics membres" group in `src/components/saldos/`, following the prototype and `DESIGN.md`; component tests ("Deu" chip, owe filter, search, empty state).
- [ ] 5.4 Add the person sheet (`?person=<id>`): tiles, owe reminder, APNR and APR lists with delete and the "gener" label, vacation line, opening surplus with the link to Equip; component tests.
- [ ] 5.5 Add the "Apuntar AP" form in the `Dialog` (person, tiles, type, day, hours, shortcut, last-request prefill, errors, notices, preview), wired to the Server Functions and the undo toast; component tests.
- [ ] 5.6 Check the page in the browser on desktop and mobile for both Houses (record, delete, undo, a negative surplus, a January AP of the next year, a holiday notice); record it in `db-check.md`.

## 6. Docs

- [ ] 6.1 Update `docs/domain.md`: FPOL32 summary as a source (rules for SPEC-004, SPEC-005 and SPEC-006: 31 January close, holidays, Monday night plus REE, absence incompatibility table, vacation rules, holiday hours), §4 and §5 updates, §11 Saldos built, open questions.
- [ ] 6.2 Update `AGENTS.md` (layout: Saldos route, new lib and server modules, `Dialog` vs `Sheet`; models now include `Ap`) and `README.md` (seed with APs).
- [ ] 6.3 Run lint, typecheck, tests and the production build; all green.
