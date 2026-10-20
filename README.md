# Casa d'Infants: Time & Leave

A web app to manage time off, absences and leave for the Casa d'Infants team.

> Status: Houses, the final navigation and the Equip page (people per post, opening balances)
> are in place. Saldos, Vacances and El mes are next (SPEC-004 to SPEC-006). The UI is in
> Catalan; code is in English.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript, on Vercel (EU region) |
| Styling | Tailwind v4 + shadcn/ui; design system in `DESIGN.md` (Fraunces + Figtree, clay-house palette); overlays use the shadcn Drawer on Base UI |
| Database | Prisma 7 + Supabase Postgres (EU) |
| Auth | Clerk (Catalan UI via `@clerk/localizations`) |
| Forms | react-hook-form + zod |
| Tests | Vitest + Testing Library |

## Prerequisites

Beyond Node 24 + npm, the spec-driven workflow relies on tooling installed
**globally on the developer's machine** (not vendored in this repo):

- **OpenSpec CLI** — `brew install openspec` (or see https://openspec.dev). Verify: `openspec --version`.
- **Superpowers plugin** for your coding agent (`superpowers@claude-plugins-official`),
  providing the `brainstorming`, `writing-plans`, `using-git-worktrees`,
  `subagent-driven-development`, and `finishing-a-development-branch` skills.
- **Vercel plugin** (`vercel@claude-plugins-official`), providing Next.js, React
  best-practices, Cache Components and Vercel platform skills. Enabled for the project
  instead of copying those skills into the repo, so they stay current.
- Optional: **gstack** skills (`/browse`, `/ship`, `/review`, …) if used by the team.

### Tooling provisioning (developers and cloud agents)

Two kinds of prerequisite, provisioned differently: plugins and a plain binary.
All are handled by `.claude/ensure-tooling.sh`.

**Superpowers and Vercel plugins.** Plugin skills load at Claude Code startup, so the plugins
must be installed *before* the session launches. In a cloud/remote environment
that means the environment's **Setup script** (a one-time, snapshotted, pre-launch
step). Set it to:

```bash
bash .claude/ensure-tooling.sh
```

Because the setup phase is snapshotted, you configure it once per environment and
every later task reuses it. That is what makes the AFK "send tasks to the cloud"
workflow work. Committing `enabledPlugins` to `.claude/settings.json` is not
sufficient on its own: it *enables* an installed plugin but does not reliably
*fetch* one in a headless session, and a `SessionStart` hook runs too late (after
skills have already loaded).

**OpenSpec CLI.** A plain binary, so it is more forgiving. The same script
installs `@fission-ai/openspec` (the real package; bare `openspec` on npm is an
unrelated placeholder), and a `SessionStart` hook in `.claude/settings.json` also
runs the script, so local developers get the CLI with no setup at all.

Without the plugin present, the `superpowers-bridge` schema's `/opsx:apply`
precheck STOPS (by design) rather than implementing by hand.

Remote troubleshooting: confirm the session is on a branch that contains
`.claude/`, that the environment's network level reaches `github.com`, and that
the Setup script above is configured. `claude plugin list` should show
`superpowers@claude-plugins-official` and `vercel@claude-plugins-official`;
`openspec --version` should resolve.

## Getting started

```bash
nvm use                # Node 24
npm install            # also generates the Prisma client (postinstall)
cp .env.example .env.local   # then fill in real values (see below)
npm run dev            # http://localhost:3000
```

To open the dev server from a phone on the same network, set `ALLOWED_DEV_ORIGINS` in
`.env.local` to this machine's LAN IP, the "Network" address `npm run dev` prints (see
`.env.example`), restart it and open that address on the phone. Signing in over plain
`http://<ip>` is unreliable: the page is not a secure context, Clerk cannot use Web Crypto,
and after signing in the server still renders you signed out until a manual reload. To test
signed-in screens on a phone use an HTTPS address (a Vercel preview, or a tunnel such as
`cloudflared tunnel --url http://localhost:3000` with its host added to `ALLOWED_DEV_ORIGINS`).

Routes: `/` landing page, `/sign-in` (no sign-up: accounts are invited from the Clerk
dashboard), `/api/health` (public health check), `/dashboard` (signed-in only, redirects to the
last House), `/<house>` (redirects to Equip), `/<house>/team` (Equip).

If you edit `prisma/schema.prisma`, re-run `npm run db:generate` to refresh the
generated client (`src/generated/prisma`, gitignored) before `npm run typecheck`
or `npm run build`.

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

- **Supabase** (create a project in an **EU region**; region is irreversible).
  The current project (`eu-west-1`) is the **dev** database:
  - `DATABASE_URL`: pooled connection (Supavisor, port `6543`, `pgbouncer=true`) for runtime.
  - `DIRECT_URL`: direct connection (port `5432`) for migrations.
- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, plus the
  sign-in route and redirect variables. `clerk init --app <app-id>` (Clerk
  CLI) writes these to `.env.local` for you.

> Clerk keys are required for `npm run build` and `npm run dev` to run, since the
> root layout is wrapped in `<ClerkProvider>`.

## Database

Prisma reads `.env.local` (then `.env`) via `prisma.config.ts`. After editing `prisma/schema.prisma`:

```bash
npm run db:push       # prototype: push schema without a migration
npm run db:migrate    # create a migration (uses DIRECT_URL)
npm run db:studio     # browse data
```

### Dev data and access

1. Apply migrations: `npm run db:migrate` (creates the two Houses). **After pulling SPEC-003**
   (`prototype-foundation`) reset the dev database instead: `npx prisma migrate reset --force`.
   It drops everything; the dev database only holds fictional data.
2. Seed fictional people and APs (dev only): `ALLOW_DEV_SEED=1 npx prisma db seed` (20 people, 3 inactive, 15 APs of
   2026). Re-running adds nothing once people (or APs) exist. After pulling SPEC-004 (`saldos`) run
   `npm run db:migrate` and the seed again: it adds the APs. The seed refuses to run without
   `ALLOW_DEV_SEED=1`; set it on the command line only, never in `.env.local`, so a database
   URL pointed at production by mistake cannot get fictional people.
3. In the Clerk dashboard, open your user → **Metadata** → **Public** and set:

   ```json
   { "role": "director" }
   ```

   Without it you will land on the "Sense accés" page.

## Spec-Driven Development

This repo is configured for OpenSpec with the **superpowers-bridge** schema
(`openspec/config.yaml`). Build features through the workflow rather than ad hoc:

```
/opsx:propose   →  brainstorm → proposal → design → specs → tasks → plan → apply → verify
```

## Deployment (Vercel)

`vercel.json` pins the Function region to `dub1` (Dublin), next to Supabase `eu-west-1`
(GDPR: EU only). `postinstall` runs `prisma generate`, which works without `DIRECT_URL` or
`DATABASE_URL`, and `next build` needs only the Clerk keys.

The GitHub repo is connected to the Vercel project: every merge to `main` deploys to
Production, every other branch gets a preview URL.

### CI

`.github/workflows/ci.yml` runs on every PR and on `main`: lint, typecheck and tests, plus a
migrations job that applies all migrations to a throwaway Postgres and fails if
`schema.prisma` has changes no migration covers. Make both jobs required checks on `main`
(GitHub, Settings, Branches) so a red PR cannot be merged.

### Migrations

`vercel.json` runs `scripts/vercel-build.sh`: it builds, then on **Production** deployments
only runs `prisma migrate deploy`. A failed build never touches the database; a failed migration
fails the deployment and the previous one stays live. Previews never migrate (they share the
dev database with Production), so a preview of a PR that adds a migration may break until it
is merged. Production needs `DIRECT_URL` (session pooler, `:5432`) set for the Production
environment only; without it the production build fails on purpose.

Rules for migrations:

- **Backward compatible only.** For a few seconds the old code runs on the new schema, and a
  Vercel instant rollback does not roll back the database. Add columns as nullable or with a
  default; never rename or drop in one step.
- **Destructive changes take two PRs** (expand, then contract): first add the new shape and
  stop using the old one, merge and deploy; then drop the old column or table in a later PR.
- **Never edit a merged migration.** Fix forward with a new one.

By hand, against any database: `DIRECT_URL="<target direct url>" npx prisma migrate deploy`.

### Preview with dev keys (first target)

A preview deployment uses the Clerk **development** instance and the Supabase **dev** database
(fictional data). Set these in the Vercel project for the **Preview** environment only (names only):

- `DATABASE_URL`: pooled Supabase URL (`:6543`, `pgbouncer=true`). It is the only database
  variable the running app reads. If you see "too many connections" under load, add
  `connection_limit=1` to this URL (not needed so far; untested).
- `DIRECT_URL`: not for Preview (previews never migrate). Set it for **Production** only, where
  the build runs `prisma migrate deploy` (see Migrations).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: the `pk_test_` / `sk_test_` keys.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`: same
  values as `.env.example`. The app has no sign-up route; the old `NEXT_PUBLIC_CLERK_SIGN_UP_*`
  variables can be removed from Vercel.

Do not set `ALLOWED_DEV_ORIGINS` (dev server only).

**A dev-only Vercel project** (for example `casa-infants-dev`): its main URL and every
`vercel deploy --prod` or push to the production branch use Vercel's **Production**
environment, not Preview. Add the same variables (dev keys, dev database) to Production too,
plus `DIRECT_URL` for the dev database, then redeploy; variables only apply to new deployments. Without them the proxy fails with
"Clerk keys are missing from your environment" and every page returns 500.

**Clerk side.** Clerk's Vercel guide says preview and development deployments can use the
development API keys, and only forbids `*.vercel.app` for production
(https://clerk.com/docs/deployments/deploy-to-vercel). It does not state explicitly that a
development instance needs no domain setup for `*.vercel.app`; this is unconfirmed until the
first sign-in on a preview URL. If sign-in fails, check the preview guide linked from that page.
The user needs `publicMetadata.role = "director"` in the dev instance (see "Dev data and access").

**Commands** (Vercel CLI, run by the product owner; install with `npm i -g vercel`):

```bash
vercel login
vercel link                       # create or pick the project, connect the Git repo
vercel env add DATABASE_URL preview
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview
vercel env add CLERK_SECRET_KEY preview
vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL preview
vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL preview
vercel deploy                     # no --prod: creates a preview and prints an https URL
```

If the CLI asks for a Git branch when adding a Preview variable, leave it empty (all branches).
Dashboard alternative: Vercel, Add New Project, import the GitHub repo, add the same variables
under Environment Variables with only "Preview" ticked, then push the branch.
Open the printed `https://...vercel.app` URL on the phone.

**Security.** Preview URLs are public. Access is still gated by Clerk sign-in plus the `director`
role, and the dev database holds fictional data only. Vercel Deployment Protection (Vercel
Authentication) can add a second gate if wanted.

### Production

The full checklist (providers, backups, monitoring, cutover) is issue #17; how to run it, back
it up and restore it is `docs/operations.md`. In short:

- A separate Vercel project for production, a separate Supabase EU project (`eu-west-1`) and the
  Clerk production instance: never the dev ones, which previews and the seed write to.
- Production environment variables (names only): `DATABASE_URL`, `DIRECT_URL` (the build applies
  migrations), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (`pk_live_` /
  `sk_live_`), `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`.
- Clerk production needs its own custom domain (`*.vercel.app` is not allowed). Set sign-up to
  **Restricted** (invitation only) and set `publicMetadata.role` to `director` on each invited
  account.
- Supabase: turn the **Data API off**. Every table also has Row Level Security on with no
  policies (migration `enable_rls`), so the Data API could read nothing anyway; the app connects
  as the table owner and is not affected. **A migration that creates a table must enable RLS on
  it** (`src/lib/rls-migration.test.ts` fails otherwise).
- Errors: `NEXT_PUBLIC_SENTRY_DSN` (Production only) turns on Sentry (EU region), errors only,
  with no personal data (`src/lib/sentry.ts`). Without it nothing is reported.
- Health check: `GET /api/health` answers `200 {"ok":true}` or `503 {"ok":false}` after a
  `SELECT 1`, with no data. Point the uptime monitor at it; polling it also keeps a Supabase
  Free project from pausing.
- Never point a local `.env.local` at production, and never run the dev seed against it.

## GDPR

Employee data stays in EU-hosted Supabase. Absence records can contain health
information (sick leave), which is special-category data under GDPR Art. 9, so
features that touch it must define who can see it, how long it is kept, and how it
is erased.
