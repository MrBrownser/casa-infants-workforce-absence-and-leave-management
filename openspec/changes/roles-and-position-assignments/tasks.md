## 1. Database test harness

- [x] 1.1 Add `vitest.db.config.ts`, `test/db/global-setup.ts` (ephemeral `initdb --locale=en_US.UTF-8` + `pg_ctl` on a free port, `prisma migrate deploy`, localhost-only guard, teardown) and `test/db/helpers.ts` (`createTestClient`, `resetData`, fixtures); exclude `*.db.test.ts` from the default Vitest config; add `npm run test:db`
- [x] 1.2 Add a first DB test that proves the SPEC-001 membership constraints (overlap and end-before-start rejected by direct SQL) against the harness

## 2. Roles and staffing domain (pure)

- [x] 2.1 Add `src/lib/roles.ts` (`ROLES`, `RoleCode`, `findRole`) with unit tests
- [x] 2.2 Replace `TransferError` with `StaffingError` (all reasons from design D8) in a new `src/lib/staffing.ts`; keep `planTransfer` behaviour and update its tests
- [x] 2.3 Add assignment queries: `occupancyOn`, `teamOn`, `formerMembers`, `ctOccupantsOn`, `findAssignmentConflict`, `findContainingMembership`, with tests (vacancy, future occupant, returning employee once, CT per House, transferred CT)
- [x] 2.4 Add `planHandover` and `planEndAssignment` with tests (replacement, move within House, vacant assign, future-assignment conflict, start on/after D, end before start)
- [x] 2.5 Add `planNewMembership` and `planEndMembership` with tests (overlap, return after gap, crossing assignment closed, future assignment blocks)
- [x] 2.6 Add `planHouseTransfer` with tests (close/open with and without destination position, advance transfer, same House, too early, not ongoing, future source assignment)
- [ ] 2.7 Add `planToken(plan)` in `src/server/plan-token.ts` (stable sha256 of canonical plan JSON) with tests
- [ ] 2.8 Add `src/lib/staffing-schemas.ts` (zod schemas for every form, `IsoDate` and UUID validation, trimmed non-blank names and labels, no permission fields) and `src/lib/staffing-messages.ts` (Catalan copy per reason) with tests

## 3. Schema and migration

- [ ] 3.1 Add Prisma models `OccupationalRole`, `Position`, `PositionAssignment`, `AccessGrant`, `EmployeeAccountLink`, `OperationReceipt` and `Employee.updatedAt`, with comments pointing to the hand-written SQL
- [ ] 3.2 Create the `staffing` migration with `--create-only` and hand-add: role rows (`ON CONFLICT DO NOTHING`), `positions_normalise_and_freeze` trigger, `CHECK` constraints, both assignment EXCLUDE constraints, the deferred containment constraint trigger on both tables (with in-trigger employee lock and SQLSTATE `CI001`); confirm a second `--create-only` produces an empty migration
- [ ] 3.3 Add a migration sync test: roles match `ROLES` and the hand-written blocks are present
- [ ] 3.4 Add DB tests: role idempotency, label uniqueness (trim and case), House/role immutability, House-match FK, direct overlap inserts (employee and position), containment via direct SQL (insert beyond membership, membership shortened, deferred order inside one transaction), employee delete cascades (memberships, assignments, link; positions and grants kept), SPEC-001-shaped data preserved

## 4. Staffing store (Prisma, no auth)

- [ ] 4.1 Add `runOperation` in `src/server/staffing-store.ts` (receipt insert first, sorted employee locks, receipt result update, 23505-on-receipt → already-applied or `operation-conflict`) and the Postgres error mapper, with DB tests for double submit and concurrent duplicates
- [ ] 4.2 Add position operations (`createPosition`, `relabelPosition`) with House scoping, with DB tests
- [ ] 4.3 Add `createEmployee` (with initial membership and optional assignment), `addMembership` and `editEmployeeName` (stale `updatedAt`), with DB tests (AC-001, AC-002, AC-003, AC-024)
- [ ] 4.4 Add `handover` and `endAssignment` with preview/confirm plan tokens, with DB tests (AC-004, AC-005, stale confirm, concurrent race AC-006)
- [ ] 4.5 Add `endMembership` and `transfer` with preview/confirm, replacing `applyTransfer` in `membership-store.ts`, with DB tests (AC-009..AC-013, AC-016, rollback leaves no partial change)
- [ ] 4.6 Add read queries for team views, employee history and position history, scoped by House

## 5. Application access

- [ ] 5.1 Add `src/server/access-store.ts` (`grantDirector`, `revokeDirector`, `listGrants`, `linkAccount`, `unlinkAccount`) with DB tests (duplicate link rejected AC-021, revoke/grant)
- [ ] 5.2 Switch `requireDirector()` to grants (`auth()` userId, per-request cached grant lookup, pure `isEnabledDirectorGrant`), delete the metadata check, and update callers and tests (AC-018, AC-019)
- [ ] 5.3 Add `scripts/access.ts` and `scripts/account-link.ts` (`@clerk/backend` user verification, environment and DB host banner, confirmation or `--yes`) and the npm scripts, with unit tests for argument parsing and the confirmation guard

## 6. Server layer and actions

- [ ] 6.1 Add `src/server/staffing.ts` (`server-only`, `requireDirector()` first, House-scoped reads: `getTeamView`, `getEmployeeHistory`, `getPositionsPage`, `getPositionHistory`) and retire `listCurrentMembers`/`transferEmployee` from `src/server/houses.ts`, with mocked tests asserting the access check precedes any query
- [ ] 6.2 Add Server Functions for every workflow (House from bound slug, zod parse, actor from `requireDirector`, store call, `revalidatePath`, redirect with `?done`), with tests for access-first, tampered IDs and ignored permission fields (AC-020)

## 7. UI

- [ ] 7.1 Add UI primitives in the shadcn style (`Input`, `Label`, `NativeSelect`, `Alert`) themed with project tokens, plus shared form pieces (field error with icon, pending submit button, operation ID hook, confirmation summary, success note)
- [ ] 7.2 Update `switchHousePath` so employee and position pages switch to `/<other>/team` (team, new and positions keep their path), with tests
- [ ] 7.3 Rebuild the Equip page: Persones / Llocs / Membres anteriors views, date control and "not today" banner, actions; component tests (no honey, `Sense lloc assignat`, `Vacant`)
- [ ] 7.4 Add `/[house]/team/new` (Persona nova / Persona existent, optional position) with component tests
- [ ] 7.5 Add the employee history page and its action pages (edit name, assign/change position, end position, add period, end membership with confirmation, transfer with confirmation), with component tests
- [ ] 7.6 Add the positions list (with `Nou lloc`) and the position page (history, relabel, assign/replace with confirmation), with component tests

## 8. Seed, docs and acceptance

- [ ] 8.1 Add `prisma/seed-data.ts` (`SEED_INVENTORY` from the product owner's two lists: 10 fictional people and positions per House) and rebuild `prisma/seed.ts` on the staffing store
- [ ] 8.2 Apply the migration to the dev Supabase DB (reset and reseed only with the user's go-ahead), grant the developer, and record a manual check that a direct overlapping assignment is rejected there
- [ ] 8.3 Update README (test:db prerequisites, operator scripts, first-deploy cutover and recovery, dev reset), AGENTS.md (models, auth, layout) and DESIGN.md if any new pattern needs recording
- [ ] 8.4 Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` and `npm run build`
- [ ] 8.5 Browser acceptance with `/browse` on `npm run build && npm start` at desktop and mobile widths: add/edit, handover, future transfer, date view, former members, a rejected operation, denied access without grant; save screenshots as evidence
