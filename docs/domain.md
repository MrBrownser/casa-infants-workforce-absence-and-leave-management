# Casa d'Infants: domain reference

Everything we know about how the director runs the two Houses, collected from her spreadsheet,
the prototypes and her feedback. **Read this before writing any spec or code for Saldos,
Vacances or El mes.** Code and UI copy follow `AGENTS.md` (English code, Catalan UI).

Sources:
- The director's spreadsheet `2026_CALENDARI_PF.xlsx` (one per House; never committed: it holds
  real names). Summary of its tabs below.
- The approved UI: static prototypes in `public/prototypes/` (see its `README.md`). Open them
  with `python3 -m http.server -d public/prototypes`.
- The director's answers: `docs/prototypes/director-feedback.md`.
- FASI's instruction **FPOL32 núm. 04** (17/12/2019, "gestió i organització del temps de treball i
  de descans a partir del dia 01/01/2020"), shared by the product owner. Summarised in §13; the
  PDF is not committed (internal FASI document).
- The decision log: `openspec/changes/archive/2026-10-14-prototype-foundation/brainstorm.md`.

Items marked **(open)** are not confirmed yet; items marked **(assumption)** are what the
prototypes do until the director says otherwise.

## 1. Who uses the app

- **The director** ("la directora") of the two Houses is the only user. She enters everything:
  staff ask her by WhatsApp or on paper. She works on desktop and checks things on mobile.
- The product owner (developer) also has access.
- Access is the Clerk `publicMetadata.role === 'director'` flag (`src/lib/auth.ts`).
- She works **one House at a time** (her answer), switching with the House switcher.
- She is new in the post: the current spreadsheet was filled in by the previous director, and
  its 2026 balances cannot be fully explained. **She starts clean in the app on 1 January 2027**:
  no 2026 data is imported; she enters her team in Equip and the 2027 opening balances (carried
  days and surplus at the 2026 close) by hand. Until then she tests with fictional data.

## 2. Houses, posts and people

- Two Houses: **Paulo Freire** (`paulo-freire`) and **Carme Aymerich** (`carme-aymerich`).
  Casa d'Infants is a 24/7 residential service for children run by FASI.
- Each House has a fixed set of **posts** (`src/lib/posts.ts`: keys `er`, `tfm`, `tft`, `et`, `ecs`,
  `en`, `ct` per House; `pdg` and `psi` shared). What changes is **who** covers each post. Both Houses have the same posts (list validated by the product owner), and two of
  them are **shared by both Houses**:

| Code | Label | People | Works |
|---|---|---|---|
| PDG | Pedagoga | 1, **shared** | Weekdays, split between both Houses |
| PSI | Psicòloga | 1, **shared** | Weekdays, split between both Houses |
| ER | Educadora referent | 1 | Weekdays (only one ER at a time; a month can show two names when one leaves and another starts) |
| TFM | Treballadora familiar de matins | 1 | Weekday mornings |
| TFT | Treballadora familiar de tardes | 1 | Weekday afternoons |
| ET | Educadora de tardes | 1 | Weekday afternoons |
| ECS | Educadora de cap de setmana | 1 | Weekend and public holiday mornings and afternoons |
| EN | Educadora de nit | **2** | Nights; the two people **alternate by week** (legal rest) |
| CT | **Corretorn** (never "corretor": director's correction) | 1 | No fixed schedule: covers absences |

- **Shared posts:** the Pedagoga and the Psicòloga work for **both Houses**: the person has no
  House, but has vacations, APs and a surplus like everyone else. **(open)** Their exact week:
  the product owner believes a fixed schedule, three days in one House and two in the other,
  alternating every week (to confirm with the director). Both Equip pages show them.
  **(changed in SPEC-003)** The code assumes Monday to Wednesday in one House and Thursday and
  Friday in the other, swapping Houses every week (`sharedPostHouseOn`, provisional).
- An ER may stand in for the director when she is away; that gives no app access.
- A person covers one seat of one post. A seat with nobody is "Vacant". A person can be moved
  to another post or House (an edit) or marked inactive when they leave or take a long leave
  such as an excedència; inactive people stay listed so they can be reincorporated. People are
  never deleted from the UI.
- **Balances follow the person**, not the House: vacation days, AA, APs and the calendar
  surplus stay the same if the person moves to the other House.
- **(later)** History of who covered each post and post changes planned for a future date.
  The first delivery keeps only the current state.
- Substitutes who only cover an absence are **not** people with a post: they are written as
  "who covers" on the absence (see §6).
- The prototypes use an older, invented inventory (two ERs, "Equip tècnic", "Matí" rows…). The
  code follows this list.

## 3. Weekly schedules

- Each post has a **weekly schedule**: hours per weekday, the **same every week**, but they may
  differ between weekdays (the ER, for example, has different hours on Monday and Tuesday).
- Arrivals are **staggered**: posts do not start at the same time.
- Weekday posts do not work public holidays. The **Educadora de cap de setmana** works weekend
  and holiday mornings and afternoons. The two night educators alternate by week. The CT has no
  fixed schedule.
- **(changed in SPEC-003)** "Alternate by week" counts weeks from a fixed Monday (`weekIndex` in
  `src/lib/dates.ts`), not by ISO week number: 2026 has 53 ISO weeks, so weeks 53 and 1 would
  both be odd and the same person would work two weeks in a row.
- Known times (from the `FESTIUS` tab): night about **22:00 to 10:30** before a weekend or
  holiday day, holiday day shift about **10:30 to 22:15**. Times vary by person by 15 to 45
  minutes and are written as notes ("Eva entra 21:30h").
- **(provisional)** All other times are **invented** from the post names (product owner: better
  invented and visible than empty, so the director corrects them). They live in
  `src/lib/posts.ts`; see `openspec/changes/archive/2026-10-14-prototype-foundation/design.md` D3 for the table.
- **REE** is the weekly team meeting ("reunió d'equip"), same day and time every week, different
  per House (Carme Aymerich: Tuesday 9:00; Paulo Freire: Friday about 10:00). Not modelled.

## 4. APs (assumptes propis)

Personal hours off, counted **in hours**, per calendar year, per person (they move with the
person).

| Type | Limit | Effect |
|---|---|---|
| AP no recuperable (APNR) | 24 h a year, in at most 5 days (requests) | Just consumes the allowance. |
| AP recuperable (APR) | 24 h a year, in at most 3 days | Deducted from the calendar surplus (§5). |

- A night shift plus the following team meeting (REE) can be one request: the spreadsheet notes
  "Es pot demanar en una sola petició la nit+REE", and FPOL32 §2 says an AP on the Monday night
  shift includes Tuesday's REE. One request is at most 24 h.
- **The year closes on 31 January** (FPOL32 §1): APs of a year can be taken until 31 January of
  the next year and count toward that year's allowance and surplus. Each AP stores the year it
  counts toward (SPEC-004).
- APs need **5 days' notice** (FPOL32 §2). The director records only APs she approved; the app
  does not check the notice.
- **(open)** APs on public holidays: FPOL32 §2 says "No es podran demanar AP en els 14 festius
  anuals" but also that whoever asks for an AP on a holiday they were scheduled to work gets
  another holiday assigned. The app warns and allows it.
- **(built, SPEC-004)** Saldos records APs: rules in `src/lib/balances.ts`, table `aps`.
- **Integralia**, FASI's official tool, is where the director records APs and reads each
  person's remaining hours. Saldos duplicates it, so it gets no new work for now. The app still
  needs to know **who is absent on which day** (El mes coverage, Vacances' rule that an AP
  recuperable cannot be joined to vacations). **(open)** Whether the app records APs only as
  dated absences and leaves the balances to Integralia: decide in the El mes design.
- APs are also how people complete **loose days** that the vacation blocks do not allow (§7).
- Durations are entered with **one standard field `H:MM`** (product owner decision) and shown as
  `3 h 45 min`. The prototypes still accept `3,75` too; the app does not.
- An APR is **never blocked** for lack of surplus (director): the surplus simply goes negative.

## 5. Calendar surplus ("hores excedent calendari", "hores còmput")

- Each person has a balance of hours worked above (+) or below (−) their annual calendar.
  It starts each year at an opening value (stored per person and year, in minutes) and follows
  the person if they move to the other House.
- APR hours are subtracted from it. A negative surplus means the person **owes hours**.
- Owed hours are given back "quan hi ha necessitat de treball": the director asks the person to
  work extra when there is a need. **(open)** Recording returned hours so the surplus goes up
  again (asked in the Saldos prototype).
- FPOL32 §1 and §2: hours worked below the agreed year are regularised with occasional cover of
  holidays or other shifts, communicated with 5 days' notice; hours above it are compensated with
  rest. Neither is recorded in the app yet: the director adjusts the opening surplus on Equip.

## 6. Sick leave ("Baixa")

- Health data (GDPR Art. 9): store **only** that it is a "Baixa" and its dates. **Never** a
  reason, diagnosis or document. The UI reminds the director of this.
- A sick leave can be **open-ended** ("encara no se sap quan torna") and closed later with its
  last day.
- It can name **who covers** it (free text: "el CT", "Substituta: Júlia R."). If nobody does,
  the rota shows the post as uncovered that day.

## 7. Vacations

### Entitlement
- **31 natural days** a year. Prorated when someone starts mid-year (the spreadsheet shows 15
  and 16; the app defaults to `round(31 × remaining days / days in year)`, 16 for 1 July;
  **(open)** FASI's exact formula). Code: `defaultVacationDays` in `src/lib/rules.ts`; the director
  can overwrite the opening balances of each person and year on the Equip page.
- **AA** ("any anterior"): days carried over from last year, written "10AA" in the spreadsheet.
  **(open)** Until when they can be used and how they are split.

### FASI's period rule
- Periods of **at least 7 natural days**, never loose days.
- **At most 4 periods.** Every period is a **multiple of 7** (7, 14 or 21 days) **except one
  remainder** that completes the 31 days (10, 17, 24 or 31).
- Valid splits (FASI's table):

| Periods | 1st | 2nd | 3rd | 4th | Total |
|---|---|---|---|---|---|
| 1 | 31 | | | | 31 |
| 2 | 7 | 24 | | | 31 |
| 2 | 14 | 17 | | | 31 |
| 2 | 21 | 10 | | | 31 |
| 3 | 7 | 7 | 17 | | 31 |
| 3 | 7 | 14 | 10 | | 31 |
| 4 | 7 | 7 | 7 | 10 | 31 |

- The **AA days are one extra block outside this rule** (confirmed by the product owner, like
  the spreadsheet's "10AA").
- Days that the blocks cannot cover (loose days) are taken as **APs** instead.
- **(open)** How the rule applies to prorated entitlements, and what happens when fewer than
  7 days are left.
- The forms offer shortcuts: 1, 2 or 3 weeks, and "la resta (N dies)" for the remainder block.
- **(open)** FPOL32 §4 says blocks of 7 days apply "si es volen fraccionar en més de dos
  períodes": with two periods, any split of at least 7 days might be allowed (for example
  12 + 19), which is looser than the table above. To confirm with the director (SPEC-006).

### The yearly plan ("negociació de vacances")
- In **January**, House by House, the director enters what each person asks for that year,
  resolves conflicts, and **locks the plan: it is fixed for the whole year**. FPOL32 §4: the
  vacation calendar closes on **15 February** (the director mentioned 1 February; FPOL32 is the
  reference). So Vacances must be in production, with the team entered, by early January.
- A request is **demanada** (waiting for her decision: dashed honey) or **acceptada** (solid).
- **Conflicts** (both editable per House, **(open)** real rules):
  - more people off at the same time than allowed (default 2);
  - two people of the same post off at the same time (for example both night educators).
  The director said she does not know yet which roles may overlap.
- Summer and Christmas concentrate the conflicts; the prototype zooms on them and counts their
  conflict weeks.
- Helpers in the prototype: accept every request without conflict in one click; suggest the
  nearest conflict-free dates with the same length; drag a bar to move it.
- Closing is blocked while requests are pending or someone has more days than entitled.
  Conflicts left when closing are accepted knowingly (warning).

## 8. The month ("El mes", the rota)

- The month sheet is **printed and hung in the House** so everybody sees who works, who is on
  vacation or AP, and who is on sick leave. It must fit **one A4 landscape page**.
- Layout as in the spreadsheet: one block per week (Monday to Sunday), one row per post, the
  names of who works each day; absent people struck through with "vac." or "baixa" and who
  covers them below; a row for the Corretorn ("disponible", "cobreix X", "vac."); a notes row.
- A post with an absent person and nobody covering is **"Sense cobrir"** (honey: needs a
  decision).
- The director can **change who works a post on a specific day** and add a **note to the day**
  ("Ivan entra a les 21:30 h", "Sortida a Collserola").
- The rota rows are the **posts** (not invented shift groups): each day shows who works each
  post according to its weekly schedule (§3), and the director edits the exceptions.
- **(assumption)** The CT covers the first uncovered absence of the day; a sick leave with its
  own "who covers" uses that instead. **(open)** Who usually covers: always the CT, substitutes,
  someone from the other House?
- Days with more people off than the House limit are flagged. **(open)** Whether a short AP
  (for example 2 h) counts as a person off.
- FPOL32 §3 lists which posts cannot be absent at the same time (see §13). It answers the open
  question "which posts may overlap" for El mes and Vacances.
- Other views in the prototype: absences calendar, a per person table (V/A/B per day, like the
  spreadsheet) and an agenda (default on mobile).

## 9. Public holidays

Catalonia plus Barcelona's local holidays, as in the `FESTIUS` tab. Each holiday has three
shifts to cover: the night before, the day and the night after. 2026:

| Date | Holiday |
|---|---|
| 01/01 | Cap d'Any |
| 06/01 | Reis |
| 03/04 | Divendres Sant |
| 06/04 | Dilluns de Pasqua |
| 01/05 | Festa del Treball |
| 25/05 | Segona Pasqua (local) |
| 24/06 | Sant Joan |
| 15/08 | L'Assumpció |
| 11/09 | Diada |
| 24/09 | La Mercè (local) |
| 12/10 | Festa Nacional d'Espanya |
| 08/12 | La Puríssima |
| 25/12 | Nadal |
| 26/12 | Sant Esteve |

**(open)** 2027: take it from the official Generalitat and Barcelona calendars when they are
published. The holiday rota (who covers each holiday, fairly spread: "3 festius EN, 2 festius
ET…") is not prototyped yet.

2026 is coded in `src/lib/holidays.ts` (SPEC-004 warns when an AP falls on one). The list has the
14 days off of the official calendars, as FPOL32 §2 says (12 of Catalonia and 2 local of
Barcelona). Tots Sants (01/11) and Constitució (06/12) fall on a Sunday in 2026 and are not moved,
so they are not in it (confirmed by the product owner).

## 10. Conventions that come from the director

- Durations are always entered as **H:MM** (one standard field, `DurationInput`) and shown as
  `3 h 45 min` (`src/lib/duration.ts`).
- Dates are always **dd/mm/aaaa** (dd/mm inside sentences). Native date inputs follow the
  browser language, so use a field that always reads and writes dd/mm/aaaa (the prototypes'
  `dateInput` in `public/prototypes/shared/ui.js`; in the app, `DateInput`).
- "Today" is the date in Europe/Madrid (`todayInMadrid()`).
- Catalan, warm and direct copy ("Apunta-ho", "Falten 7 per planificar", "Deu 9 h 18 min").
- Honey (`accent`) means only "waiting for the director's decision": pending requests,
  conflicts, uncovered shifts. Never decoration or success (`DESIGN.md`).
- Every change can be undone right after it is made ("Desfés").

## 11. Screens and specs

| Screen | Replaces in the spreadsheet | Prototype | Spec | Status |
|---|---|---|---|---|
| Equip | (nothing: names were typed everywhere) | not prototyped | SPEC-003 `prototype-foundation` | Built |
| Saldos | `V I APS` | `saldos.html` | SPEC-004 `saldos` | Built |
| El mes | month tabs | `mes.html` | SPEC-005 | Waiting for feedback |
| Vacances | `VAC` | `vacances.html` | SPEC-006 | Waiting for feedback |

Build each screen from its prototype: same layout, copy, rules and interactions, replacing
`localStorage` with the database and Server Functions. Leave records (APs, vacations, sick
leave) belong to the person; rota changes and day notes belong to a House.

## 12. Roadmap (not yet specified)

- **History of people and posts**: who covered each post and when, and post changes planned
  for a future date.
- **GDPR compliance**: research first (retention periods, erasure of personal data when
  required, backups, rights of the people concerned), then a spec. Required before the first
  operational use with real data.
- **Detailed review of El mes and Vacances** with the director before SPEC-005 and SPEC-006.
  Priority: Vacances first (needed in January), then El mes, where most of the value is.
- Open questions from §§3 to 9 (real schedules, conflicts between posts, who covers, holidays
  of 2027, returned hours).

## 13. FASI instruction FPOL32 (summary)

"Instrucció relativa a gestió i organització del temps de treball i de descans a partir del dia
01/01/2020", núm. 04, 17/12/2019, from Direcció Persones and Direcció Tècnica to the Houses. The
rules that matter to the app, by spec:

| Rule | Where | Spec |
|---|---|---|
| Annual working time 1,701 h; the calendar closes on 31 January of the next year | §1 | SPEC-004 (AP year) |
| 12 h rest between shifts; weekly rest of 36 h, accumulable over two weeks; never more than 10 days of work in two weeks | §1 | SPEC-005 |
| APs depend on the person; 5 days' notice; no APs on the 14 annual holidays (see §4, open) | §2 | SPEC-004 |
| AP no recuperable counts as worked time and can be joined to vacations; AP recuperable does not count, must be recovered and **cannot be joined to vacations** | §2 | SPEC-004, SPEC-006 |
| An AP on the Monday night shift includes Tuesday's REE | §2 | SPEC-004 |
| Absence incompatibilities between posts (table below) | §3 | SPEC-005, SPEC-006 |
| Vacation calendar closed on 15 February; periods fixed for the year; cancelling needs Direcció de Persones' approval, at least two months before | §4 | SPEC-006 |
| Vacations in periods of at least 7 days; blocks of 7 when split in more than two periods; 10 days to reach 31 | §4 | SPEC-006 |
| Choosing order: EIF (DS, ER, then PSI/PDG/TS) and EE (CT first, then the six educators) by seniority, then rotating | §4 | SPEC-006 |
| A vacation starting on a night shift counts from 22:00 that day; ending on Monday, Tuesday's REE is a working day | §4 | SPEC-006 |
| Holidays shared out in December; the CT picks two holidays off; 12 h holiday shifts; a holiday hour counts 1.5 | §5 | SPEC-005 |

Absence incompatibilities (§3, "Incompatibilitats absències"; "Cobertures previstes" in brackets):

| Post | Cannot be absent at the same time as | Planned cover |
|---|---|---|
| Direcció | PSI, PDG, ER | EIF |
| Psicòleg (PSI) | Direcció, PDG, ER | none |
| Pedagog / TS (PDG) | Direcció, PSI, ER | none |
| ER | ES Tarda, ES CS, ES Nits, ES CT, TF Tarda, TF Matí, Direcció, PSI, PDG, TS | ES CT, EE |
| ES Tarda (ET) | ER, TF Tarda, ES Nit | ES CT |
| ES Cap de setmana (ECS) | ER | ES CT |
| ES Nit 1 (EN) | ER, ES Nit 2, ES Tarda | ES CT |
| ES Nit 2 (EN) | ER, ES Nit 1, ES Tarda | ES CT |
| TF Matí (TFM) | ER, TF Tarda | discretionary, external |
| TF Tarda (TFT) | ER, ES Tarda, TF Matí | ES CT |
