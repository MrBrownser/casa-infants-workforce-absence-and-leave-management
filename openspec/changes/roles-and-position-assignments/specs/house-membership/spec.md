## ADDED Requirements

### Requirement: Create employees
The director SHALL be able to create an employee with a non-blank, trimmed full name and an initial membership in the active House with a start date and an optional end date, and optionally an initial position assignment of that House over the same interval, all in one transaction. Names MUST NOT be treated as identity: employees with the same name SHALL be allowed and MUST NOT be merged or linked automatically. No contact, identity-document, health or payroll fields SHALL be collected.

#### Scenario: Create with an initial position
- **WHEN** the director creates Ana in Paulo Freire from 2026-01-01 with the vacant position "ER 1"
- **THEN** one employee, one membership from 2026-01-01 and one assignment to "ER 1" from 2026-01-01 are committed together

#### Scenario: Invalid creation leaves nothing
- **WHEN** the initial position is occupied on the start date, or the end date precedes the start date
- **THEN** creation fails with a Catalan message and no employee, membership or assignment is created

#### Scenario: Same name, different people
- **WHEN** the director creates two employees both named "Maria Garcia"
- **THEN** both exist with distinct IDs and neither is merged or linked

### Requirement: Edit employee names
The director SHALL be able to correct an employee's full name. The employee MUST keep the same ID, and memberships and assignments MUST NOT change.

#### Scenario: Name correction
- **WHEN** the director renames "Ana Puig" to "Anna Puig"
- **THEN** the employee keeps its ID and all membership and assignment periods are unchanged

### Requirement: Membership lifecycle
The director SHALL be able to view an employee's membership history, add a non-overlapping membership period (past, current or future) for an existing employee, and end an ongoing membership on a date on or after its start. Ending a membership SHALL preview and atomically close every position assignment crossing that end date, and MUST be rejected if an assignment of that membership starts after the proposed end. Completed periods MUST NOT be rewritten. Ending a membership MUST NOT erase the employee or change application access.

#### Scenario: End membership closes the assignment
- **WHEN** Laia's ongoing Paulo Freire membership is ended on 2026-08-31 while her "ER 1" assignment is ongoing
- **THEN** the preview shows both closures and, on confirmation, both end on 2026-08-31 together

#### Scenario: Future assignment blocks ending
- **WHEN** a membership is ended on 2026-08-31 while one of its assignments starts on 2026-09-15
- **THEN** the operation is rejected with an explicit conflict and nothing changes

#### Scenario: Return after a gap
- **WHEN** an employee whose Paulo Freire membership ended on 2025-12-31 is given a new Paulo Freire membership from 2026-03-01
- **THEN** the employee keeps the same ID and has no membership between 2026-01-01 and 2026-02-28

#### Scenario: Overlapping period rejected
- **WHEN** a new membership is added that overlaps an existing period of the same employee in either House
- **THEN** it is rejected with a Catalan message and nothing changes

## MODIFIED Requirements

### Requirement: Transfer does not rewrite history
A transfer SHALL end the employee's ongoing membership in the selected House on the day before the effective date D and open a new membership in the destination House from D. In the same transaction it SHALL close the source position assignment crossing D on D minus one day and MAY open a destination position assignment from D. A transfer MUST NOT change the House or start date of any existing membership or assignment, nor any closed period or unrelated record. A transfer MUST be rejected entirely, with no partial change, when the destination is the same House, D is on or before the source membership's start, the source is not an ongoing membership of the selected House, a source assignment starts on or after D, the destination position is occupied on D, a membership would overlap, or the source state changed since the confirmation was shown. A destination without a position SHALL be valid.

#### Scenario: Transfer closes and opens
- **WHEN** Ana (Paulo Freire since 2026-01-01, ongoing, holding "ER 1") is transferred to Carme Aymerich from 2026-07-01 with destination position "ER A"
- **THEN** her Paulo Freire membership and "ER 1" assignment end on 2026-06-30, her Carme Aymerich membership and "ER A" assignment start on 2026-07-01, and the Paulo Freire period still starts on 2026-01-01

#### Scenario: Transfer recorded in advance
- **WHEN** on 2026-05-10 Ana is transferred to Carme Aymerich starting 2026-07-01
- **THEN** Ana remains a current Paulo Freire member holding her position until 2026-06-30

#### Scenario: Transfer without destination position
- **WHEN** Ana is transferred to Carme Aymerich from 2026-07-01 without a destination position
- **THEN** the transfer succeeds, Ana is a Carme Aymerich member without a position from 2026-07-01, and she is absent from Paulo Freire's team from that date

#### Scenario: Transfer to the same House rejected
- **WHEN** a transfer to the employee's current House is requested
- **THEN** the transfer is rejected and no membership changes

#### Scenario: Rejected transfer changes nothing
- **WHEN** the destination position is occupied on D, or D is on or before the source start
- **THEN** the transfer fails with a Catalan explanation and the original membership and assignment remain unchanged

#### Scenario: Future source assignment blocks the transfer
- **WHEN** Ana has a source-House assignment starting on or after D
- **THEN** the transfer is rejected with an explicit conflict, without cancelling or deleting that assignment

#### Scenario: Repeated transfer submission
- **WHEN** a transfer form is submitted twice with the same operation identity
- **THEN** only one transfer exists and the destination membership is not transferred again

### Requirement: Minimal employee data
An employee record SHALL hold only a full name as personal data (technical metadata such as creation and update timestamps is allowed). Deleting an employee MUST delete their House memberships, position assignments and account link, and MUST NOT delete positions or change application grants.

#### Scenario: Employee erasure
- **WHEN** an employee record is deleted
- **THEN** all of that employee's House memberships, position assignments and account link are deleted with it, while positions and grants remain
