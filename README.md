# Casa d'Infants: Time & Leave

A web app to manage time off, absences and leave for the Casa d'Infants team.

> Status: skeleton. Auth, a landing page and a protected `/dashboard` placeholder
> are in place; no time and leave features yet. The UI is in Catalan; code is in English.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript, on Vercel (EU region) |
| Styling | Tailwind v4 + shadcn/ui; design system in `DESIGN.md` (Fraunces + Figtree, clay-house palette) |
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
- Optional: **gstack** skills (`/browse`, `/ship`, `/review`, …) if used by the team.

### Tooling provisioning (developers and cloud agents)

Two prerequisites, provisioned differently because one is a plugin and one is a
plain binary. Both are handled by `.claude/ensure-tooling.sh`.

**Superpowers plugin.** Plugin skills load at Claude Code startup, so the plugin
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
`superpowers@claude-plugins-official`; `openspec --version` should resolve.

## Getting started

```bash
nvm use                # Node 24
npm install            # also generates the Prisma client (postinstall)
cp .env.example .env.local   # then fill in real values (see below)
npm run dev            # http://localhost:3000
```

Routes: `/` landing page, `/sign-in`, `/sign-up`, `/dashboard` (signed-in only).

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
  sign-in/sign-up route and redirect variables. `clerk init --app <app-id>` (Clerk
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

1. Apply migrations: `npm run db:migrate` (creates the two Houses).
2. Seed fictional employees (dev only): `npx prisma db seed`. Re-running does nothing once employees exist.
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

- Import the repo in Vercel; pin the **Function region to the same EU region as
  Supabase** (`dub1`, Dublin, for `eu-west-1`).
- Production uses **separate** credentials: a new Supabase project for prod and the
  Clerk production instance. Set them only in the Vercel project settings; never
  point a local `.env.local` at the prod database.
- Pushes to the default branch deploy automatically.

## GDPR

Employee data stays in EU-hosted Supabase. Absence records can contain health
information (sick leave), which is special-category data under GDPR Art. 9, so
features that touch it must define who can see it, how long it is kept, and how it
is erased.
