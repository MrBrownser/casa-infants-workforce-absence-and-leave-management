## 1. Domain in code

- [x] 1.1 Add `src/lib/posts.ts`: role codes and Catalan labels (ET = Educadora de tardes, CT = Corretorn), the shared posts `pdg` and `psi` (no House, with the House of each weekday) and the seven posts per House (`er`, `tfm`, `tft`, `et`, `ecs`, `en` with 2 seats, `ct`) with their weekly schedules from design D3 marked provisional, lookup helpers (`postsOf`, `sharedPosts`, `findPost`), and tests (order, unique keys, seats, valid `HH:MM` ranges, CT without schedule, shared posts without House).
- [x] 1.2 Add schedule helpers in `src/lib/posts.ts` (compact weekly summary such as "dl–dv 07:30–15:00", night seat for a given week (counted from a fixed Monday, see design D3), weekday posts off on holidays) with tests.
- [x] 1.3 Add `src/lib/rules.ts` with the AP and vacation constants (24 h and 5 days APNR, 24 h and 3 days APR, 31 days, minimum 7, at most 4 periods) and `defaultVacationDays(year, startedOn)` with tests (full year 31, 01/07/2026 gives 16, start after the year gives 0).
- [x] 1.4 Add `src/lib/duration.ts` (`parseDuration('H:MM')` to minutes, `formatDuration(minutes, { signed })` as `3 h 45 min`) with tests (`3:45`, `0:30`, `55:30`, rejects `9:75`, letters and empty).

## 2. Database

- [x] 2.1 Rewrite `prisma/schema.prisma` with `House`, `Person` (`full_name`, `house_id` nullable for shared posts, `post_key`, `seat`, `started_on`, `active`, timestamps) and `PersonYear` (`person_id`, `year`, `vacation_days`, `carried_days`, `surplus_minutes`).
- [x] 2.2 Replace `prisma/migrations/20261005092628_house_context` with one initial migration: the two House rows, the two partial unique indexes on `people` (per House and seat, and per seat for shared posts with no House), unique `(person_id, year)` and CHECKs on the balances; keep the Houses migration test in sync.
- [x] 2.3 Rewrite `prisma/seed.ts` from the validated list (fictional names, two people on each night post) plus a few inactive people and some 2026 balances.
- [x] 2.4 Reset the dev database (`prisma migrate reset`), run the seed, and check by hand that a second active person for the same seat (of a House post and of a shared post) is rejected; record the result for `verify.md`. *(Done on Supabase dev and a local Postgres, see `db-check.md`.)*

## 3. Remove dated membership

- [x] 3.1 Delete `src/lib/house-membership.ts`, `src/server/membership-store.ts`, `src/components/team-list.tsx` and their tests; remove `transferEmployee` and `listCurrentMembers` from `src/server/houses.ts`.
- [x] 3.2 Remove the Inici placeholder page and any reference to `Employee` or `HouseMembership`; typecheck and tests green.

## 4. Navigation

- [x] 4.1 Change `SECTIONS` in `src/lib/sections.ts` (rendered by `src/components/section-nav.tsx`) to Saldos, Vacances, El mes and Equip with an `available` flag; unavailable sections render as non-links with "aviat" (desktop) and dimmed (mobile); update the tests.
- [x] 4.2 Make `/[house]` redirect to the first available section after `requireDirector()`; unavailable section URLs return not-found; update the House switcher and `/dashboard` tests if needed.

## 5. People data layer

- [x] 5.1 Add zod schemas in `src/lib/people-schemas.ts` (add, rename, move, deactivate, reactivate, balances with `H:MM` and sign) with Catalan messages and `dd/mm/aaaa` dates; tests.
- [x] 5.2 Add `src/server/people.ts` (director-gated reads: posts with the people of each seat, inactive people, balances with defaults) and `src/server/people-store.ts` (writes that check House, post key, seat and vacancy, and map the unique-index violation to a Catalan "seat taken by X" error).
- [x] 5.3 Add Server Functions in `src/app/(app)/[house]/team/actions.ts`, each calling `requireDirector()` and resolving the House from the route; tests for non-director, House mismatch, unknown post or seat, occupied seat.

## 6. Equip page

- [x] 6.1 Add the `DurationInput` component (`H:MM` mask, optional + / − choice, error with icon) with component tests.
- [x] 6.2 Rebuild `/[house]/team`: the shared posts first ("Compartits entre les dues cases", same on both Houses), then the House's posts in inventory order with role label, compact weekly schedule and the people of each seat or "Vacant" (night post with two people and alternating weeks), plus "Antics membres"; following `DESIGN.md` and the prototypes' look; component tests.
- [x] 6.3 Add the forms (react-hook-form + zod): add a person to a vacant seat, rename, move to a vacant seat of another post or House, mark inactive, reactivate; errors with icon and text, values kept on error.
- [x] 6.4 Add the person details with the opening balances of a year (defaults shown when nothing is stored, duration input for the surplus).
- [x] 6.5 Check the page on desktop and mobile (bottom tab bar) in the browser, for both Houses. *(Done, see `db-check.md`.)*

## 7. Docs and context for later specs

- [x] 7.1 Review `docs/domain.md` against the final code (posts, schedules, rules) and mark what changed.
- [x] 7.2 Update `AGENTS.md` (layout, models, data rules, "read `docs/domain.md` and the prototypes before SPEC-004 to SPEC-006"), `README.md` (status, dev database reset) and `openspec/config.yaml` context.
- [x] 7.3 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` (with env vars) and fix anything red.
