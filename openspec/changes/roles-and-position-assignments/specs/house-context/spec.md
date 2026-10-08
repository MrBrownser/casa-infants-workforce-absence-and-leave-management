## MODIFIED Requirements

### Requirement: Switch active House
The director SHALL be able to switch between Paulo Freire and Carme Aymerich from the House switcher on every House-scoped page. Switching MUST keep the current section and MUST NOT create, modify, move or delete any business data. From a page of a specific employee or position (`/<house>/team/<employeeId>/...` or `/<house>/team/positions/<positionId>/...`), switching SHALL go to the other House's team list instead of reusing that record's ID.

#### Scenario: Director switches to Carme Aymerich
- **WHEN** the director is on `/paulo-freire/team` and selects Carme Aymerich
- **THEN** the browser navigates to `/carme-aymerich/team` and Carme Aymerich information is shown

#### Scenario: Switching from an employee page
- **WHEN** the director is on `/paulo-freire/team/<employeeId>` and selects Carme Aymerich
- **THEN** the browser navigates to `/carme-aymerich/team`

#### Scenario: Switching writes nothing
- **WHEN** the director switches the active House any number of times
- **THEN** no House, Employee, HouseMembership, Position or PositionAssignment record is created, changed or deleted

### Requirement: Director-only access
Only signed-in users with an enabled director application grant SHALL access House-scoped pages, House and staffing data, and staffing mutations. Other signed-in users MUST be redirected to a "Sense accés" page (`/no-access`) with an icon and explanatory text; signed-out users go through the sign-in flow. Every House-scoped page, every server-side House or staffing data function and every staffing mutation MUST perform this check itself before reading or writing data, not rely on a parent layout or hidden controls.

#### Scenario: Director enters
- **WHEN** a signed-in user with an enabled director grant opens `/paulo-freire`
- **THEN** the House page is shown

#### Scenario: Non-director is blocked
- **WHEN** a signed-in user without an enabled director grant opens `/paulo-freire/team`
- **THEN** the user is redirected to `/no-access`, the "Sense accés" page is shown, and no employee names are rendered

#### Scenario: Data layer rejects non-director
- **WHEN** a House or staffing data function is called in a request from a user without an enabled director grant
- **THEN** it stops with a redirect to `/no-access` without querying House data

#### Scenario: Mutation rejects non-director
- **WHEN** a staffing Server Function is invoked directly by a signed-in user without an enabled director grant
- **THEN** it stops before reading or writing any staffing record
