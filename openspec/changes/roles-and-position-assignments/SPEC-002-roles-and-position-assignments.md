# SPEC-002 - Roles and Position Assignments

**Status:** READY FOR REVIEW  
**Phase:** Foundation, before AP management  
**Dependencies:** SPEC-001 (implemented)  
**Prepared:** 2026-10-05

## 1. Goal

Let the director maintain the people and staffing positions of both Houses without database edits: add an employee, assign a dated position, replace an occupant, inspect history and record a House transfer without losing historical attribution.

Establish a staffing foundation for AP and later scheduling while separating four concepts: employee identity, House membership, position occupancy and application permissions. A CT or ER assignment must not accidentally grant access to the application.

This is a proposed product specification. Requirements below describe the intended next increment, not existing capabilities. Section 10 identifies assumptions requiring review; this document is not approved or ready for implementation until those choices are resolved.

## 2. Baseline and Scope

### 2.1 Reuse SPEC-001

Already available: two permanent House contexts; minimal `Employee`; inclusive dated `HouseMembership`; database-enforced non-overlap; atomic transfer logic; current-team read-only UI; Europe/Madrid date helpers; House URLs; temporary Clerk director gate.

Historical membership and transfers have logic but no management UI. SPEC-002 extends these capabilities. It must not introduce a second employee identity or replace membership history with a current-House field.

### 2.2 In scope

- Known occupational role catalogue and configurable positions in each House.
- Dated primary position assignments, vacancies and successive occupants.
- CT association through a normal House position with role CT.
- Employee add/edit with minimal data; adding and ending membership, and House transfer forms.
- Current, historical and future staffing views, including former members.
- Explicit director application grants replacing the temporary flag.
- Optional employee-to-account linking, independent of permissions.
- Migration preserving existing employees and memberships; validation and access tests.

### 2.3 Non-goals

- Expected schedules, rotations, working-hour percentages, overnight shifts or calendars.
- AP entitlements, requests, approval, balances or migration of AP spreadsheets.
- Absences, reasons for sick leave, vacations, payroll or annual accounting.
- Temporary daily/partial coverage, CT coverage calendar or automatic replacement detection.
- ER delegation or staff self-service access, invitations, permission-editor UI.
- Importing real employee names or inventing a real position inventory from development data.
- Editing/cancelling completed history, general correction workflows or employee deletion UI.

## 3. Domain Concepts

### 3.1 Occupational role

A reusable category of work. Stable code and Catalan label; shared by both Houses. Initial catalogue comes from the existing domain glossary:

| Code | UI label |
|---|---|
| PDG | Pedagoga |
| PSI | Psicòloga |
| ER | Educadora referent |
| TFM | Treballadora familiar de matins |
| TFT | Treballadora familiar de tardes |
| ET | Educadora de tardes |
| ECS | Educadora de cap de setmana |
| EN | Educadora de nit |
| CT | Corretor |

These categories have no schedule or permission semantics in this spec. The catalogue does not prove which positions exist in either House. The director's application role is defined separately; this spec does not invent a House-specific director staffing slot.

### 3.2 Position

A stable staffing slot with an ID, immutable House and role, and a director-entered label unique within its House (trimmed and case-insensitive). Multiple positions may have the same role, including CT, provided each has a distinct label. The actual count is not inferred.

A position exists independently of its occupants. Changing a person's name or replacing an occupant must not recreate the position. Its label may be corrected; its House and role must not be mutated to repurpose historical assignments. Deletion/retirement workflows are deferred.

### 3.3 Position assignment

A period containing employee ID, position ID, explicit House ID, inclusive start date and optional inclusive end date. The House must match the position and is stored at creation; it is never inferred from the employee's current membership.

Proposed initial cardinality: at most one primary position per employee on a date and at most one occupant per position on a date. An employee may have membership without an assignment. A position with no assignment on the selected date is vacant; future occupancy does not fill it today.

The assignment's entire interval must fit within one membership period for the same employee and House. Open-ended assignment requires open-ended membership. Changing position inside a House does not change membership.

### 3.4 Substitute and coverage

A substitute is an ordinary employee with their own ID and membership. A successive replacement may occupy the same stable position for a bounded period. A returning employee can have a later assignment to it.

This does not model a titular occupant remaining assigned while another person covers their absence. Simultaneous nominal/acting occupants, partial shifts and exceptional cross-House work belong to future coverage specs. If simultaneous occupancy is needed now, review decision D2 must change before implementation.

### 3.5 Application access and account link

Authentication stays in Clerk. Proposed authorisation is a server-owned application grant keyed to the immutable Clerk user ID, with role `director` and an enabled/revoked state, stored in the application's EU database. Enabled directors can manage both Houses. Missing or revoked grant denies access even if the old Clerk metadata still says `director`.

An optional account link associates at most one employee with at most one Clerk user ID. Linking does not grant access, and a grant does not require a House membership or staffing position. This allows the director to manage both Houses without inventing duplicate employees or memberships. Grant provisioning and account linking are trusted operator procedures in this increment, not employee-profile fields editable from an untrusted request.

## 4. Functional Requirements

### FR-001 - Role catalogue and positions

The system shall install the nine role codes idempotently and let the director list/create positions in the active House and edit their labels. It shall validate unique House-local labels and immutable role/House. It shall not create a position for every role automatically or assume matching inventories across Houses.

### FR-002 - Employee creation and name editing

The director shall create an employee with a non-blank trimmed full name and an initial membership in the active House, starting on a selected calendar date with optional end date. An optional initial position assignment may be created in the same transaction using that membership interval. Failure shall leave none of the new records persisted.

Names are not unique identifiers: two people may share a name. The system shall not merge, link or reject employees solely because names match. The director may correct a name without replacing the employee ID or changing membership/assignment periods. No contact, identity-document, health or payroll fields are introduced.

### FR-003 - Membership lifecycle

The director shall inspect membership history, add a non-overlapping period for an existing employee with a gap, and end an ongoing membership on a date on or after its start. A new membership may be past, current or future, but must not rewrite an existing completed period.

Ending a membership shall preview and atomically close any position assignment crossing that end date. It shall reject the operation if an assignment begins after the proposed membership end; it must not silently delete future plans. Invalid, overlapping or stale changes leave all records unchanged. Ending membership is not employee erasure and does not itself revoke application access.

### FR-004 - Dated position assignment

The director shall assign an existing employee to a position with dates, end an ongoing assignment, and plan a replacement. Dates must meet the membership-containment, employee and position non-overlap rules. Ending an assignment may not put its end before its start. Previously closed assignments cannot be edited through these workflows.

For a handover starting on date D, an ongoing source assignment closes on D minus one day and a new assignment starts on D, atomically. Replacing the occupant of a position requires confirming the outgoing and incoming employees and their dates. Moving one employee to another position in the same House follows the same boundary rule and leaves membership untouched. A conflict with another future assignment rejects the whole handover; it does not overwrite that future record.

### FR-005 - Current team and staffing by date

`/<house>/team` shall retain the current team as its default. It shall show each current member's name, membership start and primary position or `Sense lloc assignat`. The position view shall show all configured slots, including `Vacant` when unoccupied on the selected date.

The director shall select a past/future date to see members and occupants for that date, and view `Membres anteriors`: employees with a completed membership in the active House who are not members today. Individual history shall show dated membership and assignments, including future periods, with their own Houses. An employee who returns to a House shall appear once in the selected-date team, with all periods in history.

### FR-006 - House transfer

The director shall select an employee in the active House, a different destination House and an effective date. The form shall preview the source end date, destination start, affected assignment and optional destination position before confirmation.

The operation shall reuse SPEC-001's transfer rules: close the source ongoing membership on D minus one day and create the destination membership from D. It shall also close a source assignment crossing D on D minus one day and optionally create a destination assignment starting D, all in one transaction. Closed historical periods and unrelated records remain unchanged. Destination without a position is valid and displayed as `Sense lloc assignat`.

Reject same-House transfer, D on/before the source membership start, membership overlap, a source assignment starting on/after D that would need cancellation, incompatible destination occupancy, or stale source state. Show a Catalan explanation and leave no partial changes. The source must be an ongoing membership of the selected House; a previously scheduled transfer must not cause a second submit to transfer the newly created destination membership. General rescheduling/cancellation is deferred.

The team and CT lists shall change only on the effective Europe/Madrid date, even if the transfer is entered earlier. For employee-specific URLs, House switching shall return to the other House's team list rather than reuse an employee ID without a relationship to that House.

### FR-007 - CT per House

The system shall derive a House's CT occupants for a date from its CT positions and valid assignments. Vacant CT positions remain visible. An employee transferred out ceases to be the old House's CT from that transfer date. CT is neither a duplicate employee entity nor a permission role. This does not assign shifts or exceptional cross-House coverage.

### FR-008 - Explicit authorisation

Every protected page, server data function and mutation shall independently require an enabled director grant before reading or modifying staffing data. Layout checks and hidden buttons are insufficient. An authenticated user without a grant shall receive `Sense accés`; unauthenticated users use the sign-in flow.

Occupational role changes, account linking and membership transfers shall never grant access. The browser must not be able to create grants or overwrite account links through employee forms. Changes to grants shall be honoured on the next request; no process-wide permission cache may keep a revoked grant effective.

### FR-009 - House and employee validation

Server operations shall resolve the House from the validated route and verify submitted positions, memberships and assignments belong to that operation's House. The transfer target is validated separately. A tampered cookie or hidden ID must not change which record is modified. An employee detail read must have a membership relationship with that House; an explicit new-membership workflow may select an existing employee across Houses because the director manages both.

### FR-010 - Account-link provisioning

A trusted operator procedure shall link/unlink an employee using a verified immutable Clerk user ID. Uniqueness prevents one account linking to two employees or one employee to two accounts. Email/name matching must not create links automatically. Link/unlink shall neither erase staffing history nor grant/revoke a director permission implicitly.

### FR-011 - Validation and concurrency

Calendar dates must be valid, interval ends must not precede starts, and all writes must revalidate current database state. Overlap protection shall work for direct writes and concurrent requests, not only client validation. Membership-containment and transfer/assignment updates must be protected transactionally so a concurrent assignment cannot survive outside its membership.

Stale edits must request a reload rather than silently overwrite newer records. Double submissions must not create duplicate employees, memberships or assignments; create workflows shall use a stable submission identifier or equivalent server-side duplicate prevention. Constraint and contention failures shall become friendly Catalan errors, without exposing SQL or personal data in logs.

## 5. Business Rules and Invariants

| ID | Rule |
|---|---|
| BR-001 | Identity, membership, position occupancy and application access are independent concepts. |
| BR-002 | All business dates use Europe/Madrid; intervals include both boundaries and may be open-ended. |
| BR-003 | Membership overlap is prohibited as in SPEC-001; assignment cannot extend beyond its matching membership. |
| BR-004 | Proposed: one primary assignment per employee and one occupant per position on any date. Vacancies and unassigned employees are valid. |
| BR-005 | A position and each assignment keep their own House; transfers never move historical assignments. |
| BR-006 | Closing a source and opening a destination is atomic, including affected memberships and assignments. |
| BR-007 | Temporary cross-House work never implicitly changes membership or primary assignment. |
| BR-008 | CT has no fixed schedule in this increment; CT and ER roles give no platform permission. |
| BR-009 | Only enabled directors manage staffing; account linkage alone authorises nothing. |
| BR-010 | Names are not identity keys; the same employee ID survives position changes and transfers. |

## 6. Acceptance Scenarios

| ID | Given / When | Expected result |
|---|---|---|
| AC-001 | Director creates Ana in Paulo Freire from 1 January, with an available ER position. | One employee, one membership and one contained assignment are committed together. |
| AC-002 | Initial position is occupied or dates are invalid. | Creation fails clearly; no orphan employee/membership/assignment is created. |
| AC-003 | Two distinct employees have the same full name. | Both may exist with distinct IDs; neither is merged or linked automatically. |
| AC-004 | Occupant leaves a position on 30 June and replacement starts 1 July. | Same position ID; old occupant appears on 30 June and replacement on 1 July; history remains. |
| AC-005 | Replacement starts on 30 June while existing assignment includes 30 June. | Overlap rejected. Adjacent intervals ending 30 June/starting 1 July are valid. |
| AC-006 | Concurrent requests assign two people to the same position, or one person to two positions. | At most one conflicting write succeeds; loser sees a conflict; direct conflicting database insert also fails. |
| AC-007 | Assignment's House differs from membership, or assignment extends beyond its end. | Rejected, including open assignment on finite membership. No partial changes. |
| AC-008 | A position has only a future occupant. | It is vacant today and occupied on the future start date. Employee without a position is still in the team. |
| AC-009 | On 10 May Ana's transfer from Paulo Freire to Carme Aymerich is recorded for 1 July, with a destination position. | Source membership/assignment end 30 June; destination membership/assignment start 1 July; current May team stays unchanged. |
| AC-010 | Destination position is occupied, source changed, date is too early, or destination is the same House. | Entire transfer fails; original membership and assignment remain unchanged. |
| AC-011 | Ana transfers to Carme Aymerich without a destination position. | Transfer succeeds; Ana is unassigned in Carme Aymerich from D and absent from Paulo Freire's current team. |
| AC-012 | Transfer form is submitted twice using the same operation identity. | Only one transfer exists; the second submission cannot transfer the destination membership again. |
| AC-013 | A transfer would invalidate a future source-House assignment. | Explicit conflict; no silent cancellation, deletion or partial transfer. |
| AC-014 | Director views a pre-transfer date and then a post-transfer date. | Membership and assignment resolve from their dated records; former membership remains discoverable. |
| AC-015 | It is 30 June 23:30 UTC in summer, already 1 July in Madrid. | The transfer and new CT/position lists are effective. A winter boundary test uses Madrid's winter offset. |
| AC-016 | Director ends membership while a position assignment crosses its end. | Preview shows both closures; both end together. A future assignment starting after the end blocks the operation. |
| AC-017 | An employee is temporarily considered for future coverage in the other House. | SPEC-002 creates no extra membership or duplicate identity; it does not pretend to record coverage. |
| AC-018 | Authenticated ER, CT or linked employee has no enabled director grant. | Protected page, direct read and direct write deny access before returning staffing data. |
| AC-019 | User has stale Clerk `director` metadata but no enabled application grant. | Access denied. Revoking an enabled grant denies the next protected request. |
| AC-020 | Actor tampers with House cookie, position/employee IDs or permission fields in an employee form. | Server scopes/validates the operation, rejects mismatched records and cannot create a grant. |
| AC-021 | Trusted operator links an account already linked elsewhere. | Duplicate link rejected; staffing history and permissions remain unchanged. |
| AC-022 | Existing SPEC-001 data is migrated without position assignments. | IDs, names, membership dates and constraints preserved; employees display as unassigned; no invented real occupants. |
| AC-023 | Create or handover submission is retried after an uncertain network response. | No duplicate records; successful prior result or a clear already-applied result is returned. |
| AC-024 | Member returns after a gap or changes position within the same House. | Original ID retained; no membership in the gap; position handover does not create a House transfer. |

## 7. Interaction and Error Behaviour

Extend `Equip` under `/<house>/team`; English route segments, Catalan labels and validation copy. Keep the House visible throughout forms and confirmations. Reuse the repository's `DESIGN.md`, shared top bar and mobile navigation.

Actions include `Afegir persona`, `Editar nom`, `Llocs de treball`, `Assignar lloc`, `Traslladar`, `Historial` and `Membres anteriors`. A date selection clearly distinguishes the chosen date from today's team. Empty lists and vacancies are normal informational states. Honey must not mark vacancies, selection or future assignments; it remains reserved for decisions pending the coordinator.

Every error includes text and an icon; fields retain their values after validation failure. Transfer/handover confirmation states the people, Houses/positions and dates affected. Cancel writes nothing. Buttons prevent accidental repeat submission while server safeguards enforce correctness. Forms must work with keyboard navigation, labelled inputs and mobile layouts.

## 8. Migration, Access Cutover and Personal Data

1. Extend the existing schema without rebuilding House, Employee or HouseMembership or dropping the handwritten membership constraints. Add role, position, assignment, grant and optional account-link structures with required uniqueness, referential and period protections.
2. Seed the known role catalogue idempotently. Leave actual position inventory and occupants to explicit entry. Use fictional data only for development/test fixtures.
3. Provide a trusted, repeatable provisioning procedure for verified director account IDs in the correct Clerk environment. Do not bulk-convert every existing metadata flag, especially the developer's dev flag, into production grants.
4. Provision and verify the intended director grant before switching `requireDirector()` to the grant source. Once switched, no fallback to metadata is allowed. Test allowed and denied access before operational use; the procedure must explain recovery of missing director access through trusted provisioning.
5. Keep optional account linking independent of this cutover. Do not require every employee to have an account or make the director a member of two Houses.

New personal data consists of occupational assignment history and optional authentication identifiers, plus minimal operational timestamps/actor references where needed for traceability. Store staffing data in the existing EU database and do not copy it into Clerk metadata. Do not collect health, contact, contract or payroll data in this increment. This is a product data-minimisation requirement, not a completed legal/privacy assessment.

Ending membership preserves history and does not perform erasure. Do not invent a retention duration. Before the first operational deliverable, the privacy review must define retention and erasure/anonymisation, including backups and future dependent business records. Preserve SPEC-001's existing employee-to-membership cascade; employee-linked assignment/link records must also be handled coherently by a controlled erasure procedure, without deleting positions or granting/revoking application access as an accidental cascade. No ordinary employee deletion button is introduced.

## 9. Verification and Definition of Done

- Acceptance scenarios pass with unit/domain tests for intervals and Madrid boundaries, integration tests on an isolated database for real constraints, rollback and concurrency, and server-level authorisation tests.
- Database tests cover direct overlap insertion, containment under concurrent membership/assignment edits, double submission and all-or-nothing transfer. Static inspection of migration text is insufficient.
- End-to-end or recorded browser acceptance covers director add/edit, position handover, future transfer, historical view, former members and rejected operations on desktop and mobile. Retain SPEC-001 redirect, House switch, denied-access and Catalan 404 behaviour.
- Migration is verified against existing fictional SPEC-001 data; IDs/history remain intact and director access cutover is tested without relying on the legacy flag.
- All new personal data, access procedures and the outstanding privacy review are documented; no health or unnecessary identity fields are added.
- Product owner reviews decisions D1-D4, and the implementation's OpenSpec artifacts capture accepted choices. Completion must distinguish implemented behaviour from deferred coverage, schedules and delegation.

## 10. Proposed Decisions and Review Points

| ID | Proposed choice | Reason / review consequence |
|---|---|---|
| D1 | Separate reusable role, House position and dated occupant. Configure actual positions manually; permit multiple slots of a role. | Supports vacancy and turnover without inventing House inventories. Confirm actual inventory during setup. |
| D2 | At most one primary position per employee and one occupant per position at a time. Successive substitutes use dated periods. | Small foundation for later schedules. **Review before implementation:** if simultaneous titular/acting occupancy or split positions are needed now, expand the assignment model and AC-006 rather than silently losing information. |
| D3 | Keep director-only access; use application grants and optional operator-managed account links. ER substitution grants no access. | Preserves the confirmed first-release audience while replacing the temporary flag. Any delegated ER access requires explicit scope, dates and revocation rules in a separate change. |
| D4 | Include employee/membership management and historical UI now; defer general historical correction and scheduled-transfer cancellation. | Makes SPEC-001 usable without manual data edits while keeping this increment focused. Existing future plans cause explicit conflicts rather than being overwritten. Confirm that this operational limit is acceptable. |

An alternative of storing only a current role on Employee was rejected because it loses position identity, vacancies and historical role changes. A full scheduling/coverage/delegation system is deferred because it would delay the AP milestone and requires unresolved business rules.

## 11. Traceability and Next Handoff

Sources reviewed: the local SPEC-001 and context documents; repository `spec-delta.md`, canonical House specs, schema, membership/auth implementation and the archived verification report dated 2026-10-05. The original spreadsheet and 2019 instruction were not re-audited for this foundation spec; no new schedule or legal rule is inferred from them.

| Input / remaining item | SPEC-002 coverage |
|---|---|
| SPEC-001 minimal employee and existing memberships | Baseline 2.1; FR-002/003; migration AC-022 |
| Delta: roles, positions and House CT association | FR-001/004/007 |
| Delta: employee add/edit and transfer form with overlap errors | FR-002/003/006/011 |
| Delta: historical membership/former members UI | FR-005; AC-014/024 |
| Delta: account link and real permissions replacing temporary flag | FR-008/010; section 8 |
| Delta: ER supervision and cross-House work | Preserved as invariant; delegation/coverage deferred, no implicit access |
| Delta: retention and engineering verification gaps | Sections 8/9; context open questions |

After product review, feed this spec into a new OpenSpec change in the application repository. That change must explicitly modify the existing director-access requirement and extend membership/team requirements; it must not silently claim the canonical as-built specs already implement SPEC-002. Produce the technical design and implementation plan there before coding. SPEC-101 can then build on stable employee IDs and House ownership; role-based AP incompatibilities remain for the relevant AP validation spec.
