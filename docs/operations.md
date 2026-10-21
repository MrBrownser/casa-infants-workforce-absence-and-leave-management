# Operations runbook

How staging (the environment with real data) runs, and what to do when something goes wrong. Setup checklist and decisions:
issue #17. This repository is public: no secrets, hostnames or real data here or in issues.

## Where everything lives

| What | Where | Notes |
|---|---|---|
| Code, CI | GitHub, this repository | CI: lint, typecheck, tests, migrations, backup and restore drill |
| Hosting | Vercel project `casa-infants-staging` (Hobby), Functions in `dub1`, deploys `main` | No previews (Ignored Build Step); previews and `dev` live on `casa-infants-dev` (fictional data) |
| Database | Supabase staging project, `eu-west-1` (Free) | Data API off; RLS on every table |
| Sign-in | Separate Clerk application (development instance), email code sign-in, Restricted (invitation only); a production instance once there is a domain (#17) | Director flag: `publicMetadata.role = "director"`. Dev instances cap emails at about 100 a month: if sign-in codes stop arriving, that is the first thing to check |
| Backups | Private repository, nightly workflow (`scripts/backup/backup-workflow.example.yml`) | Encrypted with `age`; private key offline |
| Uptime | External monitor on `GET /api/health` every 5 min | Email alert; also keeps Supabase Free awake |
| Errors | Sentry (EU region), `NEXT_PUBLIC_SENTRY_DSN` on staging only | Errors only; user, cookies, headers, bodies, query strings scrubbed (`src/lib/sentry.ts`) |

Owners and who has access to each account are kept outside this repository (password manager).
2FA is on for every account.

## One-time setup

### Uptime monitor

Sentry → Alerts → Create Alert → **Uptime Monitor** (or a free UptimeRobot monitor): URL
`https://<staging URL>/api/health`, method GET, shortest interval offered, email notifications.
It fails on a `503` (database unreachable) as well as on downtime, and each check keeps the
Supabase Free project from pausing. Vercel only protects previews by default; if the monitor gets
a `401`, check Settings → Deployment Protection of `casa-infants-staging`.

### Nightly backups

1. **Key**, on your machine (`brew install age` or `apt install age`):
   `age-keygen -o casa-infants-backup.key`. It prints `Public key: age1...`. Store the whole key
   file in the password manager and delete the local copy: without it nobody can read a backup.
2. **Database URL**: Supabase → Connect → **Session pooler** (`:5432`), with the password filled
   in (same value as staging's `DIRECT_URL`).
3. **Private repository** (never this public one), Settings → Secrets and variables → Actions:
   secret `BACKUP_DATABASE_URL` (step 2) and variable `BACKUP_AGE_RECIPIENT` (the `age1...` key).
4. Copy `scripts/backup/backup-workflow.example.yml` to `.github/workflows/backup.yml` in the
   private repository. Nothing to edit: it checks out the script from this repository and
   installs the PostgreSQL 17 client (check the server version in Supabase → Settings →
   Infrastructure; 17 or older is fine).
5. Actions → **Nightly backup** → **Run workflow**. The run shows an artifact
   `backup-<id>` with a `casa-infants-<timestamp>.dump.age`. From then on it runs at 02:17 UTC.
6. **Prove it can be read**: download and unzip the artifact, then restore it into a throwaway
   Postgres (see Restore below), e.g. `docker run -d --name restore-test -e POSTGRES_PASSWORD=x
   -p 5433:5432 postgres:17` and `RESTORE_DATABASE_URL=postgresql://postgres:x@localhost:5433/postgres`.
   Repeat once the director has entered her team.
7. GitHub → Settings → Notifications → Actions: notify on failed workflows only.

## Deploy

Merge PRs into `dev`: `casa-infants-dev` deploys them and migrates the dev database. Check the
change there, then **promote**: open a PR from `dev` to `main` and merge it with **"Create a merge
commit"** (never squash). `casa-infants-staging` builds `main` and applies pending migrations to
the real database (`scripts/vercel-build.sh`). A failed build or migration leaves the previous
deployment live. Take a manual backup first when the promotion carries a migration that changes
or moves existing data.
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
  BACKUP_DATABASE_URL="<staging session pooler URL, :5432>" \
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
