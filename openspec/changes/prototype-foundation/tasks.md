## 1. Domain in code

- [ ] 1.1 Add `src/lib/shifts.ts`: the seven shifts in display order with optional times (night 22:00 to 10:30, weekend and holiday day 10:30 to 22:15, the rest unknown) and a test that keys are unique.
- [ ] 1.2 Add `src/lib/posts.ts`: role codes and Catalan labels (CT = "Corretorn"), the provisional post inventory per House taken from the prototypes, lookup helpers (`postsOf`, `findPost`), and tests (unique keys per House, known role and shift codes, every House has posts).
- [ ] 1.3 Add `src/lib/rules.ts` with the AP and vacation constants (24 h and 5 days APNR, 24 h and 3 days APR, 31 days, minimum 7, at most 4 periods) and `defaultVacationDays(year, startedOn)` with tests (full year 31, 01/07/2026 gives 16, start after the year gives 0).
- [ ] 1.4 Add `src/lib/hours.ts` (`parseHours`, `formatHours` with sign) ported from `public/prototypes/shared/ui.js`, with tests for `3:45`, `3h45`, `3,75`, `3.75`, `8`, `-9:15`, invalid input.

## 2. Database

- [ ] 2.1 Rewrite `prisma/schema.prisma` with `House`, `Person` (`full_name`, `house_id`, `post_key`, `started_on`, `active`, timestamps) and `PersonYear` (`person_id`, `year`, `vacation_days`, `carried_days`, `surplus_hours` numeric).
- [ ] 2.2 Replace `prisma/migrations/20261005092628_house_context` with one initial migration: the two House rows, the partial unique index on `people (house_id, post_key) WHERE active`, unique `(person_id, year)` and CHECKs on the balances; keep the Houses migration test in sync.
- [ ] 2.3 Rewrite `prisma/seed.ts` with the prototypes' fictional people (one per post, a few inactive, some 2026 balances), using the posts inventory.
- [ ] 2.4 Reset the dev database (`prisma migrate reset`), run the seed, and check by hand that a second active person for the same post is rejected; record the result for `verify.md`.

## 3. Remove dated membership

- [ ] 3.1 Delete `src/lib/house-membership.ts`, `src/server/membership-store.ts`, `src/components/team-list.tsx` and their tests; remove `transferEmployee` and `listCurrentMembers` from `src/server/houses.ts`.
- [ ] 3.2 Remove the Inici placeholder page and any reference to `Employee` or `HouseMembership`; typecheck and tests green.

## 4. Navigation

- [ ] 4.1 Change `SECTIONS` in `src/components/section-nav.tsx` to Saldos, Vacances, El mes and Equip with an `available` flag; unavailable sections render as non-links with "aviat" (desktop) and dimmed (mobile); update the tests.
- [ ] 4.2 Make `/[house]` redirect to the first available section after `requireDirector()`; unavailable section URLs return not-found; update the House switcher and `/dashboard` tests if needed.

## 5. People data layer

- [ ] 5.1 Add zod schemas in `src/lib/people-schemas.ts` (add, rename, move, deactivate, reactivate, balances) with Catalan messages and `dd/mm/aaaa` dates; tests.
- [ ] 5.2 Add `src/server/people.ts` (director-gated reads: posts with their active person, inactive people, balances with defaults) and `src/server/people-store.ts` (writes that check House, post key and vacancy, and map the unique-index violation to a Catalan "post taken by X" error).
- [ ] 5.3 Add Server Functions in `src/app/(app)/[house]/team/actions.ts`, each calling `requireDirector()` and resolving the House from the route; tests for non-director, House mismatch, unknown post, occupied post.

## 6. Equip page

- [ ] 6.1 Rebuild `/[house]/team`: posts grouped by shift with person or "Vacant", "Antics membres" list, following `DESIGN.md` and the prototypes' look; component tests.
- [ ] 6.2 Add the forms (react-hook-form + zod): add person to a vacant post, rename, move to another post or House, mark inactive, reactivate; errors with icon and text, values kept on error, undo where the prototypes offer it.
- [ ] 6.3 Add the person details with the opening balances of a year (defaults shown when nothing is stored, hours in both formats, signed surplus).
- [ ] 6.4 Check the page on desktop and mobile (bottom tab bar) in the browser, for both Houses.

## 7. Docs and context for later specs

- [ ] 7.1 Review `docs/domain.md` against the final code (post inventory, shifts, rules) and mark what changed.
- [ ] 7.2 Update `AGENTS.md` (layout, models, data rules, "read `docs/domain.md` and the prototypes before SPEC-004 to SPEC-006"), `README.md` (status, dev database reset) and `openspec/config.yaml` context.
- [ ] 7.3 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` (with env vars) and fix anything red.
