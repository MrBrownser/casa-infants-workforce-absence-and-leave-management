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

Pending for the product owner on the Vercel preview. This container has no `.env.local`, no Clerk development keys and no user with the director flag, so `/paulo-freire` cannot be opened here and nothing was run in a browser. The nine items of the checklist (redirect and navigation link, totals and card filter, "nuria" search and "Antics membres", Carla's 5 of 5 notice, David's 25/12/2026 AP with the holiday notice and "Desfés", Mireia's January 2027 AP, delete and undo, Carme Aymerich's shared Pedagoga and Júlia's "Deu 6 h 30 min", and the 390 px layout with the bottom sheet and the toast above the tab bar) are still to be checked.

## 4. Checks and build (task 6.3)

- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 47 files, 354 tests passed (209 before this change).
- `npm run build`: ran as is, with no `.env.local` and no Clerk or database variables exported, and did not stop on missing variables. "Compiled successfully", TypeScript finished, 12 static pages generated. The route list includes `ƒ /[house]/saldos` (dynamic, server-rendered on demand) next to `/[house]`, `/[house]/team`, `/dashboard` and `/no-access`. No placeholder values were needed. Local Node is v22 (the repo targets 24); CI and the Vercel preview build on Node 24.

