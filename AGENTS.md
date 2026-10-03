<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Casa d'Infants: Operations Manual

A time and leave (absence) management web app for the Casa d'Infants team.
This repo is currently a bare skeleton: auth, a landing page and a protected
`/dashboard` placeholder. No domain features yet.

See `README.md` for setup.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, full-stack on Vercel.
  Next 16 renamed `middleware` to `proxy`; auth lives in `src/proxy.ts`.
- **Tailwind v4 + shadcn/ui**, styling. `src/app/globals.css` holds the design tokens.
- **Prisma 7 + Supabase Postgres (EU)**, data. Pooled connection (`:6543`,
  `pgbouncer=true`) at runtime via `DATABASE_URL`; direct connection (`:5432`) for
  migrations via `DIRECT_URL`. The schema has no models yet. The current Supabase
  project (`eu-west-1`) is the **dev** database; production will get its own project.
- **Clerk**, auth, with the Catalan localization (`caES` from `@clerk/localizations`)
  and the shadcn theme (`@clerk/ui/themes`, mapped to our tokens in `globals.css`).
  `src/lib/auth.ts` exposes `requireUser()`; roles are not modelled yet.
- **react-hook-form + zod**, forms and validation (one schema, both ends).
- **Vitest + Testing Library**, tests (`npm test`).

## Layout

- `src/app/page.tsx`: public landing page.
- `src/app/(app)/`: signed-in area (layout runs `requireUser()`). Add product routes here.
- `src/components/top-bar.tsx`: shared contextual top bar. `src/components/ui/`: shadcn primitives.

## Design system

Always read `DESIGN.md` before any visual or UI work. It is inherited from a
previous project and is provisional until the Casa d'Infants identity is defined.
Until then, keep following its rules.

> **TODO before launch: replace Proxima Nova.** It comes from Videocation's Typekit
> kit and must not ship with this app. Plan: run `/design-consultation` to define
> the Casa d'Infants identity (see the note at the top of `DESIGN.md`).

Light and dark color tokens live in `src/app/globals.css` (dark applies under
`html[data-theme="dark"]`; nothing toggles it yet).


- Proxima Nova for all UI text; IBM Plex Mono for data/metrics only.
- `#FFE880` accent yellow is reserved exclusively for "needs attention" states.
- Status via card texture (dashed border, desaturation, yellow left-border), not badges.
- No sidebar: contextual top bar + breadcrumb only.
- `rounded-xl` on primary interactive elements; smaller radii inside dense contexts.
- 150–200ms transitions, purposeful only.

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
