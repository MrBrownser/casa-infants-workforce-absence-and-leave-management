<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Casa d'Infants: Operations Manual

A time and leave (absence) management web app for the Casa d'Infants team.
The House context (SPEC-001) and the prototype foundation (SPEC-003, change
`openspec/changes/archive/2026-10-14-prototype-foundation/`; specs in `openspec/specs/`) are in place: two Houses, House-scoped routes, the final
navigation (Saldos, Vacances, El mes, Equip) and the Equip page, where the director manages who
covers each post and each person's opening balances. Dated membership (SPEC-001) was replaced by
people per post. Saldos (SPEC-004, change `openspec/changes/archive/2026-10-15-saldos/`) records APs and shows balances. El mes and Vacances (SPEC-005, SPEC-006) are next: **before working on
them, read `docs/domain.md`, the prototypes in `public/prototypes/` and
`docs/prototypes/director-feedback.md`.**

See `README.md` for setup.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, full-stack on Vercel.
  Next 16 renamed `middleware` to `proxy`; auth lives in `src/proxy.ts`.
- **Tailwind v4 + shadcn/ui**, styling. `src/app/globals.css` holds the design tokens.
  shadcn components come in two flavours: the Drawer uses Base UI (`@base-ui/react`, pinned) and the button uses Radix; prefer the Base UI flavour for new overlay components.
- **Prisma 7 + Supabase Postgres (EU)**, data. Pooled connection (`:6543`,
  `pgbouncer=true`) at runtime via `DATABASE_URL`; direct connection (`:5432`) for
  migrations via `DIRECT_URL`. Models: `House`, `Person`, `PersonYear`, `Ap`. The current Supabase
  project (`eu-west-1`) is the **dev** database; staging (real data) has its own project.
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
    `[house]/<section>/`**: flip the section's `available` flag in `src/lib/sections.ts` (a test
    checks flag and route agree) and set its icon in `src/components/section-nav.tsx`.
    `/[house]` redirects to the first available section.
  - `[house]/team/`: Equip page; `actions.ts` holds its Server Functions.
  - `[house]/saldos/`: Saldos page (the House home); `saldos-content.tsx` is the async child
    that reads the request; `actions.ts` records, deletes and restores APs.
  - `dashboard/`: redirects to the last visited House (`active-house` cookie, set in `src/proxy.ts`).
  - `no-access/`: shown to signed-in users without the director flag.
- `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/lib/sentry.ts`: Sentry error tracking, on only with `NEXT_PUBLIC_SENTRY_DSN`; never send personal data (the scrub filter is tested).
- `src/app/api/health/route.ts`: public health check for the uptime monitor (`SELECT 1`, no data).
- No sign-up route: accounts are invited from the Clerk dashboard (Restricted mode on staging).
- `src/lib/houses.ts`: the two Houses (keep in sync with the `init` migration).
- `src/lib/dates.ts`: `IsoDate` helpers; "today" is always `todayInMadrid()`. *Why:* the Houses
  are in Catalonia and the server runs on UTC, so around midnight the server's date is the wrong day.
- `src/lib/posts.ts`: posts per House and shared posts, weekly schedules (provisional times), week
  alternation. `src/lib/rules.ts`: AP and vacation rules, default opening balances.
  `src/lib/duration.ts`: `H:MM` durations as integer minutes. `src/lib/team.ts`: the Equip team
  view. `src/lib/people-schemas.ts`: zod schemas shared by forms and Server Functions.
- `src/lib/balances.ts`: AP kinds and limits, balances of a person and year, `checkNewAp` (errors
  block, notices warn). `src/lib/holidays.ts`: public holidays per year. `src/lib/ap-schemas.ts`:
  AP form schemas. `src/lib/saldos.ts`: the Saldos view and its labels. *Why:* one implementation
  of the rules for the page, the live form and the server.
- `src/server/people.ts`, `src/server/saldos.ts`: director-gated reads.
  `src/server/people-store.ts`, `src/server/aps-store.ts`: Prisma persistence without auth
  (`createAp` checks the AP limits under a lock on the person row; used by the Server Functions and
  the seed only).
- `scripts/backup/`: encrypted backup and restore of the database (`docs/operations.md`); CI runs the drill.
- `public/prototypes/`: static HTML prototypes with fictional data for the director's feedback
  (not part of the app; see its README).
- `src/components/team/`: Equip UI. `src/components/saldos/`: Saldos UI. `src/components/callout.tsx`: error, warning and success messages with an icon. `src/components/undo-toast.tsx`: "Desfés" toast (portalled, so it stays reachable over an open Sheet). `src/components/field.tsx`, `duration-input.tsx`,
  `date-input.tsx`: form primitives.
- `src/components/sheet.tsx`: the app's panel, wrapping the shadcn Drawer (`src/components/ui/drawer.tsx`, Base UI). App code uses `Sheet`, not the Drawer directly. *Why:* `Sheet` opens from the right on desktop and from the bottom on mobile, and always renders a title.
- `src/components/dialog.tsx`: the app's dialog for short forms, wrapping the shadcn Dialog
  (`src/components/ui/dialog.tsx`, Base UI): centred on desktop, a bottom sheet on mobile. Use
  `Sheet` for detail panels and `Dialog` for short forms, rendered next to the Sheet, not inside it.
- `src/components/top-bar.tsx`: shared contextual top bar. `src/components/house-mark.tsx`: FASI clay-house mark (images in `public/brand/`). `src/components/ui/`: shadcn primitives.

## Access and data rules

- Signed-out requests reaching `requireUser()` / `requireDirector()` are redirected to `/sign-in`,
  never thrown. *Why:* the proxy lets some non-browser requests through, and a throw answers 500.
- Access is temporary: `requireDirector()` checks Clerk `publicMetadata.role === "director"`
  (set by hand in the Clerk dashboard; currently the director and the developer). **Call it in
  every page and data function**, not only in a layout: layouts and pages render in parallel.
- Server Functions call `requireDirector()`, validate the House slug and re-parse their input with
  the form's own zod schema; a person or seat of the other House is rejected. *Why:* a Server
  Function is reachable by a direct POST, whatever the form sent.
- Balances, APs and vacations belong to the **person**, never to a House: moving a person keeps
  them. Records that belong to a House (rota changes, day notes) store their own `house_id`.
  *Why:* the product owner decided each person keeps their APs and vacations whatever House they
  are in.
- A person covers one seat of one post (`house_id` null for the shared posts PDG and PSI). One
  active person per seat is enforced by two partial unique indexes written by hand in the `init`
  migration, with CHECKs on seats and balances. Prisma does not show them in `schema.prisma`.
  *Why:* the database itself refuses a second active person on a seat, even when two writes race.
- **Every table has Row Level Security enabled, with no policies.** A migration that creates a
  table must enable it (`src/lib/rls-migration.test.ts` checks). *Why:* Supabase's Data API
  exposes the `public` schema to its anon key; the app connects as the table owner, which RLS
  does not restrict.
- The dev seed runs only with `ALLOW_DEV_SEED=1` on the command line (never in `.env.local`).
- Posts, schedules and rules are code: changing them is a code change, not data. *Why:* the
  product owner decided posts are fixed and only the people change; a constant is testable and
  versioned, with no screens or migrations for data that does not change.

## Next.js rules

Next 16 changed the cache APIs, so habits from older Next are often wrong here. Check
`node_modules/next/dist/docs/` when in doubt.

- **After a write, `revalidatePath` every route that shows the data** (as `team/actions.ts` does),
  and do not follow the Server Function with `router.refresh()` on the client. *Why:* the Server
  Function's response already carries the re-rendered page; a client refresh renders the route a
  second time.
- **`refresh()`** (from `next/cache`, Server Functions only) re-renders the current page without
  invalidating anything. `updateTag(tag)` only affects `"use cache"` reads, and this app has none.
- **Never call `revalidateTag(tag)` with one argument.** *Why:* deprecated in Next 16 and a type
  error; outside a Server Function use `revalidateTag(tag, 'max')`.
- **Write new pages so they survive Cache Components.** `cacheComponents` is off in
  `next.config.ts`, and turning it on is an app-wide decision. Keep the page frame (heading,
  static copy) in the page and put request-time reads (the gated data functions, `params`,
  `searchParams`, `cookies()`, `headers()`) in an async child inside `<Suspense>`, close to where
  they are used. No route segment config (`export const dynamic`, `revalidate`, `fetchCache`).
  *Why:* with the flag on, segment configs error and a request-time read with no `<Suspense>`
  above it fails the build (`02-guides/streaming.md`, `02-guides/migrating-to-cache-components.md`).
  With the flag off the same shape costs nothing and shows the frame before slow balance queries.

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
- **No Tailwind `dark:` utilities.** Every colour is a token, which gets its dark value from
  `html[data-theme="dark"]`. *Why:* there is no `@custom-variant dark`, so `dark:` follows the
  operating system (`prefers-color-scheme`), not the app's theme.
- **Honey (`accent`, `#E9B44C`) means only "waiting for the coordinator's decision"**
  (pending requests, coverage conflicts). Never decoration, success or active states. *Why:* it
  keeps the pending queue unmistakable for the coordinator.
- Status via texture, not badges: solid = approved, dashed honey = pending.
- Sick leave is shown only as "Baixa", never with a reason (GDPR Art. 9).
- Errors always carry an icon and text (crimson is close to terracotta).
- No sidebar: top bar on desktop, bottom tab bar on mobile. *Why:* the app has four sections,
  too few to justify a sidebar.
- Soft radii: `rounded-2xl` panels, `rounded-xl` cards, `rounded-lg` buttons/inputs,
  `rounded-md` in dense contexts. Cards use `shadow-clay`.
- 150–200ms transitions, purposeful only; filled buttons "press in" on click.

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

**Pick the weight of the process by the change, and keep `openspec/specs/` true either way:**

- **Full workflow** (`/opsx:propose`): new screens or sections, domain rules, data model changes,
  open questions for the director, anything that needs a design.
- **Light change**: small, well-understood changes that still alter what the app does (fixes,
  access rules, operations). `openspec new change <name> --schema spec-driven`, write only
  `proposal.md` (why, what, non-goals), the spec deltas and a short `tasks.md`; implement with
  tests; `openspec validate <name>`; archive it in the same PR (`openspec archive <name> -y`) so
  the deltas merge into `openspec/specs/`. Example: `production-readiness`.
- **No OpenSpec**: no behaviour change (refactors, docs, dependency bumps, test-only work).

*Why:* the specs are the record of how the app behaves; a change that skips them leaves the next
spec's author reading stale requirements.

## Commands

- `npm run dev` — dev server. `npm run build` — production build (needs env vars).
- `npm run lint` — ESLint. `npm run typecheck` — `tsc --noEmit`. `npm test` — Vitest.
- `npm run db:generate | db:push | db:migrate | db:studio` — Prisma.
- **Branches: PRs target `dev`** (the default branch, deployed to `casa-infants-dev` with fictional
  data). `main` is **staging, with real data**: it only receives promotions from `dev` (a PR
  `dev` → `main`, merged with a merge commit, never squashed). Each deploy's build
  (`scripts/vercel-build.sh`) applies pending migrations to that environment's database. See
  README → Deployment.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, a migrations check and the backup
  and restore drill on every PR. **Migrations must be backward compatible** (expand, then contract in a later
  PR); see README → Migrations.
