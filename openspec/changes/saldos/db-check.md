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
