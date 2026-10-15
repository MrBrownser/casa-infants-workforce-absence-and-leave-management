## Why

The director keeps every person's AP hours and calendar surplus in the `V I APS` tab of her spreadsheet, typed by hand in mixed formats ("3,45h", "6,75h"). She validated the Saldos prototype ("M'agrada, ho faria servir") and said these are the numbers she needs to keep up to date. SPEC-003 gave the app people and opening balances; this change lets her record APs and see each person's balances per House and year, so the spreadsheet tab can be retired.

## What Changes

**Saldos section**
- From: "Saldos" shown as "aviat" (not available); `/<house>` opens Equip.
- To: `/<house>/saldos` lists the people of the House and the shared posts with their vacation entitlement (days + AA), AP no recuperables (hours left, requests used of 5), AP recuperables (hours used, requests of 3) and the calendar surplus ("Deu 9 h 18 min" when negative), with two stat cards, a filter, a search, a person sheet and a year switcher. `/<house>` opens Saldos.
- Impact: non-breaking.

**Recording APs**
- New: the director records an AP no recuperable or recuperable (date `dd/mm/aaaa`, hours `H:MM`) for a person and year, and deletes one; every change can be undone right after ("Desfés").
- Rules: 24 h a year in at most 5 requests (APNR) or 3 requests (APR), blocked when exceeded; the last allowed request starts with the remaining time; an APR is deducted from the calendar surplus and is never blocked for lack of surplus; an AP counts toward a year and may be dated up to 31 January of the next year (FASI instruction FPOL32 §1); a public holiday shows a notice but can be saved.
- Records belong to the person and keep the House where they were recorded.

**Domain reference**
- `docs/domain.md` gains a summary of FASI's instruction FPOL32 (núm. 04, 17/12/2019) as a source, with the rules that affect later specs (absence incompatibilities, vacation rules, holidays).

## Non-goals

- Recording vacation periods, the FASI period rule and vacation overlaps (SPEC-006 Vacances). Until then the vacation column shows the entitlement only, and the "Vacances per planificar" card and "Falten vacances" filter are not shown.
- Recording returned hours that raise the surplus again (open question for the director; she edits the opening surplus on Equip meanwhile).
- Editing an AP in place (delete and record again, with undo).
- Checking the 5 days' notice, absence incompatibilities between posts, or the rota (SPEC-005).
- Public holidays other than 2026 (2027 is not official yet).
- Computing the calendar surplus from schedules; it stays an opening value per person and year.

## Personal data (GDPR)

- New personal data: per person, the date, number of hours and type (non-recoverable or recoverable) of each AP, plus the House where it was recorded. No reason, no document, no health data.
- Residency: Supabase Postgres in the EU, as today.
- Access: only users with the Clerk `director` flag, checked in the page, the data function and every Server Function.
- Retention: deleting an AP removes the row (no soft delete). Retention and erasure for people who left stay with the planned GDPR spec; APs are removed with the person (cascade), like the opening balances.

## Capabilities

### New Capabilities
- `ap-balances`: recording APs per person and year with their rules, computing balances (vacation entitlement, APNR, APR, calendar surplus), and the Saldos screen of each House.

### Modified Capabilities
- `house-context`: Saldos becomes an available section and the House home opens it.

## Impact

- Database: new enum `ap_kind` and table `aps` (FKs to `people` and `houses`, CHECKs on year, date window and minutes, index on person and year) in one additive migration; `prisma/seed.ts` adds fictional 2026 APs.
- Code added: `src/lib/balances.ts`, `src/lib/holidays.ts`, `src/lib/ap-schemas.ts`, `src/lib/saldos.ts`, `src/server/aps-store.ts`, `src/server/saldos.ts`, `src/app/(app)/[house]/saldos/` (page and Server Functions), `src/components/saldos/`, `src/components/dialog.tsx` (shadcn Dialog on Base UI), `src/components/undo-toast.tsx`.
- Code changed: `src/lib/sections.ts` and `src/components/section-nav.tsx` (Saldos available, icon), `src/lib/action-result.ts` (generic result).
- Docs: `docs/domain.md`, `AGENTS.md`, `README.md`.
- No new npm dependencies (`@base-ui/react` is already installed).
