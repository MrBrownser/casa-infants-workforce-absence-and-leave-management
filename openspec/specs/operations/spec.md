# operations Specification

## Purpose
How the app is run safely with real data: a public health check for uptime monitoring, every table closed to Supabase's Data API with Row Level Security, and a dev seed that runs only on explicit request. Created by archiving change production-readiness (issue #36).

## Requirements

### Requirement: Health check
The system SHALL expose a public `GET /api/health` that checks the database with a trivial query and answers `200` with `{"ok":true}` when it succeeds and `503` with `{"ok":false}` when it fails. The response MUST NOT contain personal data, error messages or connection details, and MUST NOT be cached. It requires no sign-in, so an external uptime monitor can poll it.

#### Scenario: Database reachable
- **WHEN** an unauthenticated client calls `GET /api/health` and the database answers
- **THEN** the response is `200` with body `{"ok":true}`

#### Scenario: Database unreachable
- **WHEN** an unauthenticated client calls `GET /api/health` and the database query fails
- **THEN** the response is `503` with body `{"ok":false}` and no error details

### Requirement: Tables closed to the Data API
Every application table SHALL have Row Level Security enabled with no policies, so that roles other than the table owner (such as Supabase's `anon` and `authenticated` roles behind the Data API) can read or write no rows. The application, which connects as the table owner, MUST keep working unchanged.

#### Scenario: Migrations applied
- **WHEN** all migrations have been applied to an empty database
- **THEN** `houses`, `people`, `person_years`, `aps` and `_prisma_migrations` have Row Level Security enabled

### Requirement: Dev seed only on request
The development seed (fictional people and APs) SHALL run only when the `ALLOW_DEV_SEED=1` environment variable is set and `NODE_ENV` is not `production`. Otherwise it MUST stop before connecting to the database.

#### Scenario: Seed without opt-in
- **WHEN** `npx prisma db seed` runs without `ALLOW_DEV_SEED=1`
- **THEN** it exits with an error explaining how to opt in and writes nothing

#### Scenario: Seed in dev with opt-in
- **WHEN** `ALLOW_DEV_SEED=1 npx prisma db seed` runs against the dev database
- **THEN** it adds the fictional people and APs as before
