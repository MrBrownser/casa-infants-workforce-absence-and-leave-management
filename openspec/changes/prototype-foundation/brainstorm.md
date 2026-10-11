# Brainstorm: Prototype foundation (SPEC-003)

Raw capture of the brainstorming that happened in one long session (2026-10-10 to 2026-10-11)
between the product owner and Claude, while building and testing static prototypes with the
director. Path: **architectural** (it resets the data model, removes a capability and sets the
direction for every later spec).

## Background: why we changed course

- SPEC-001 (House context) shipped and is on `main`: two Houses in the URL, a switcher, Clerk
  auth in Catalan, a temporary director flag (`publicMetadata.role === 'director'`), a Catalan
  404, "Sense accés", Madrid dates, and a dated `HouseMembership` model with a Postgres
  exclusion constraint and transfer logic. About 2,000 lines in `src/` and `prisma/`.
- SPEC-002 (roles and position assignments) was implemented on
  `feat/roles-and-position-assignments`: occupational roles, positions, dated assignments,
  handovers, transfers, director grants in the database, operation receipts, deferred
  triggers and a real-database test harness. About 6,600 lines of code and an 8,000-line plan.
  **It was never merged.**
- After two specs, the director still had no screen for what she actually does every day
  (vacations, APs, sick leave, the monthly rota). The product owner judged the result far too
  complex for a simple need and asked to slow down: build frontend-only prototypes first and
  get the director's feedback.

## The prototypes (now the reference for the product)

Static HTML in `public/prototypes/` (Tailwind browser build, Alpine.js, Lucide, self-hosted
Fraunces and Figtree, `DESIGN.md` tokens, fictional data, `localStorage` only). See
`public/prototypes/README.md`. They were built from the spreadsheet the director uses today
(`2026_CALENDARI_PF.xlsx`, one file per House, never committed: it holds real names and a phone
number). The spreadsheet has these tabs:

| Tab | What it does | Prototype that replaces it |
|---|---|---|
| `V I APS` | Per person: AP hours used and left (non-recoverable and recoverable, with dates and hours), "hores còmput", vacation days entitled and left, vacation periods. Each person has a colour. | `saldos.html` |
| `VAC` | Vacation periods per person ("Proposta V") plus a year calendar coloured per person to see overlaps. | `vacances.html` |
| One tab per month | The rota: per week, per day, the name of who works in each row (shift), and notes above each week ("AP GEMMA", "BAIXA GEMMA", "VACANCES FER", "Eva entra 21:30h"). Printed and hung in the House. Conditional formatting marks "demanat" (requested, not confirmed). | `mes.html` |
| `FESTIUS` | Who covers each public holiday (night before, day, night after) with entry and exit times (night about 22:00 to 10:30, day about 10:30 to 22:15). | Not prototyped yet |

### Prototype 1: Saldos (validated by the director)

Table per House: vacation days (enjoyed, planned, left to plan, AA), AP no recuperables (hours
left, days used of 5), AP recuperables used, calendar surplus (negative = owes hours). Stat
cards (days left to plan, AP used, people who owe hours) double as filters. Person sheet with
every entry and delete with undo. "Apuntar" form with live rule checks and the person's current
balance shown as soon as they are picked.

### Prototype 2: Vacances (next year's plan)

End-of-year negotiation, House by House: the director enters what each person asks for,
sees weeks with too many people off or two people of the same post off, adjusts (drag a bar,
or pick a conflict-free suggestion with the same length), accepts in bulk the requests without
conflicts, and locks the plan for the whole next year. Pending = dashed honey (needs a
decision). Zoom on summer and Christmas, where most conflicts are, with conflict counts.

### Prototype 3: El mes (the monthly rota)

"Quadrant" view (default and printable on one A4 landscape sheet): weeks as in the
spreadsheet, a row per shift, who works each day; absent people struck through with "vac." or
"baixa" and who covers them; "Sense cobrir" in honey when nobody covers; the CT's day; day
notes. The director can change who works a shift on a given day and add notes. Other views:
absences calendar, per person table (V/A/B like the spreadsheet), agenda (default on mobile).
Sick leave can be open-ended and is only ever "Baixa" (no reason, GDPR Art. 9).

## Decision log

### Q1. Who uses the first release and how does data get in?
**Decision: only the director enters data.** Staff ask her by WhatsApp or on paper; the app
is her notebook. (Staff self-service is a later idea, not planned.)

### Q2. What hurts most today?
**Decision: vacations and APs first**, then the monthly rota. Coverage and printing the month
came out as key once the month prototype existed.

### Q3. How do APs work?
- **In hours.** AP no recuperables (APNR): 24 h a year in at most 5 requests (days).
  AP recuperables (APR): 24 h a year in at most 3 days.
- An APR is **deducted from the "hores excedent calendari"** (calendar surplus). If the
  person has no positive surplus, the balance goes (further) negative and the person owes the
  hours. They return them "quan hi ha necessitat de treball" (when the director needs extra
  work). The director confirmed: never block an APR for lack of surplus.
- Hours are typed as `3:45` or `3,75`; keep both for now (director: "ja anirem provant-ho").
  The spreadsheet mixes both ("3,45h" vs "6,75h"), which is a source of errors.

### Q4. How do vacations work?
- 31 natural days a year, prorated when someone joins mid-year (the spreadsheet shows 15 and
  16). Days carried over from last year are "AA" ("any anterior"), shown as "10AA".
- FASI's rule (document provided by the product owner): periods of **at least 7 natural
  days**; at most **4 periods**; every period is a **multiple of 7** (7, 14, 21) **except one
  remainder** that completes the 31 days (10, 17, 24, 31). Valid splits: 31; 7+24; 14+17;
  21+10; 7+7+17; 7+14+10; 7+7+7+10. Never loose days.
- Open: how the rule applies to prorated entitlements and to AA days. Prototype assumption:
  the AA block is one extra period outside the rule.
- The plan for next year is negotiated at the end of the year, House by House, and then it
  is **fixed for the whole year**. The spreadsheet distinguishes proposal and confirmed
  ("Proposta V", "demanat"); the director needs a simpler negotiation view.
- Summer and Christmas concentrate the conflicts. Which posts may overlap is still unknown
  (the product owner will ask the director); the prototype uses "max people off at once"
  (default 2) and "two people of the same post", both editable.

### Q5. What does the month need?
- **Who works each day** is key: the month is printed and hung in the House so everybody
  sees schedules, vacations and absences.
- Shifts do not start at the same time; people arrive gradually. Exact times are unknown.
- The CT (**"corretorn"**, not "corretor": director's correction) covers absences. A sick
  leave can name who covers it (a substitute, the CT…).

### Q6. Both Houses at once?
**Decision: one House at a time** (director). Matches the URL model of SPEC-001.

### Q7. Dates and format
dd/mm/aaaa everywhere (product owner). Native date inputs follow the browser language, so the
prototypes use a custom field that always reads and writes dd/mm/aaaa.

### Q8. How to go to production: clean-up spec on SPEC-002, or back to the skeleton?
Options: (a) merge SPEC-002 and write a spec that deletes what is not wanted; (b) reset to the
first commits (stack only) and write new specs; (c) **start from `main`**, leave SPEC-002
unmerged as a reference branch, and write one small foundation spec.
**Decision: (c).** `main` already holds exactly what we want to keep (auth, routes, 404,
Houses, dates, design). SPEC-002 never reached `main`, so nothing has to be reverted. Option
(b) would throw away tested, useful pieces. The working branch was rebuilt from `main` and the
prototype commits were moved onto it.

### Q9. People model
Options: keep SPEC-001's dated memberships and add a post; or a **simple person** (name, House,
post, active) edited in place.
**Decision: simple person.** Moving someone to another post or House is an edit. Leaving is
"inactive", not deletion. No dated history. Records created later (absences, APs…) store their
own House, so moving a person does not move their history.

### Q10. What lives in code and what in the database?
**Decision (product owner):** posts per House, shifts and their times, the AP and vacation
rules and the public holidays live **in code**. What varies is **who** covers each post.
Plus, per person and year, the opening balances Saldos needs: vacation days entitled
(prorated), AA days and the calendar surplus at the start.

### Q11. Who can access production?
**Decision: only the director (and the product owner).** Keep SPEC-001's Clerk metadata flag;
no roles or grants in the database.

### Q12. Migrations
There is no production database yet and dev data is fictional. **Decision: one clean initial
migration** replacing `house_context`; the dev database is reset (it also holds SPEC-002's
tables from the unmerged branch).

## Validated design

1. **Keep from `main`:** Clerk (Catalan), `src/proxy.ts`, `requireUser()`, `requireDirector()`,
   sign-in and sign-up, the Catalan 404, "Sense accés", the landing page, Houses in the URL with
   switcher and `active-house` cookie, top bar and bottom tab bar, `dates.ts`, `DESIGN.md`
   tokens and components.
2. **Remove:** dated `HouseMembership`, its exclusion constraint, transfer logic
   (`house-membership.ts`, `membership-store.ts`), the read-only team list. SPEC-002 stays
   unmerged.
3. **Domain in code (`src/lib/`):** Houses, posts per House (provisional inventory taken from
   the prototypes until the director confirms it), shifts with provisional times, AP and
   vacation constants, public holidays per year.
4. **Database:** `houses`, `people` (name, House, post key, active), `person_years` (person,
   year, vacation days, AA days, calendar surplus). One active person per post.
5. **Screens:** "Equip" per House to manage who covers each post and each person's opening
   balances; navigation with the final sections (Saldos, Vacances, El mes shown as "aviat"
   until their spec ships, Equip).
6. **Context for later specs:** a domain reference (`docs/domain.md`) that collects every
   concept and rule above, the prototypes as the approved UI, and the director's feedback log
   (`docs/prototypes/director-feedback.md`).
7. **Next specs, in the order the director validates them:** SPEC-004 Saldos, SPEC-005 El mes,
   SPEC-006 Vacances.

## Open questions (for the director, through the product owner)

- Real post inventory of each House (how many night educators, referents…) and the exact
  shift times (arrivals are staggered).
- How the vacation rule applies to prorated entitlements and to AA days; until when AA days
  can be used; what happens when fewer than 7 days are left.
- Which posts may be off at the same time; maximum people off per House and season.
- Who usually covers an absence (always the CT, substitutes, someone from the other House?).
- Whether to record hours given back so the surplus goes up again (asked in the Saldos
  prototype).
- Retention and erasure of people who left (GDPR review before the first operational use).
