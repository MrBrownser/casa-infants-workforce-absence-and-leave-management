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
- The decision log: `openspec/changes/prototype-foundation/brainstorm.md` (archived later under
  `openspec/changes/archive/`).

Items marked **(open)** are not confirmed yet; items marked **(assumption)** are what the
prototypes do until the director says otherwise.

## 1. Who uses the app

- **The director** ("la directora") of the two Houses is the only user. She enters everything:
  staff ask her by WhatsApp or on paper. She works on desktop and checks things on mobile.
- The product owner (developer) also has access.
- Access is the Clerk `publicMetadata.role === 'director'` flag (`src/lib/auth.ts`).
- She works **one House at a time** (her answer), switching with the House switcher.

## 2. Houses, posts and people

- Two Houses: **Paulo Freire** (`paulo-freire`) and **Carme Aymerich** (`carme-aymerich`).
  Casa d'Infants is a 24/7 residential service for children run by FASI.
- Each House has a fixed set of **posts** (`src/lib/posts.ts`). What changes is **who** covers
  each post. One active person per post; a post with nobody is "Vacant".
- Roles (code → Catalan label):

| Code | Label | Typical shift |
|---|---|---|
| PDG | Pedagoga | Equip tècnic, weekdays |
| PSI | Psicòloga | Equip tècnic, weekdays |
| ER | Educadora referent | Referents, weekdays |
| TFM | Treballadora familiar de matins | Matí, weekdays |
| TFT | Treballadora familiar de tardes | Tarda, weekdays |
| ET | Educadora de tardes | Tarda, weekdays |
| ECS | Educadora de cap de setmana | Weekends and public holidays |
| EN | Educadora de nit | Nights, rotating |
| CT | **Corretorn** (never "corretor": director's correction) | No fixed shift: covers absences |

- An ER may stand in for the director when she is away; that gives no app access.
- **(open) Real inventory.** The code starts with the prototypes' inventory: Paulo Freire 11
  posts (2 ER, 2 EN, TFM, TFT, ET, ECS, PDG, PSI, CT), Carme Aymerich 10 (1 ER, 2 EN, TFM, TFT,
  ET, ECS, PDG, PSI, CT). The real Paulo Freire spreadsheet suggests about 13 people and
  **three** night educators rotating. Confirm with the director and edit `posts.ts`.
- A person can be moved to another post or House (an edit) or marked inactive when they leave
  (never deleted from the UI). Records (APs, vacations, sick leave, rota changes) store their own
  House and person, so moving a person does not move their history.
- Substitutes who only cover an absence are **not** people with a post: they are written as
  "who covers" on the absence (see §6).

## 3. Shifts and schedules

- Shifts (`src/lib/shifts.ts`), in display order: Matí, Tarda, Referents, Equip tècnic,
  Cap de setmana i festius, Nit, Corretorn.
- Weekday posts work Monday to Friday; the weekend post works Saturdays, Sundays and public
  holidays; night educators rotate (in the spreadsheet: one person Monday, another Tuesday to
  Thursday, another Friday to Sunday, changing every week).
- Known times (from the `FESTIUS` tab): night about **22:00 to 10:30**; holiday day shift about
  **10:30 to 22:15**; the night after a holiday starts about 22:00. Times vary by person by
  15 to 45 minutes and are written as notes ("Eva entra 21:30h").
- **(open)** Exact times of every shift. Arrivals are **staggered**: shifts do not start at the
  same time. Unknown times are left out, never invented.
- **(open)** Who works mornings and afternoons at weekends.

## 4. APs (assumptes propis)

Personal hours off, counted **in hours**, per calendar year.

| Type | Limit | Effect |
|---|---|---|
| AP no recuperable (APNR) | 24 h a year, in at most 5 days (requests) | Just consumes the allowance. |
| AP recuperable (APR) | 24 h a year, in at most 3 days | Deducted from the calendar surplus (§5). |

- The spreadsheet notes "Es pot demanar en una sola petició la nit+REE" (a night shift plus its
  REE can be one request). **(open)** What REE means exactly and how it counts.
- Hours are typed as `3:45` or `3,75` (also `3h45`, `3.75`, `8`); the director wants both for now.
  Shown as `3 h 45 min`. The spreadsheet mixes both formats, which causes errors.
- An APR is **never blocked** for lack of surplus (director): the surplus simply goes negative.

## 5. Calendar surplus ("hores excedent calendari", "hores còmput")

- Each person has a balance of hours worked above (+) or below (−) their annual calendar.
  It starts each year at an opening value (stored per person and year).
- APR hours are subtracted from it. A negative surplus means the person **owes hours**.
- Owed hours are given back "quan hi ha necessitat de treball": the director asks the person to
  work extra when there is a need. **(open)** Recording returned hours so the surplus goes up
  again (asked in the Saldos prototype).

## 6. Sick leave ("Baixa")

- Health data (GDPR Art. 9): store **only** that it is a "Baixa" and its dates. **Never** a
  reason, diagnosis or document. The UI reminds the director of this.
- A sick leave can be **open-ended** ("encara no se sap quan torna") and closed later with its
  last day.
- It can name **who covers** it (free text: "el CT", "Substituta: Júlia R."). If nobody does,
  the rota shows the shift as uncovered.

## 7. Vacations

### Entitlement
- **31 natural days** a year. Prorated when someone starts mid-year (the spreadsheet shows 15
  and 16; the app defaults to `round(31 × remaining days / days in year)`, 16 for 1 July;
  **(open)** FASI's exact formula).
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

- **(assumption)** The AA days are one extra block outside this rule.
- **(open)** How the rule applies to prorated entitlements, and what happens when fewer than
  7 days are left.
- The forms offer shortcuts: 1, 2 or 3 weeks, and "la resta (N dies)" for the remainder block.

### The yearly plan ("negociació de vacances")
- At the **end of the year**, House by House, the director enters what each person asks for
  next year, resolves conflicts, and **locks the plan: it is fixed for the whole year**.
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
- Layout as in the spreadsheet: one block per week (Monday to Sunday), one row per shift, the
  names of who works each day; absent people struck through with "vac." or "baixa" and who
  covers them below; a row for the Corretorn ("disponible", "cobreix X", "vac."); a notes row.
- A shift with an absent person and nobody covering is **"Sense cobrir"** (honey: needs a
  decision).
- The director can **change who works a shift on a specific day** and add a **note to the day**
  ("Ivan entra a les 21:30 h", "Sortida a Collserola").
- **(assumption)** The rota follows a weekly pattern by post (§3) and the director edits the
  exceptions. **(open)** The real pattern and how often it changes.
- **(assumption)** The CT covers the first uncovered absence of the day; a sick leave with its
  own "who covers" uses that instead. **(open)** Who usually covers: always the CT, substitutes,
  someone from the other House?
- Days with more people off than the House limit are flagged. **(open)** Whether a short AP
  (for example 2 h) counts as a person off.
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
| 01/11 | Tots Sants |
| 06/12 | Constitució |
| 08/12 | La Puríssima |
| 25/12 | Nadal |
| 26/12 | Sant Esteve |

**(open)** 2027: take it from the official Generalitat and Barcelona calendars when they are
published. The holiday rota (who covers each holiday, fairly spread: "3 festius EN, 2 festius
ET…") is not prototyped yet.

## 10. Conventions that come from the director

- Dates are always **dd/mm/aaaa** (dd/mm inside sentences). Native date inputs follow the
  browser language, so use a field that always reads and writes dd/mm/aaaa (the prototypes'
  `dateInput` in `public/prototypes/shared/ui.js`).
- "Today" is the date in Europe/Madrid (`todayInMadrid()`).
- Catalan, warm and direct copy ("Apunta-ho", "Falten 7 per planificar", "Deu 9 h 18 min").
- Honey (`accent`) means only "waiting for the director's decision": pending requests,
  conflicts, uncovered shifts. Never decoration or success (`DESIGN.md`).
- Every change can be undone right after it is made ("Desfés").

## 11. Screens and specs

| Screen | Replaces in the spreadsheet | Prototype | Spec | Status |
|---|---|---|---|---|
| Equip | (nothing: names were typed everywhere) | not prototyped | SPEC-003 `prototype-foundation` | In progress |
| Saldos | `V I APS` | `saldos.html` | SPEC-004 | Validated by the director |
| El mes | month tabs | `mes.html` | SPEC-005 | Waiting for feedback |
| Vacances | `VAC` | `vacances.html` | SPEC-006 | Waiting for feedback |

Build each screen from its prototype: same layout, copy, rules and interactions, replacing
`localStorage` with the database and Server Functions. Every record stores its own House
and person.
