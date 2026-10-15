# Brainstorm: Saldos (SPEC-004)

Raw capture of the brainstorming session between the product owner and Claude (2026-10-14 to
2026-10-15) for GitHub issue #9, "SPEC-004 Saldos: record APs and show balances per House".
Path: **architectural** (new section, new table and migration, Server Functions, a new spec
capability).

## Inputs read before any question

- Issue #9: build Saldos from `public/prototypes/saldos.html` (director: "M'agrada, ho faria
  servir"); record AP no recuperable (24 h a year, max 5 requests) and AP recuperable (24 h a
  year, max 3 days); a night plus REE can be one request; APR hours are deducted from the
  calendar surplus, never blocked, the surplus may go negative ("Deu 9 h 18 min"); balances per
  person and year (vacation days to plan with AA, APNR, APR, calendar surplus) follow the
  person; `H:MM` durations and `dd/mm/aaaa` dates; "Desfés" after each change; records belong to
  the person and keep their own `houseId` at creation; replace the "aviat" placeholder. Note:
  "vacation days to plan" only becomes real once Vacances records vacations.
- `docs/domain.md` (§4 APs, §5 surplus, §10 conventions, §11 screens),
  `docs/prototypes/director-feedback.md` (round 1: Saldos validated; never block an APR; one
  House at a time; returned hours still an open question).
- The prototype: `saldos.html`, `shared/data.js` and `shared/ui.js` (stats that double as
  filters, segmented filter, search, desktop table and mobile cards, person sheet with lists and
  delete, "Apuntar" form with live checks, a preview line and the person's balance tiles, toast
  with "Desfés").
- SPEC-003 artifacts (`openspec/changes/archive/2026-10-14-prototype-foundation/`), current specs
  (`people-and-posts`, `house-context`), the Prisma schema and `init` migration, and the Equip
  code (store, Server Functions, schemas, `Sheet`, `DurationInput`, `DateInput`,
  `useServerAction`).

## Decision log

### Q1. Does SPEC-004 record vacation periods too?
The prototype's form records vacations and APs ("Apuntar vacances o AP"), lists periods in the
person sheet and checks FASI's period rule. The issue lists only APs.
**Decision: APs only.** Vacation periods, the FASI rule and the overlap hint wait for SPEC-006
(Vacances), which will add vacation records that Saldos then reads.

### Q2. Recording returned hours ("hores retornades")?
Open question in `docs/domain.md` §5; the director has not answered.
**Decision: not yet.** Until she answers, the director corrects the surplus by editing the
opening balance on the Equip page.

### Q3. Which year does Saldos show?
**Decision: a year switcher** (`?year=`, previous / current / next year, defaulting to the
current year in Europe/Madrid), like the Equip balances. Reinforced later by FPOL32 (Q10).

### Q4. Who is listed?
**Decision: active people of the House plus the shared PDG and PSI** in the main list and the
stats. **Inactive people of the House who have APs or stored opening balances that year** go in a
collapsed **"Antics membres"** group below (same label as the Equip page), so a person who left
in June can still be looked up and corrected; they do not count in the stats. Balances follow the
person: someone who moved shows in their current House with all their APs of the year.

### Q5. How do vacations show while nothing records them?
First answer was "everything as in the prototype"; the product owner corrected it right away
(misclick). **Decision: the vacation column and the person-sheet tile only**, showing the
entitlement ("31 dies (3 AA)") with a hint that periods are recorded in Vacances. The stats row
has **two cards** (AP no recuperables usats, Han de retornar hores); the "Vacances per
planificar" card and the "Falten vacances" filter come back with SPEC-006.

### Q6. AP yearly limits: block or warn?
**Decision: block, as in the prototype**: an error with an icon and "Apunta-ho" disabled; the
Server Function enforces the same rule. Only the APR's effect on the surplus is never blocked.
The product owner added: the last allowed request should take the remaining time, to make
hitting the limit less likely.

### Q7. What does "the last AP takes the remaining time" mean?
**Decision: prefill, editable.** When the next request is the last allowed one (5th APNR or 3rd
APR), the hours field starts at the remaining time (at most 24:00) with a hint "És l'últim dia:
li queden 6 h"; she can lower it, and any leftover is lost for the year. Earlier requests get a
"La resta (6 h)" shortcut while time is left.

### Q8. Approach
- **A (chosen): one `aps` table, hard delete, undo by re-inserting.** Smallest schema; a deleted
  AP is really gone (GDPR minimisation); a pure balances module shared by page, form preview and
  Server Function; limits enforced in a transaction that locks the person row.
- B: the same with soft delete (`deleted_at`): every read must filter, rows accumulate, needs a
  retention policy. Rejected.
- C: a generic "balance entries" ledger (APs, later returned hours or vacation days): designs for
  answers we do not have; vacations are date ranges with request states and would not fit.
  Rejected (YAGNI).

### Q9. FPOL32 review (source document added mid-session)
The product owner shared FASI's "Instrucció relativa a gestió i organització del temps de
treball i de descans a partir del dia 01/01/2020" (FPOL32, núm. 04, 17/12/2019) and asked to
double-check every decision against it.

Confirmed, no change:
- "Els AP depenen de la persona": balances follow the person.
- Two AP types: no recuperables count as worked time ("com si fossin més temps de vacances");
  recuperables do not and must be recovered. Matches APNR consuming an allowance and APR being
  deducted from the surplus.
- "En cas de sol·licitar un AP en torn de dilluns nit, s'està autoritzat a no participar a la
  REE del dimarts, incloent el temps de la REE al permís d'AP": confirms one request with the REE
  hours inside it (one record dated the night, with the total hours).
- Owed hours are regularised "amb cobertura puntual de festius o altres torns", with 5 days'
  notice: the ad hoc return kept out of scope (Q2).
- Annual working time 1,701 h; the surplus is planned vs agreed hours, an opening value the app
  does not compute.
- The 24 h / 5 / 3 limits are not in the document: they come from the director's spreadsheet.

Changes SPEC-004:
- §1: "es poden demanar vacances i AP de l'any anterior fins el 31 de gener, que computaran pel
  saldo de jornada de l'any anterior". An AP's year cannot be derived from its date.

Needs a decision:
- §2: "No es podran demanar AP en els 14 festius anuals", but also "Si alguna persona demana AP en
  un festiu que tingui previst treballar se li assignarà un altre festiu a treballar" (the two
  lines conflict). No holiday calendar exists in code yet.
- §2: APs need 5 days' notice ("En quins casos podem no aprovar un AP: quan no es demanin amb una
  antelació de 5 dies").

For later specs (recorded in `docs/domain.md`, not SPEC-004):
- §3 absence incompatibility table (which posts cannot be off together) answers the open
  question of El mes and Vacances.
- APR "no es poden acumular amb vacances"; APNR can (SPEC-006 check).
- §4 vacations: plan closed on 15 February; blocks of 7 apply "si es volen fraccionar en més de
  dos períodes" (possibly looser than the FASI table we hold for 2 periods: ask the director);
  periods fixed for the year, cancelling needs Direcció de Persones two months before; choosing
  order; a period starting on a night shift.
- §5 holidays: hours count ×1.5, the CT picks two holidays off, 12-hour shifts.

### Q10. Decisions from the FPOL32 review
- **Explicit AP year**: `aps.year`, and the date must be between 01/01 of that year and 31/01 of
  the next. Saldos 2026 accepts dates up to 31/01/2027; those January APs are labelled in the
  person sheet.
- **Holidays: warn, allow.** Add the 2026 holiday list to code (domain §9) and show a notice
  with an icon on a holiday date; saving stays possible. Years without a list show no notice.
- **5 days' notice: nothing.** The director records APs she already approved; past dates (late
  records) must work.
- **Source document: a summary in `docs/domain.md`**, citing FPOL32 núm. 04 (17/12/2019). The
  PDF is not committed (internal FASI document).

### Q11. Form overlay
Claude first proposed opening the "Apuntar AP" form in the app's `Sheet` (the one overlay the app
has). The product owner asked why and for a reference; screenshots of the prototype showed the
form as a centred modal on desktop and a bottom sheet on mobile, and the person panel from the
right (which is how the app's `Sheet` looks). **Decision: a centred dialog, as in the
prototype**: a small `Dialog` wrapper around the shadcn Dialog (Base UI flavour, already a
dependency), centred on desktop and a bottom sheet on mobile, opening on top of the person panel
with the person preselected. AGENTS.md will say when to use `Sheet` (detail panels) and `Dialog`
(short forms).

### Q12. Search
Accent- and case-insensitive: "nuria", "NÚRIA" and "Núria" find Núria (as the prototype).

## Validated design (presented in five sections, each approved)

### 1. Data model
New table `aps` in a new, additive migration (backward compatible):
`id` uuid PK; `person_id` FK to `people` (cascade, like `person_years`); `house_id` NOT NULL FK
to `houses` (restrict): the House in the URL when the AP was recorded, so a shared PDG/PSI AP gets
the House she was in, and it never changes when the person moves; `kind` Prisma enum `ap_kind`
(`non_recoverable`, `recoverable`); `year` int, CHECK 2000 to 2100; `date` date, CHECK between
`make_date(year, 1, 1)` and `make_date(year + 1, 1, 31)`; `minutes` int, CHECK 1 to 1440;
`created_at`. Index `(person_id, year)`. Hand-written CHECKs in the migration as in `init`.
Yearly limits stay in the app (they live in `src/lib/rules.ts`), made race-safe by a row lock.
`person_years` unchanged. GDPR: date, hours and type only, no reason; deleting is a real delete.
Seed: a few fictional 2026 APs (people under the limit, one at 5/5, a negative surplus).

### 2. Balance rules (pure, `src/lib/balances.ts`)
`personBalances(opening, aps)`: vacation total = days + AA ("to plan" = total until SPEC-006);
APNR used, left (24 h minus used, never below 0), requests n/5; APR used, requests n/3 (24 h cap
too); current surplus = opening surplus minus APR minutes (negative means owes). Every AP of the
year counts, including future-dated ones (only approved APs are recorded); the heading becomes
"Saldos 2026" instead of "comptades a avui".
`checkNewAp(...)`: errors (date outside the year window, request limit reached, yearly hours
exceeded, hours not in 0:01 to 24:00) and notices (holiday; APR taking the surplus below zero),
plus the prototype's preview line. `remainingFor(kind)` drives the last-request prefill and the
"La resta" shortcut. House stats (`saldosTotals`, active people only): APNR hours used "de N h de
tot l'equip"; people who owe hours and their total. `src/lib/holidays.ts` holds the 2026 list
(one list per year; 2027 empty until official).

### 3. Server Functions, transactions and undo
Schemas in `src/lib/ap-schemas.ts` (add, id, restore snapshot). Store `src/server/aps-store.ts`:
`createAp` in an interactive transaction that locks the person (`SELECT … FOR UPDATE`), reads
the opening balances (or defaults) and the year's APs, runs `checkNewAp`, inserts or throws an
`ApRuleError` with the Catalan message (works through pgbouncer in transaction mode);
`deleteAp` returns the deleted row; `listApsOf`. Server Functions in
`src/app/(app)/[house]/saldos/actions.ts` (`addApAction`, `deleteApAction`, `restoreApAction`):
`requireDirector()`, House slug, re-parse, person belongs to this House or a shared post; former
members can still be corrected. Delete finds the AP's House through its person. Restore re-creates
the snapshot with its original `house_id` and re-runs the checks (an undo can fail if the
allowance filled up meanwhile). `ActionResult<T = void>` becomes generic. After each write
`revalidatePath('/[house]/saldos', 'page')`, no `router.refresh()`. Undo: the toast keeps the last
change for 6 s; undo of a new AP deletes it, undo of a delete restores it; a failed undo shows the
error with an icon. Reads in `src/server/saldos.ts` (`getSaldos(house, year)`, three queries) and
a pure `buildSaldosView` in `src/lib/saldos.ts`.

### 4. UI
Route `/[house]/saldos`: the page renders the frame (eyebrow, "Saldos 2026", year switcher) and an
async child inside `<Suspense>` reads `params`, `searchParams` and `getSaldos()`. `?year=` and
`?person=<id>` in the URL; filter and search are client state. Two stat cards (the owe card
toggles the "Deuen hores" filter), toolbar (Equip, Tothom / Deuen hores, search), desktop table
(avatar with initials, Vacances "31 dies (3 AA)", APNR bar and "Queden 12 h · 3/5 dies", APR
"6 h 30 min usades · 1/3" or "Cap", surplus signed or a warning chip "Deu 9 h 18 min"), mobile
cards with three tiles, "Antics membres" collapsed. Person sheet (`Sheet`): tiles, owe banner,
"Apuntar AP", APNR and APR lists with delete, "(gener 2027)" labels, vacation line, opening
surplus hint with a link to Equip. "Apuntar AP" form in a centred `Dialog`: person select,
balance tiles, type radio, Dia (`DateInput`), Hores (`DurationInput`, no sign), shortcut and
prefill, live errors (error tokens with icon), notices (warning tokens with icon), preview
(success). Undo toast component, no new dependency. Saldos becomes available (icon `scale`), so
`/[house]` opens Saldos. No honey on this page.

### 5. Testing and docs
Unit tests on balances, `checkNewAp` (window edges 01/01/2026, 31/01/2027, 31/12/2025,
01/02/2027; 5th/6th APNR; 3rd/4th APR; 24:00 vs 24:01; negative APR is a notice; holiday notice;
remaining time), holidays, `buildSaldosView`, schemas, search normaliser. Server Function tests
with mocked auth and store. Component tests (stats and filter, "Deu" chip, person sheet lists,
form errors / prefill / shortcut / holiday notice, undo toast, dialog). Navigation tests updated.
Hand check on a throwaway local Postgres: CHECKs and two concurrent 5th APNRs (exactly one
saved), recorded in `db-check.md`. Lint, typecheck, tests and build before every push; browser
check on desktop and mobile. Docs: `docs/domain.md` (FPOL32 summary as a source, §4, §5, §11),
`AGENTS.md` layout, `README` seed note. OpenSpec: new capability `ap-balances`; delta on
`house-context`.

## Open questions left (for the director, through the product owner)

- Recording returned hours so the surplus goes back up (Q2).
- FPOL32's two lines on APs and holidays: forbidden, or allowed with another holiday assigned?
- Whether two vacation periods can be any length of at least 7 days (FPOL32 §4) or only the
  FASI table's splits (SPEC-006).
- 2027 public holidays (official calendars).
