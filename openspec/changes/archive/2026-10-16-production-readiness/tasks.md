## 1. Access

- [x] 1.1 `requireUser()` and `requireDirector()` redirect a signed-out request to `/sign-in` (tests)
- [x] 1.2 Remove sign-up: landing button, `/sign-up` route, proxy public route, sign-up env vars

## 2. Operations

- [x] 2.1 `GET /api/health` with a database check, public in `src/proxy.ts` (tests)
- [x] 2.2 Migration enabling Row Level Security on every table (migration test, applied to a local Postgres)
- [x] 2.3 Dev seed requires `ALLOW_DEV_SEED=1`

## 3. Docs and checks

- [x] 3.1 README, AGENTS.md and `.env.example` updated
- [x] 3.2 lint, typecheck, tests, build green
- [x] 3.3 Archive this change (specs merged into `openspec/specs/`)
