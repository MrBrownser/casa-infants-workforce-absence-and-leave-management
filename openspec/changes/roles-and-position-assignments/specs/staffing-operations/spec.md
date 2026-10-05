## ADDED Requirements

### Requirement: House-scoped operations
Every staffing read and write SHALL resolve the House from the validated URL House slug and MUST NOT take it from a cookie or a submitted field. The server MUST verify that every submitted position, membership and assignment belongs to that House, and that an employee read on a House page has had a membership in that House; otherwise it SHALL respond as not found and change nothing. A transfer's destination House SHALL be validated separately. Workflows that add a new membership MAY select an existing employee from either House.

#### Scenario: Tampered position ID
- **WHEN** a form under `/paulo-freire/team` submits the ID of a Carme Aymerich position
- **THEN** the operation is rejected as not found and no record changes

#### Scenario: Tampered House cookie
- **WHEN** the `active-house` cookie says `carme-aymerich` while the director submits a form under `/paulo-freire/team`
- **THEN** the operation runs in Paulo Freire only

#### Scenario: Employee page in an unrelated House
- **WHEN** the director opens `/carme-aymerich/team/<id>` for an employee who never had a Carme Aymerich membership
- **THEN** a not-found page is shown

### Requirement: Atomic staffing operations
Each staffing operation SHALL apply all of its record changes in one transaction. If any part fails validation or a database constraint, no change of that operation MUST persist.

#### Scenario: Failed creation leaves nothing
- **WHEN** the director creates a person with an initial position that is already occupied on the start date
- **THEN** the operation fails with a clear message and no employee, membership or assignment is created

### Requirement: Idempotent submissions
Every staffing write SHALL carry a stable operation identifier generated once per form instance. A repeated submission with an identifier that was already applied MUST NOT create or change records again and SHALL report that the operation was already applied. Concurrent duplicate submissions MUST result in exactly one application.

#### Scenario: Retry after an uncertain network response
- **WHEN** the "Afegir persona" form is submitted twice with the same operation identifier
- **THEN** exactly one employee and one membership exist and the second response says the operation was already applied

#### Scenario: Concurrent duplicate submissions
- **WHEN** two identical handover requests with the same operation identifier arrive at the same time
- **THEN** exactly one handover is applied and the other request reports it as already applied

### Requirement: Stale state is rejected
Every write SHALL revalidate current database state inside its transaction. When the state the form was based on has changed (a period it expected to be open was closed, an employee name changed since it was loaded, or a previewed plan no longer matches), the operation MUST be rejected with a Catalan message asking to reload, and nothing MUST change.

#### Scenario: Stale handover confirmation
- **WHEN** the director previews a handover on "ER 1", another change assigns a future occupant to "ER 1", and the director then confirms
- **THEN** the confirmation is rejected as stale and no assignment changes

#### Scenario: Stale name edit
- **WHEN** two name edits for the same employee are based on the same loaded version and the second is submitted after the first succeeded
- **THEN** the second edit is rejected as stale and the first name remains

### Requirement: Confirmation before multi-record changes
Handovers, House transfers and ending a membership SHALL show a confirmation that names the people, the Houses and positions, and the dates that close and open, before any write. Cancelling MUST write nothing.

#### Scenario: Cancel a transfer
- **WHEN** the director reviews a transfer confirmation and chooses "Cancel·la"
- **THEN** no membership or assignment changes

### Requirement: Friendly Catalan errors
Validation, constraint and contention failures SHALL be shown in Catalan with an icon and text, keeping the entered field values. Error responses and logs MUST NOT expose SQL text or personal data. Submit buttons SHALL be disabled while a submission is pending.

#### Scenario: Database conflict becomes a friendly error
- **WHEN** an assignment fails on the database's position overlap rule
- **THEN** the director sees a Catalan conflict message with an icon, the form keeps its values, and the server log records only the error reason
