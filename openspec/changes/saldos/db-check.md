# Database and browser checks: saldos

Checks that unit tests cannot make, run by hand. Supabase is not touched.

## 1. Migration on a throwaway local Postgres (task 2.2)

- Postgres 16 at `localhost:54329`, database `casa`.
- `npx prisma migrate deploy`: applied `20261013102029_init` and `20261015120000_aps` ("All migrations have been successfully applied.").
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: "No difference detected.", exit 0.

| Insert | Expected | Result |
|---|---|---|
| 2026 AP dated 31/01/2027, 60 min | accepted | `INSERT 0 1` |
| 2026 AP dated 01/02/2027 | `aps_date_check` | `violates check constraint "aps_date_check"` |
| 2026 AP dated 31/12/2025 | `aps_date_check` | `violates check constraint "aps_date_check"` |
| 0 minutes | `aps_minutes_check` | `violates check constraint "aps_minutes_check"` |
| 1441 minutes | `aps_minutes_check` | `violates check constraint "aps_minutes_check"` |
| kind `vacation` | invalid enum value | `invalid input value for enum ap_kind: "vacation"` |
| Delete the person | APs removed (cascade), count 0 | `DELETE 1`, then `count = 0` |

## 2. Two concurrent fifth APs (task 3.2)

A person with 4 APs no recuperables in 2026; two `createAp` calls at once for the fifth.

- Output: `[ 'saved', "rejected: Ja ha fet servir els 5 dies que permet aquest tipus d'AP." ]` and `APs stored: 5` (same result on three more runs).
- Expected: exactly one saved, the other rejected with "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.", 5 APs stored.

## 3. Browser check (task 5.6)

Run on 2026-10-15 on the developer's machine: `npm run dev` (Node 24) against a throwaway local Postgres 14 (port 54329, migrations applied, `npx prisma db seed`: 20 people, 15 APs), Clerk development keys, signed in as a user with the director flag. Headed Chromium driven by gstack browse; desktop 1280x800, mobile 390x844. Every write below was undone, leaving the 15 seeded APs.

1. `/paulo-freire` opens `/paulo-freire/saldos`, "Saldos 2026". The navigation shows Saldos as a link (`/paulo-freire/saldos`); Vacances and El mes are text with "aviat".
2. Totals: "Han de retornar hores · 2 persones · 13 h 15 min en total" (Roger and David). Clicking the card filters the list to David Valls Medina and Roger Beltrán Camps and presses "Deuen hores"; "Tothom" restores the list.
3. Search "nuria": the list shows "Ningú coincideix amb aquest filtre."; "Antics membres (1)" shows Núria Roca Ferrer.
4. Carla Ribas Solé in "Apuntar AP": tiles "4 h queden · 5/5 dies", error with icon "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.", "Apunta-ho" disabled.
5. David Valls Medina, AP no recuperable 2:00 on 25/12/2026: warning "És festiu (Nadal): segons la instrucció no es poden demanar AP en festius." and preview "Li quedaran 0 h d'AP no recuperables (dia 3 de 5)." Saved (row 2026-12-25, 120 min in `aps`); toast "Apuntat AP no recuperable de 2 h a David Valls Medina." with "Desfés"; "Desfés" deleted the row.
6. Mireia Santos Rovira's sheet on Saldos 2026 shows "dv. 15/01/2027 (gener 2027)" (2 h) and the APR "dv. 19/06/2026 · Descomptat de l'excedent" (9 h 45 min). On Saldos 2027 her sheet shows "Cap AP no recuperable aquest any."
7. Deleted Mireia's APR of 19/06/2026 from the sheet: toast "Esborrat." with "Desfés", the row left `aps`; "Desfés" restored it with the same kind, year, date, 585 minutes and House (`paulo-freire`), back in the sheet.
8. Carme Aymerich: Meritxell Torres Vila (Pedagoga, shared post, AP recorded in Carme Aymerich) shows "Queden 22 h 30 min · 1/5 dies" on both Houses; Júlia Romero Bosch shows "6 h 30 min usades · 1/3" and "Deu 6 h 30 min".
9. 390 px: no horizontal scroll; cards with three tiles (Vacances, AP no rec., Excedent; Júlia's Excedent tile on the warning background with the hourglass); "Apuntar AP" opens as a bottom sheet; the toast sits above the tab bar; the last card clears the tab bar.

Extra (final review): in a desktop table row, the point at the centre of a non-link cell resolves (`elementFromPoint`) to that row's own person link, so the whole-row click target stays inside its row in Chromium. Not checked in Safari.

## 4. Checks and build (task 6.3)

- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 47 files, 355 tests passed (209 before this change), re-run after the final review fixes.
- `npm run build`: re-run after the final review fixes with the same result. It ran as is, with no `.env.local` and no Clerk or database variables exported, and did not stop on missing variables. "Compiled successfully", TypeScript finished, 12 static pages generated. The route list includes `ƒ /[house]/saldos` (dynamic, server-rendered on demand) next to `/[house]`, `/[house]/team`, `/dashboard` and `/no-access`. No placeholder values were needed. Local Node is v22 (the repo targets 24); CI and the Vercel preview build on Node 24.

