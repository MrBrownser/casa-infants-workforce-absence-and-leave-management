## ADDED Requirements

### Requirement: Posts are defined in code per House
The system SHALL define, in code, the ordered list of posts of each House. Each post MUST have a key unique within its House, a Catalan label, a role code (PDG, PSI, ER, TFM, TFT, ET, ECS, EN or CT) and a shift. The CT role MUST be labelled "Corretorn". Posts MUST NOT be created, renamed or deleted from the user interface.

#### Scenario: Inventory is well formed
- **WHEN** the posts of Paulo Freire and Carme Aymerich are loaded
- **THEN** every House has at least one post, keys are unique within each House, and every post has a known role code and a known shift

#### Scenario: Corretorn label
- **WHEN** a CT post is shown anywhere in the app
- **THEN** its role is shown as "Corretorn"

### Requirement: Shifts are defined in code
The system SHALL define, in code and in display order, the shifts Matí, Tarda, Referents, Equip tècnic, Cap de setmana i festius, Nit and Corretorn. A shift MAY have known start and end times (`HH:MM`); unknown times MUST be omitted from the interface rather than invented.

#### Scenario: Unknown times are not shown
- **WHEN** the Equip page groups posts under the Matí shift, whose times are not defined yet
- **THEN** the group heading shows "Matí" without any time

### Requirement: Minimal personal data
A person record SHALL hold only a full name, the House, the post key, an optional start date in the House, an active flag and technical timestamps. It MUST NOT hold contact, identity, contract or health data. Personal data MUST be stored in the EU database.

#### Scenario: Person fields
- **WHEN** the director adds a person
- **THEN** the form asks only for the full name and an optional start date, and the post and House come from where the person is added

### Requirement: One active person per post
Each post of a House SHALL have at most one active person at a time. A post without an active person MUST be shown as "Vacant". The database MUST reject a second active person for the same House and post, independently of the application.

#### Scenario: Vacant post
- **WHEN** no active person covers the Corretorn post of Carme Aymerich
- **THEN** the Equip page shows that post as "Vacant" with an action to add a person

#### Scenario: Second active person rejected by the database
- **WHEN** a second active row for the same House and post is inserted directly with SQL
- **THEN** the database rejects the insert

### Requirement: Equip lists posts and people
The Equip page of a House SHALL list every post of that House, grouped by shift in shift order, with the active person who covers it or "Vacant". It SHALL also list, separately, the inactive people whose House is that House ("Antics membres"). It MUST NOT show people of the other House.

#### Scenario: Paulo Freire team
- **WHEN** the director opens `/paulo-freire/team`
- **THEN** every Paulo Freire post appears once under its shift, each with its active person or "Vacant", and inactive Paulo Freire people appear under "Antics membres"

### Requirement: Add a person to a vacant post
The director SHALL be able to add a person to a vacant post of the active House with a non-blank full name and an optional start date (`dd/mm/aaaa`). Adding a person to an occupied post MUST be rejected with a Catalan message that names the current occupant. Two people MAY share the same name.

#### Scenario: Add to a vacant post
- **WHEN** the director adds "Laia Puig" to the vacant Educadora referent 1 post of Paulo Freire
- **THEN** Laia Puig appears as the active person of that post

#### Scenario: Post taken in the meantime
- **WHEN** the director submits a new person for a post that another request has just filled
- **THEN** nothing is saved and the form shows an error with an icon naming who covers the post

### Requirement: Rename a person
The director SHALL be able to correct a person's full name without changing their House, post or opening balances.

#### Scenario: Name corrected
- **WHEN** the director renames "Jordi Sera" to "Jordi Serra"
- **THEN** the same person keeps the same post and balances under the new name

### Requirement: Move a person to another post or House
The director SHALL be able to move an active person to a vacant post of the same House or of the other House. Moving to an occupied post MUST be rejected with a message naming the occupant; the system MUST NOT swap people implicitly. Moving MUST NOT change records that already store their own House.

#### Scenario: Move to the other House
- **WHEN** the director moves Pau Roca from the Educador de tardes post of Paulo Freire to the vacant Educador de tardes post of Carme Aymerich
- **THEN** Pau Roca is listed in Carme Aymerich under that post and the Paulo Freire post becomes "Vacant"

#### Scenario: Target post occupied
- **WHEN** the director tries to move a person to a post that has an active person
- **THEN** the move is rejected, nothing changes, and the message names the person who covers that post

### Requirement: Mark a person inactive and reactivate
The director SHALL be able to mark an active person as inactive (they left the House), which frees their post and keeps their data. The director SHALL be able to reactivate an inactive person into a vacant post of a House. The interface MUST NOT offer to delete people.

#### Scenario: Person leaves
- **WHEN** the director marks Òscar Gil as inactive
- **THEN** the Corretorn post shows "Vacant" and Òscar Gil appears under "Antics membres"

#### Scenario: Person comes back
- **WHEN** the director reactivates Òscar Gil into the vacant Corretorn post
- **THEN** Òscar Gil is again the active person of that post with the same opening balances

### Requirement: Opening balances per person and year
For each person and calendar year the system SHALL store the vacation days the person is entitled to, the days carried over from the previous year (AA) and the calendar surplus in hours at the start of the year, which MAY be negative. The director SHALL be able to edit them from the person's details on the Equip page.

#### Scenario: Balances saved
- **WHEN** the director saves 31 vacation days, 3 AA days and +12 h for Clara Sala in 2026
- **THEN** Clara Sala's 2026 balances show 31 days, 3 AA days and +12 h

### Requirement: Default opening balances
When no balances are stored for a person and year, the system SHALL show defaults: 31 vacation days, 0 AA days and 0 hours. If the person started in that year, the vacation days MUST be prorated by their start date and rounded to whole days.

#### Scenario: Default for a full year
- **WHEN** a person who started before 2026 has no stored balances for 2026
- **THEN** their 2026 balances show 31 vacation days, 0 AA days and +0 h

#### Scenario: Prorated default
- **WHEN** a person started on 01/07/2026 and has no stored balances for 2026
- **THEN** their 2026 vacation days default to 16

### Requirement: Hours in two formats
Hour amounts SHALL be accepted as `3:45` or `3,75` (also `3h45`, `3.75` and whole hours) and MUST be shown as `3 h 45 min`, with a sign when they are a surplus.

#### Scenario: Negative surplus in either format
- **WHEN** the director saves a 2026 surplus of "-9:15" for a person
- **THEN** the balance is stored as −9.25 hours and shown as "−9 h 15 min"

### Requirement: House-scoped records keep their own House
Every House-scoped record introduced by later capabilities (APs, vacations, sick leave, rota changes, vacation plans) SHALL store the House it belongs to at creation time and MUST NOT derive it from the person's current House.

#### Scenario: Record keeps its House after a move
- **WHEN** an AP was recorded for Pau in Paulo Freire in March and Pau is moved to Carme Aymerich in May
- **THEN** the March AP still belongs to Paulo Freire

### Requirement: Writes are scoped to the active House
Every write SHALL resolve the House from the validated route and MUST verify that the person and post belong to that House (or, for a move, that the target post belongs to the target House). A tampered person or post identifier MUST be rejected without changing data. Errors MUST be shown in Catalan with an icon and text, and form fields MUST keep their values.

#### Scenario: Person from the other House
- **WHEN** a request on `/paulo-freire/team` tries to rename a person whose House is Carme Aymerich
- **THEN** the request is rejected and no person changes

#### Scenario: Unknown post key
- **WHEN** a request submits a post key that does not exist in the House's inventory
- **THEN** the request is rejected and nothing is saved
