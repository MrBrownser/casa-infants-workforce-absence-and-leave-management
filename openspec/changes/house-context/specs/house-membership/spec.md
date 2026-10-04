## ADDED Requirements

### Requirement: Effective-dated House membership
The system SHALL record an employee's House membership as periods with an inclusive start date and an inclusive, optional end date (no end date means ongoing). Dates MUST be calendar dates without time.

#### Scenario: Membership with a period
- **WHEN** Ana's membership in Paulo Freire starts on 2026-01-01 and ends on 2026-06-30
- **THEN** Ana is a member of Paulo Freire on 2026-01-01 and on 2026-06-30, and not on 2026-07-01

### Requirement: One House at a time
An employee MUST NOT have overlapping House memberships, whether in the same House or in different Houses. The database SHALL enforce this rule independently of the application.

#### Scenario: Overlap rejected by the domain check
- **WHEN** a membership in Carme Aymerich starting 2026-06-15 is proposed for an employee whose Paulo Freire membership runs until 2026-06-30
- **THEN** the overlap is detected and the membership is not created

#### Scenario: Overlap rejected by the database
- **WHEN** an overlapping membership row for the same employee is inserted directly with SQL
- **THEN** the database rejects the insert

#### Scenario: End before start rejected
- **WHEN** a membership has an end date earlier than its start date
- **THEN** the database rejects it

### Requirement: Current team members
Normal team listings for the active House SHALL show only employees whose membership in that House is active today, where today is the current date in the Europe/Madrid time zone.

#### Scenario: Employees separated by current membership
- **WHEN** Ana's current membership is Paulo Freire, Marta's is Carme Aymerich, and Paulo Freire is active
- **THEN** the Equip page lists Ana and does not list Marta

#### Scenario: Madrid date decides the boundary
- **WHEN** Ana's Carme Aymerich membership starts on 2026-07-01 and the time is 2026-06-30T23:30:00Z (2026-07-01 01:30 in Madrid)
- **THEN** Ana is a current member of Carme Aymerich and not of Paulo Freire

#### Scenario: Transferred employee is not a current member
- **WHEN** an employee left Paulo Freire on 2026-06-30 and today is after that date
- **THEN** the employee is not listed as a current Paulo Freire team member

### Requirement: Historical membership
The system SHALL determine an employee's House for any past or future date from their membership periods, so that the employee appears in a House's historical information only for the periods in which they belonged to it.

#### Scenario: Records before and after a transfer
- **WHEN** Ana belongs to Paulo Freire until 2026-06-30 and to Carme Aymerich from 2026-07-01
- **THEN** Ana's House on 2026-03-15 is Paulo Freire and her House on 2026-09-15 is Carme Aymerich

### Requirement: Transfer does not rewrite history
A transfer SHALL end the employee's current membership on the day before the new start date and open a new membership in the target House, atomically. A transfer MUST NOT change the House or the start date of any existing membership period. Transfers to the same House, or with a start date on or before the current membership's start, MUST be rejected.

#### Scenario: Transfer closes and opens
- **WHEN** Ana (Paulo Freire since 2026-01-01, ongoing) is transferred to Carme Aymerich starting 2026-07-01
- **THEN** her Paulo Freire membership ends on 2026-06-30, a Carme Aymerich membership starts on 2026-07-01, and the Paulo Freire period still starts on 2026-01-01

#### Scenario: Transfer to the same House rejected
- **WHEN** a transfer to the employee's current House is requested
- **THEN** the transfer is rejected and no membership changes

#### Scenario: Transfer recorded in advance
- **WHEN** on 2026-05-10 Ana is transferred to Carme Aymerich starting 2026-07-01
- **THEN** Ana remains a current Paulo Freire member until 2026-06-30

### Requirement: House-scoped records keep their own House
Every House-scoped record introduced by later capabilities (for example APs, vacations, absences, coverage) SHALL store the House it belongs to at creation time and MUST NOT derive it from the employee's current membership.

#### Scenario: Record keeps its House after a transfer
- **WHEN** a House-scoped record was created for Ana in Paulo Freire in March and Ana is later transferred to Carme Aymerich
- **THEN** the record still belongs to Paulo Freire

### Requirement: Temporary cross-House work is not membership
Temporary responsibilities or coverage in the other House (a corretor covering a shift, an ER supervising both Houses while covering the director) MUST NOT create, modify or end any House membership, and MUST NOT require a duplicate employee record.

#### Scenario: Membership is independent of other assignments
- **WHEN** CT A, a member of Paulo Freire, is later given a temporary assignment in Carme Aymerich by a future coverage capability
- **THEN** CT A's House membership records are unchanged and CT A is not listed as a current Carme Aymerich team member

#### Scenario: ER supervising both Houses
- **WHEN** an ER who belongs to Paulo Freire temporarily supervises both Houses
- **THEN** the ER has a single employee record and a single current membership, in Paulo Freire

### Requirement: Minimal employee data
An employee record SHALL hold only a full name in this capability. Deleting an employee MUST delete their House memberships.

#### Scenario: Employee erasure
- **WHEN** an employee record is deleted
- **THEN** all of that employee's House membership rows are deleted with it
