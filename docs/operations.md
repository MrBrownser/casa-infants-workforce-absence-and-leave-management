# Operations runbook

How production runs, and what to do when something goes wrong. Setup checklist and decisions:
issue #17. This repository is public: no secrets, hostnames or real data here or in issues.

## Where everything lives

| What | Where | Notes |
|---|---|---|
| Code, CI | GitHub, this repository | CI: lint, typecheck, tests, migrations, backup and restore drill |
| Hosting | Vercel project `casa-infants` (Hobby), Functions in `dub1` | Previews live on `casa-infants-dev` (fictional data) |
| Database | Supabase production project, `eu-west-1` (Free) | Data API off; RLS on every table |
| Sign-in | Clerk production instance, Restricted (invitation only) | Director flag: `publicMetadata.role = "director"` |
| Backups | Private repository, nightly workflow (`scripts/backup/backup-workflow.example.yml`) | Encrypted with `age`; private key offline |
| Uptime | External monitor on `GET /api/health` every 5 min | Email alert; also keeps Supabase Free awake |
| Errors | Sentry (EU region), if set up | No personal data sent |

Owners and who has access to each account are kept outside this repository (password manager).
2FA is on for every account.

## Deploy

Merge to `main`. Vercel builds and, on Production only, applies pending migrations
(`scripts/vercel-build.sh`). A failed build or migration leaves the previous deployment live.
Migrations must be backward compatible (README → Migrations).

## Roll back

Vercel → the project → Deployments → the last good one → **Instant Rollback**. It rolls back
the code only, **not the database**; since migrations are backward compatible, the older code
still runs on the newer schema. Then fix forward with a PR.

## Back up

- Nightly, automatic: the private repository's workflow runs `scripts/backup/backup.sh` and
  keeps 30 days of encrypted dumps as workflow artifacts. GitHub emails the owner when a run fails.
- By hand, before a migration that changes or moves existing data:

  ```bash
  BACKUP_DATABASE_URL="<production session pooler URL, :5432>" \
  BACKUP_AGE_RECIPIENT="age1..." \
  scripts/backup/backup.sh <output-dir>
  ```

  `pg_dump` must be at least the server's Postgres major version (`PG_BIN` points at another
  client). Only schema `public` is dumped: our tables, their data, RLS and `_prisma_migrations`.

## Restore

Into an **empty** database (a new Supabase project, or a local Postgres for a drill), from the
repository root after `npm ci`:

```bash
RESTORE_DATABASE_URL="<target URL>" \
AGE_IDENTITY_FILE=<file with the age private key> \
scripts/backup/restore.sh <file.dump.age>
```

It refuses a database that already has tables, restores the dump and runs `prisma migrate
deploy`, which brings an older backup up to the schema of the checked-out code. Then point the
Vercel `DATABASE_URL` and `DIRECT_URL` at the restored database and redeploy.

Drills: CI repeats the backup and restore on every PR. Restoring a dump taken before a later
migration was tested by hand on 2026-10-20 (`enable_rls` applied on restore, data intact);
repeat it after the first migration that changes existing data.

## Incidents

- **App down** (uptime alert): check Vercel deployments and logs, then `/api/health`. A `503`
  means the database: check the Supabase project (paused, over quota, incident).
- **Personal data exposed or lost** (data breach): tell FASI, the controller, the same day with
  what happened, which data and people, and what was done. FASI decides on notifying the
  AEPD, which must happen **within 72 hours** of becoming aware (GDPR Art. 33). Keep a written
  record either way.

## Access review

Every 6 months and when someone leaves: who has the director flag in Clerk, and who has access
to Vercel, Supabase, Clerk, the backup repository and the age private key. Remove what is no
longer needed.
