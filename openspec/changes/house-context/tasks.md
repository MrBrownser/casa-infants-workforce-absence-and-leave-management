## 1. Houses in code

- [x] 1.1 Add `src/lib/houses.ts` with the `HOUSES` constant, `HouseSlug` type, `isHouseSlug`, `findHouseBySlug` and `DEFAULT_HOUSE_SLUG` (`paulo-freire`), with unit tests
- [x] 1.2 Add pure `switchHousePath(pathname, toSlug)` (swaps the first segment, keeps the section) with unit tests

## 2. Membership domain module

- [x] 2.1 Add `IsoDate` helpers and `todayInMadrid(now?)` in `src/lib/dates.ts`, with tests covering the UTC/Madrid midnight boundary
- [x] 2.2 Add `isActiveOn` and `membersOn`, with tests for the current-team (scenario 4) and historical-membership (scenario 5, EC-002) scenarios
- [x] 2.3 Add `findOverlap`, with tests for same-House and cross-House overlaps and adjacent (non-overlapping) periods
- [x] 2.4 Add `planTransfer` and `TransferError`, with tests for close/open, advance transfer, same-House rejection, start-date rejection and unchanged past periods (scenario 8)

## 3. Database schema and migration

- [x] 3.1 Add `House`, `Employee` and `HouseMembership` models to `prisma/schema.prisma` (`@db.Date` dates, cascade delete from Employee, index on `houseId, startsOn`, comment pointing to the hand-written constraints)
- [x] 3.2 Create the migration with `--create-only`, then hand-edit it: `btree_gist` extension, CHECK `ends_on >= starts_on`, EXCLUDE overlap constraint, INSERT the two Houses
- [x] 3.3 Add a unit test asserting the migration's inserted House slugs and names match `HOUSES`
- [x] 3.4 Apply the migration to the dev database and confirm a follow-up `prisma migrate dev` reports no drift
- [x] 3.5 Manually verify against the dev DB that an overlapping membership insert and an end-before-start row are both rejected (record the output)

## 4. Access gate

- [x] 4.1 Add a pure `isDirector(user)` and `requireDirector()` (redirects non-directors to `/no-access`) in `src/lib/auth.ts`, with unit tests
- [x] 4.2 Add the `NoAccess` component ("Sense accés", icon + text, user button) with a component test
- [x] 4.3 Add `src/app/(app)/no-access/page.tsx` rendering `NoAccess` (it does not call `requireDirector()`)

## 5. Data layer and seed

- [ ] 5.1 Add `src/server/membership-store.ts` (`applyTransfer(db, ...)` and row mappers, client passed in, no auth) and `src/server/houses.ts` (`server-only`: `getHouseBySlug`, `listCurrentMembers(houseId, date)`, `transferEmployee`, each behind `requireDirector()`), with unit tests using a mocked client
- [ ] 5.2 Add the dev seed `prisma/seed.ts` (fictional people: Ana PF to CA from 1 July via the transfer path, Marta CA, plus two per House incl. a CT and an ER as names), register it in `prisma.config.ts`, and make it safe to re-run
- [ ] 5.3 Run the seed against the dev DB

## 6. House context routing

- [ ] 6.1 Add pure `resolveDashboardRedirect(cookieValue)` and `activeHouseCookieUpdate(pathname, currentCookie)` helpers, with unit tests
- [ ] 6.2 Update `src/proxy.ts` to set the `active-house` cookie (httpOnly, lax, secure in prod, 1 year) only when the first segment is a known slug and differs from the current cookie
- [ ] 6.3 Turn `src/app/(app)/dashboard/page.tsx` into a redirect using `resolveDashboardRedirect`
- [ ] 6.4 Add `src/app/(app)/[house]/layout.tsx`: await `params`, `notFound()` for unknown slugs, render the top bar with the switcher and section nav, and the mobile bottom tab bar
- [x] 6.5 Remove the default `TopBar` rendering from `(app)/layout.tsx`, so the `[house]` layout and the no-access page each own their top bar

## 7. House UI components

- [ ] 7.1 Add the `HouseSwitcher` client component (two-option segmented control of links, `aria-current`, secondary selected style, no honey), with a component test
- [ ] 7.2 Add `SectionNav` (desktop pills) and `BottomTabBar` (mobile) for Inici and Equip, with hrefs built from the active slug, with a component test
- [ ] 7.3 Add the `HousePageHeader` (micro uppercase eyebrow with the House name and a Fraunces h1)

## 8. House pages

- [ ] 8.1 Add `src/app/(app)/[house]/page.tsx` (Inici placeholder with the House header)
- [ ] 8.2 Add a `TeamList` component (name plus "Des del" date in Catalan format, `tabular-nums`, clay panel, empty state with the house mark), with component tests for the list and the empty state
- [ ] 8.3 Add `src/app/(app)/[house]/team/page.tsx` wiring `listCurrentMembers(house.id, todayInMadrid())` into `TeamList`

## 9. Docs and verification

- [ ] 9.1 Update `AGENTS.md` (layout: `[house]` routes, `houses.ts`, membership module; the director flag) and `README.md` (seed command, setting the Clerk director flag)
- [ ] 9.2 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; all must pass
- [ ] 9.3 Manual smoke test in the dev server as director and non-director: switching keeps the section, `/dashboard` returns to the last House, an unknown slug gives 404, the non-director sees "Sense accés", and Ana is listed under the correct House for today
