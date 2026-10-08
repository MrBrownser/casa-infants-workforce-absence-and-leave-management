<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Casa d'Infants: Operations Manual

A time and leave (absence) management web app for the Casa d'Infants team.
The House context (SPEC-001; specs in `openspec/specs/house-context/` and `openspec/specs/house-membership/`, history in `openspec/changes/archive/2026-10-05-house-context/`) is in place: two Houses,
House-scoped routes, dated employee membership and a read-only team page. Other domain
features (APs, calendar, vacations, absences) are not built yet.

See `README.md` for setup.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, full-stack on Vercel.
  Next 16 renamed `middleware` to `proxy`; auth lives in `src/proxy.ts`.
- **Tailwind v4 + shadcn/ui**, styling. `src/app/globals.css` holds the design tokens.
- **Prisma 7 + Supabase Postgres (EU)**, data. Pooled connection (`:6543`,
  `pgbouncer=true`) at runtime via `DATABASE_URL`; direct connection (`:5432`) for
  migrations via `DIRECT_URL`. Models: `House`, `Employee`, `HouseMembership`. The current Supabase
  project (`eu-west-1`) is the **dev** database; production will get its own project.
- **Clerk**, auth, with the Catalan localization (`caES` from `@clerk/localizations`)
  and the shadcn theme (`@clerk/ui/themes`, mapped to our tokens in `globals.css`).
  `src/lib/auth.ts` exposes `requireUser()` and the temporary `requireDirector()`; roles arrive with SPEC-002.
- **react-hook-form + zod**, forms and validation (one schema, both ends).
- **Vitest + Testing Library**, tests (`npm test`).

## Layout

- `src/app/page.tsx`: public landing page.
- `src/app/(app)/`: signed-in area (layout runs `requireUser()`).
  - `[house]/`: House-scoped area. The first URL segment is the active House
    (`/paulo-freire`, `/carme-aymerich`). **Add House-specific features as
    `[house]/<section>/`** and register the section in `src/components/section-nav.tsx`.
  - `dashboard/`: redirects to the last visited House (`active-house` cookie, set in `src/proxy.ts`).
  - `no-access/`: shown to signed-in users without the director flag.
- `src/lib/houses.ts`: the two Houses (keep in sync with the `house_context` migration).
- `src/lib/dates.ts`: `IsoDate` helpers; "today" is always `todayInMadrid()`.
- `src/lib/house-membership.ts`: pure membership rules (current/historical members, transfers).
- `src/server/houses.ts`: House data, director-only. `src/server/membership-store.ts`: Prisma
  persistence without auth (seed only; app code uses `houses.ts`).
- `src/components/top-bar.tsx`: shared contextual top bar. `src/components/house-mark.tsx`: FASI clay-house mark (images in `public/brand/`). `src/components/ui/`: shadcn primitives.

## Access and data rules

- Access is temporary: `requireDirector()` checks Clerk `publicMetadata.role === "director"`
  (set by hand in the Clerk dashboard; currently the director and the developer). **Call it in
  every page and data function**, not only in a layout: layouts and pages render in parallel.
- Every House-scoped record stores its own `houseId` at creation time. Never derive it from an
  employee's current membership (a transfer must not move history).
- One House at a time per employee is enforced by a Postgres exclusion constraint written by
  hand in the `house_context` migration. Prisma does not show it in `schema.prisma`.

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
