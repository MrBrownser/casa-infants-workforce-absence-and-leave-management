<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Casa d'Infants: Operations Manual

A time and leave (absence) management web app for the Casa d'Infants team.
The House context (SPEC-001; specs in `openspec/specs/house-context/` and `openspec/specs/house-membership/`, history in `openspec/changes/archive/2026-10-05-house-context/`)
and staffing (SPEC-002: roles, positions, dated assignments, people and membership management,
director grants) are in place. APs, calendar, vacations and absences are not built yet.

See `README.md` for setup.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, full-stack on Vercel.
  Next 16 renamed `middleware` to `proxy`; auth lives in `src/proxy.ts`.
- **Tailwind v4 + shadcn/ui**, styling. `src/app/globals.css` holds the design tokens.
- **Prisma 7 + Supabase Postgres (EU)**, data. Pooled connection (`:6543`,
  `pgbouncer=true`) at runtime via `DATABASE_URL`; direct connection (`:5432`) for
  migrations via `DIRECT_URL`. Models: `House`, `Employee`, `HouseMembership`, `OccupationalRole`, `Position`,
  `PositionAssignment`, `AccessGrant`, `EmployeeAccountLink`, `OperationReceipt`. The current Supabase
  project (`eu-west-1`) is the **dev** database; production will get its own project.
- **Clerk**, auth, with the Catalan localization (`caES` from `@clerk/localizations`)
  and the shadcn theme (`@clerk/ui/themes`, mapped to our tokens in `globals.css`).
  `src/lib/auth.ts` exposes `requireUser()` and `requireDirector()`, which requires an enabled director
  grant in `access_grants` (managed with `npm run access`); Clerk metadata is not read.
- **react-hook-form + zod**, forms and validation (one schema, both ends).
- **Vitest + Testing Library**, tests (`npm test`).

## Layout

- `src/app/page.tsx`: public landing page.
- `src/app/(app)/`: signed-in area (layout runs `requireUser()`).
  - `[house]/`: House-scoped area. The first URL segment is the active House
    (`/paulo-freire`, `/carme-aymerich`). **Add House-specific features as
    `[house]/<section>/`** and register the section in `src/components/section-nav.tsx`.
  - `dashboard/`: redirects to the last visited House (`active-house` cookie, set in `src/proxy.ts`).
  - `no-access/`: shown to signed-in users without a director grant.
- `src/lib/houses.ts`: the two Houses (keep in sync with the `house_context` migration).
- `src/lib/dates.ts`: `IsoDate` helpers; "today" is always `todayInMadrid()`.
- `src/lib/house-membership.ts`: pure membership rules (current/historical members, transfers).
- `src/lib/staffing.ts`: pure staffing rules and plans. `src/lib/staffing-schemas.ts`: one zod
  schema per form, shared with the server. `src/lib/staffing-messages.ts`: Catalan copy.
- `src/server/houses.ts`: House data, director-only. `src/server/staffing.ts`: director-gated staffing
  reads for pages. `src/server/staffing-queries.ts`: the reads. `src/server/staffing-store.ts`: writes
  through `runOperation` in `src/server/operation.ts` (receipt, lock, plan, write).
  `src/server/access-store.ts`: grant lookup (`isEnabledDirectorGrant`) and operator writes.
- `src/app/(app)/[house]/team/actions.ts`: Server Functions for staffing writes.
- `scripts/`: operator procedures (`access.ts`, `account-link.ts`). `test/db/`: real-database test harness.
- `src/components/top-bar.tsx`: shared contextual top bar. `src/components/house-mark.tsx`: FASI clay-house mark (images in `public/brand/`). `src/components/ui/`: shadcn primitives.

## Access and data rules

- Access requires an enabled director grant (`access_grants`). **Call `requireDirector()` in every
  page, data function and Server Function**, not only in a layout: layouts and pages render in
  parallel. Roles, positions, memberships and account links never grant access.
- Every House-scoped record stores its own `houseId` at creation time. Never derive it from an
  employee's current membership (a transfer must not move history).
- One House at a time per employee is enforced by a Postgres exclusion constraint written by
  hand in the `house_context` migration. Prisma does not show it in `schema.prisma`.
- Staffing invariants live in Postgres too (hand-written in the `staffing` migration): no overlapping
  assignments per employee or position, assignment House = position House, every assignment inside
  one membership (deferred trigger, SQLSTATE CI001), position House and role frozen (CI002). Never
  remove that SQL; prove it with `npm run test:db`.
- Every staffing write goes through `runOperation` with the form's operation ID; two-step writes
  (handover, transfer, end membership) must pass the preview's plan token.

## Design system

Always read `DESIGN.md` before any visual or UI work and do not deviate from it
without explicit user approval. Tokens live in `src/app/globals.css` (light on
`@theme`, dark under `html[data-theme="dark"]`; nothing toggles dark yet). Key
rules enforced without asking:

- Fonts: **Fraunces** (soft serif, SOFT 100) for headings at 20px and above only
  (`h1`, `h2`, `.font-display`); **Figtree** for everything else. Use `tabular-nums`
  for dates, day counts and balances. Both are self-hosted via `next/font`.
- Palette from the clay house: Crema background, Terracota primary, Salvia secondary,
  Espresso text. Leave types use the `leave-*` tokens.
- **Honey (`accent`, `#E9B44C`) means only "waiting for the coordinator's decision"**
  (pending requests, coverage conflicts). Never decoration, success or active states.
- Status via texture, not badges: solid = approved, dashed honey = pending.
- Sick leave is shown only as "Baixa", never with a reason (GDPR Art. 9).
- Errors always carry an icon and text (crimson is close to terracotta).
- No sidebar: top bar on desktop, bottom tab bar on mobile.
- Soft radii: `rounded-2xl` panels, `rounded-xl` cards, `rounded-lg` buttons/inputs,
  `rounded-md` in dense contexts. Cards use `shadow-clay`.
- 150–200ms transitions, purposeful only; filled buttons "press in" on click.

> **TODO before launch: confirm FASI's permission** to use their clay-house image
> (`public/brand/`, rendered by `src/components/house-mark.tsx`), or replace it with a
> commissioned one. See `DESIGN.md` → Illustration.

## Conventions

- **Language:** all user-facing UI copy is in **Catalan** (`<html lang="ca">`).
  All code (identifiers, routes, comments, commit messages, docs) is in **English**.
- Package manager: **npm**. Node 24 (`.nvmrc` if present).
- Conventional commits. Do not use em-dashes in code comments, commit messages, or logs.
- Never commit secrets. Local config lives in `.env.local` (gitignored, read by Next.js and `prisma.config.ts`); `.env.example` is the template.
- GDPR: employee personal data stays in EU infrastructure (Supabase EU). Absence
  data can include health information (sick leave), a special category under
  GDPR Art. 9: store the minimum needed, restrict who can see it, and plan
  retention and erasure from the start.

## Spec-Driven Development (OpenSpec + Superpowers bridge)

This repo uses OpenSpec with the `superpowers-bridge` schema (`openspec/config.yaml`).
Drive non-trivial features through the workflow:

```
/opsx:propose  →  brainstorm → proposal → design → specs → tasks → plan → apply → verify
```

Requires the Superpowers plugin and the `openspec` CLI (see README → Prerequisites).

## Commands

- `npm run dev` — dev server. `npm run build` — production build (needs env vars).
- `npm run lint` — ESLint. `npm run typecheck` — `tsc --noEmit`. `npm test` — Vitest.
- `npm run db:generate | db:push | db:migrate | db:studio` — Prisma.
- `npm run test:db`: real-database tests on a throwaway local Postgres (never Supabase).
- `npm run access -- grant|revoke|list`: director grants. `npm run account-link -- link|unlink`: optional employee/Clerk links.
