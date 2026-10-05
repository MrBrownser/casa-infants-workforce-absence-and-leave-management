## ADDED Requirements

### Requirement: Occupational role catalogue
The system SHALL provide exactly these occupational roles, shared by both Houses, installed by the database migration idempotently in every environment: PDG (Pedagoga), PSI (Psicòloga), ER (Educadora referent), TFM (Treballadora familiar de matins), TFT (Treballadora familiar de tardes), ET (Educadora de tardes), ECS (Educadora de cap de setmana), EN (Educadora de nit), CT (Corretor). Roles MUST NOT carry schedule or permission semantics, and the role codes in code MUST match the rows inserted by the migration.

#### Scenario: Roles exist after migration
- **WHEN** the migrations have been applied to an empty database
- **THEN** the role catalogue contains the nine codes with their Catalan labels

#### Scenario: Re-running the role installation
- **WHEN** the role installation runs on a database that already contains the roles
- **THEN** no duplicate role is created and no error is raised

#### Scenario: Code and database agree on roles
- **WHEN** the application lists roles
- **THEN** the codes and labels in code match the rows inserted by the migration

### Requirement: Positions per House
The director SHALL be able to list positions of the active House and create a position with a role and a label. A position's label MUST be unique within its House, compared after trimming and ignoring case, and MAY repeat in the other House. Several positions MAY share a role, including CT. The system MUST NOT create positions automatically. A position's House and role MUST NOT change after creation; only its label MAY be corrected. The database SHALL enforce label uniqueness and the immutability of House and role independently of the application.

#### Scenario: Two positions with the same role
- **WHEN** the director creates "ER 1" and "ER 2", both with role ER, in Paulo Freire
- **THEN** both positions exist in Paulo Freire with distinct IDs

#### Scenario: Label taken in the same House
- **WHEN** Paulo Freire has a position "CT nit" and the director creates " ct NIT " in Paulo Freire
- **THEN** the creation is rejected with a Catalan message that the label is already used, and no position is created

#### Scenario: Same label in the other House
- **WHEN** Paulo Freire has "CT nit" and the director creates "CT nit" in Carme Aymerich
- **THEN** the position is created in Carme Aymerich

#### Scenario: Relabelling keeps the position
- **WHEN** the director renames position "ER 1" to "ER matins"
- **THEN** the position keeps its ID, House, role and assignment history

#### Scenario: House or role change rejected by the database
- **WHEN** an UPDATE that changes a position's House or role is executed directly with SQL
- **THEN** the database rejects it

### Requirement: Dated position assignments
The system SHALL record position occupancy as assignments, each with an employee, a position, the House of that position stored at creation, an inclusive start date and an optional inclusive end date (no end date means ongoing). An assignment's House MUST equal its position's House. An employee MUST NOT have two assignments on the same date, and a position MUST NOT have two occupants on the same date. Each assignment's whole interval MUST lie within a single membership of the same employee in the same House; an open-ended assignment requires an open-ended membership. The database SHALL enforce these rules for direct writes and concurrent transactions.

#### Scenario: Adjacent assignments on one position are valid
- **WHEN** Marta occupies "ER 1" until 2026-06-30 and Ana is assigned to "ER 1" from 2026-07-01
- **THEN** both assignments exist and the position has exactly one occupant on each date

#### Scenario: Overlapping occupant rejected
- **WHEN** Marta's assignment to "ER 1" includes 2026-06-30 and Ana is assigned to "ER 1" from 2026-06-30
- **THEN** the assignment is rejected as an overlap and nothing changes

#### Scenario: Employee with two positions rejected
- **WHEN** Ana holds "ER 1" from 2026-01-01 (ongoing) and is assigned to "ER 2" from 2026-03-01 without ending "ER 1"
- **THEN** the assignment is rejected and nothing changes

#### Scenario: Concurrent conflicting assignments
- **WHEN** two requests concurrently assign two different people to the same position for overlapping dates, or one person to two positions for overlapping dates
- **THEN** at most one request succeeds and the other receives a conflict message

#### Scenario: Direct conflicting insert rejected
- **WHEN** an overlapping assignment row for the same position, or for the same employee, is inserted directly with SQL
- **THEN** the database rejects the insert

#### Scenario: Assignment in another House's position rejected
- **WHEN** an assignment is stored with the House Carme Aymerich for a position of Paulo Freire
- **THEN** the database rejects it

#### Scenario: Assignment beyond the membership rejected
- **WHEN** Ana's Paulo Freire membership ends on 2026-06-30 and an assignment for her in Paulo Freire is requested from 2026-06-01 with no end date
- **THEN** the assignment is rejected because it extends beyond the membership, and nothing changes

#### Scenario: Containment enforced for direct writes
- **WHEN** a membership is ended directly with SQL before the end of an assignment it contains, and the transaction commits
- **THEN** the database rejects the transaction

### Requirement: Vacancies and occupancy on a date
A position with no assignment active on a date SHALL be vacant on that date. A future assignment MUST NOT fill a position before its start date. An employee with a membership and no assignment SHALL remain a valid team member without a position.

#### Scenario: Future occupant
- **WHEN** position "TFM" has only an assignment starting 2026-09-01 and the selected date is 2026-08-15
- **THEN** "TFM" is vacant on 2026-08-15 and occupied on 2026-09-01

#### Scenario: Member without position
- **WHEN** Núria is a current member of Carme Aymerich without any assignment
- **THEN** Núria appears in the Carme Aymerich team with no position

### Requirement: Assign, hand over and end positions
The director SHALL be able to assign an employee to a vacant position, replace a position's occupant, move an employee to another position in the same House, and end an ongoing assignment. A handover effective on date D SHALL close the position's assignment crossing D on D minus one day and open the incoming assignment on D, and SHALL likewise close the incoming employee's own assignment crossing D on D minus one day, all atomically. A handover MUST be rejected entirely when an affected assignment starts on or after D or when it would conflict with another future assignment; it MUST NOT overwrite or delete that assignment. Ending an assignment MUST NOT set its end before its start, and closed assignments MUST NOT be edited. Changing position MUST NOT change House membership.

#### Scenario: Replacement on the same position
- **WHEN** Marta occupies "ER 1" (ongoing) and the director confirms Ana as replacement from 2026-07-01
- **THEN** Marta's assignment ends on 2026-06-30, Ana's starts on 2026-07-01 on the same position ID, and Marta's assignment remains in the history

#### Scenario: Moving within the House
- **WHEN** Ana holds "ER 1" (ongoing) and is moved to "ER 2" from 2026-04-01
- **THEN** her "ER 1" assignment ends on 2026-03-31, her "ER 2" assignment starts on 2026-04-01, and her membership is unchanged

#### Scenario: Handover blocked by a future assignment
- **WHEN** position "ER 1" already has a future assignment starting 2026-09-01 and a handover from 2026-07-01 is requested
- **THEN** the handover is rejected with an explicit conflict and no assignment changes

#### Scenario: End before start rejected
- **WHEN** the director ends an assignment that starts 2026-05-01 on 2026-04-30
- **THEN** the operation is rejected and the assignment stays ongoing

### Requirement: CT occupants per House
The system SHALL derive a House's CT occupants for a date from that House's positions with role CT and their assignments active on that date. Vacant CT positions SHALL remain visible. CT MUST NOT be a separate employee entity and MUST NOT grant any application permission.

#### Scenario: CT per House
- **WHEN** Paulo Freire has CT positions "CT 1" occupied by Jordi and "CT 2" vacant on the selected date
- **THEN** Paulo Freire's CT list shows Jordi on "CT 1" and "CT 2" as vacant, and Carme Aymerich's CT list does not include Jordi

#### Scenario: Transferred CT leaves the old House's CT list
- **WHEN** Jordi holds "CT 1" in Paulo Freire and is transferred to Carme Aymerich from 2026-07-01
- **THEN** Jordi is a Paulo Freire CT on 2026-06-30 and not on 2026-07-01

### Requirement: Existing data preserved by the staffing migration
The staffing migration SHALL keep every existing House, Employee and HouseMembership row, their IDs, names and dates, and the existing membership constraints. It MUST NOT create positions or assignments for existing employees.

#### Scenario: SPEC-001 data after migration
- **WHEN** the migration is applied to a database containing SPEC-001 employees and memberships
- **THEN** their IDs, names and membership dates are unchanged, membership overlaps are still rejected, and every employee appears without a position
