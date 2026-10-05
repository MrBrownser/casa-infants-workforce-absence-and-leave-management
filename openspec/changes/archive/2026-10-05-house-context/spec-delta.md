# SPEC-001 "House Context": what shipped vs. what was specified

> Handoff for the product/spec owner (2026-10-05). It is self-contained: read it against your
> own copy of SPEC-001. The original SPEC-001 text was pasted into a planning session and is not
> stored in the repo, so this delta is keyed by SPEC-001's IDs (FR/BR/EC). The canonical
> as-built specs are `openspec/specs/house-context/spec.md` and
> `openspec/specs/house-membership/spec.md`. Open them only if you need exact wording.

## 1. Outcome

SPEC-001 is implemented and verified (verify: PASS WITH WARNINGS, no blocking issues). The
director manually smoke-tested it as director and as non-director. The House is now the
operational boundary of the app: two Houses, one active House in the URL, a switcher,
House-scoped pages, dated employee membership and a read-only team page.

## 2. Requirement-by-requirement delta

| SPEC-001 ID | Outcome | What actually shipped / how it differs |
|---|---|---|
| FR-001 Houses | ✅ As specified | Exactly two: Paulo Freire (`paulo-freire`) and Carme Aymerich (`carme-aymerich`). Created by the database migration in every environment. The slugs are permanent. |
| FR-002 Active House visible | ✅ Adapted | A two-option segmented control (both Houses always visible), plus the House name as an eyebrow above every page title. The active option uses the Salvia "selected" style, never honey. |
| FR-003 Switch House | ✅ Adapted | Switching is a plain link that **keeps the current section** (`/paulo-freire/team` → `/carme-aymerich/team`). It writes nothing. |
| FR-004 / FR-005 House-scoped features, context preserved | ✅ Adapted | **Decision SPEC-001 left open:** the active House lives in the **URL** (`/<house>/<section>`). Every future feature becomes `/[house]/<section>` and inherits the scope. A cookie only remembers the last House, so `/dashboard` (the landing page after sign-in) can return you there. It never authorizes anything or filters data. |
| FR-006 Current team per House | ✅ As specified | Read-only **Equip** page: name plus "Des del <date>". "Current" is computed on **today's date in Europe/Madrid**. |
| FR-007 Historical membership | ⚠️ Logic only | Supported and tested in the domain logic (an employee's House for any date). **There is no UI yet.** |
| FR-008 / FR-009 Corretor (CT), per-House corretor | ⚠️ Structural only | No corretor entity or role. Guaranteed only in that membership is its own table, so a future role or coverage model can reference employee + House without touching membership. → SPEC-002. |
| BR-002 One House at a time | ✅ Stronger than specified | Enforced **in the database** (an exclusion constraint), not just in the app, so it holds even for direct SQL and concurrent writes. Dates are inclusive on both ends; no end date = ongoing. |
| BR-004 History keeps its House | ✅ As specified + **contract for future specs** | A transfer closes the current period on the day before the new start and opens a new one. Past periods are never edited. **New rule for every later spec:** each House-scoped record (AP, vacation, absence, coverage) stores its own House when it is created, and never derives it from the employee's current membership. |
| BR-005 / BR-006 / BR-007 / BR-008 Cross-House work, ER supervising | ⚠️ Structural only | Temporary cross-House work creates no membership and no duplicate employee. There is no coverage or assignment feature yet. BR-008 (ER standing in for the director) is a domain rule only: no ER has platform access. |
| EC-001 Switching changes no data | ✅ As specified | Switching is navigation only. |
| EC-002 Transferred employee leaves old team | ✅ Logic + team page | Ana leaves the Paulo Freire list after her last day. A "former members" view is **not built**. |
| BR-001, BR-003 | ❓ Not traced | The implementation artifacts never reference these IDs. Check them against your copy; they may be covered implicitly by the rows above. |
| §9 (assigns membership to SPEC-002) | 🔀 Changed | **Employee + dated House membership were pulled into SPEC-001**, because its Definition of Done (current team per House, preserved history) cannot be met without them. See section 3. |

## 3. Scope moved between specs

- **Pulled into SPEC-001 (from SPEC-002):** a minimal Employee (full name only) and dated House
  membership, including the transfer rule. No transfer or profile UI; a dev seed with fictional
  people provides the data.
- **Left for SPEC-002:** roles and positions (director, CT, ER, educator), the link from employee
  to user account, the corretor association per House, employee add/edit and the **transfer
  form**, and **real role-based access** (replacing the temporary director flag below).
- **Deferred to a GDPR review at the end of the first deliverable:** how long employee data is
  kept after someone leaves. Erasure exists: deleting an employee deletes their memberships.

## 4. Decisions now fixed (constraints for future specs)

1. **URL = active House.** New House features are sections under `/<house>/`. Route segments are
   English (`team`); UI labels are Catalan ("Equip").
2. **"Today" = Europe/Madrid date.** A transfer on 1 July takes effect at local midnight, not UTC.
3. **Dates are calendar dates, inclusive on both ends.** Open-ended means "ongoing".
4. **Transfers** end the current period on the day before the new start. They can be recorded in
   advance, are rejected for the same House or for a start on or before the current start, and
   never rewrite the past.
5. **Access is temporary:** only users flagged `director` in Clerk (today: the director and the
   developer) can see House pages or data. Everyone else sees "Sense accés". SPEC-002 must
   replace this with roles.
6. **All UI copy is Catalan**, including system pages. A Catalan 404 page ("No hem trobat
   aquesta pàgina", with a "Torna a l'inici" button) was added after the smoke test found the
   framework's English default.

## 5. Added beyond SPEC-001 (FYI)

- "Sense accés" page for signed-in users without the director flag.
- `/dashboard` now only redirects to the last visited House (Paulo Freire by default).
- Section navigation: Inici and Equip (top bar on desktop, bottom tab bar on mobile). Inici is a
  placeholder.
- A Catalan 404 page with a way back.

## 6. Inputs for the next specs (open items)

- **Transfer form (SPEC-002):** validate dates. Show a friendly message when a transfer would
  overlap (the database already rejects it). Decide who may record transfers.
- **"Membres anteriors" view** for EC-002 / FR-007: the logic exists and only the UI is missing.
- **Corretor and cross-House coverage:** a separate assignment model that references employee +
  House. It must not touch membership.
- **Roles replace the director flag**, including whether an ER covering the director gets
  access (BR-008).
- **Retention policy** for former employees (GDPR review).
- Known quality gaps (engineering, no product decision needed): no automated database tests, and
  no automated test for the mobile layout.
