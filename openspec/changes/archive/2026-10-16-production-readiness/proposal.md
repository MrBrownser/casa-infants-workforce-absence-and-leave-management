## Why

The app is about to hold real staff data in its first production deployment (#17, #23). A few
gaps must close first: signed-out requests to protected pages crash with a 500 instead of
sending the visitor to sign in (#35, #18), anyone can create an account, nothing tells us
when the app or its database is down, Supabase's Data API could expose the tables, and the
dev seed could write fictional people into an empty production database.

This is a light change (issue #36): small, well-understood fixes with no new domain rules,
screens or data, so it skips brainstorm, design and plan. The proposal and spec deltas keep
the behaviour documented in `openspec/specs/`.

## What Changes

- Signed-out requests to House pages and data are redirected to `/sign-in` instead of failing.
- Access is by invitation only: the app no longer offers sign-up (no "Crea un compte" button,
  no `/sign-up` route). Production's Clerk instance is set to Restricted mode by hand.
- New public health check, `GET /api/health`: `200 {"ok":true}` when the database answers,
  `503 {"ok":false}` otherwise, with no data or error details.
- Row Level Security enabled on every table, with no policies: the app (table owner, through
  Prisma) is unaffected; Supabase's Data API can read nothing.
- The dev seed runs only when `ALLOW_DEV_SEED=1` is set on the command line.

## Capabilities

### New Capabilities

- `operations`: health check, database tables closed to the Data API, dev seed guard.

### Modified Capabilities

- `house-context`: signed-out visitors are sent to sign in; access by invitation only.

## Non-goals

- Production provisioning, backups, uptime monitor and error tracking (#17).
- Roles beyond the director flag (SPEC-002).
- Initial data import (#37).

## Impact

- `src/lib/auth.ts`, `src/proxy.ts`, `src/app/page.tsx`, `src/app/sign-up/` (removed),
  `src/app/api/health/route.ts` (new), `prisma/migrations/` (new RLS migration),
  `prisma/seed.ts`, `.env.example`, `README.md`, `AGENTS.md`.
- Personal data: none added. The health check returns no data. RLS reduces exposure.
