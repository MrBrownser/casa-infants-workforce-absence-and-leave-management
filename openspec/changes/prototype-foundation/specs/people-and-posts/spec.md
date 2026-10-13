## ADDED Requirements

### Requirement: Posts are defined in code per House
The system SHALL define, in code, the ordered list of posts of each House. Each post MUST have a key unique within its House, a role code and a number of seats (people who share the post). The night post (EN) MUST have two seats; every other post has one. Posts MUST NOT be created, renamed or deleted from the user interface.

#### Scenario: Inventory of each House
- **WHEN** the posts of Paulo Freire and Carme Aymerich are loaded
- **THEN** each House has, in this order, PDG, PSI, ER, TFM, TFT, ET, ECS, EN and CT, keys are unique within the House, and only EN has two seats

### Requirement: Role labels
Each role code SHALL be shown with its Catalan label: PDG Pedagoga, PSI Psicòloga, ER Educadora referent, TFM Treballadora familiar de matins, TFT Treballadora familiar de tardes, ET Educadora de tardes, ECS Educadora de cap de setmana, EN Educadora de nit, CT Corretorn.

#### Scenario: Labels on the Equip page
- **WHEN** the director opens the Equip page of a House
- **THEN** every post is shown with the label of its role code, for example ET as "Educadora de tardes"

### Requirement: Weekly schedule per post
Each post SHALL have, in code, a weekly schedule: for each day of the week, the time ranges it works (`HH:MM` to `HH:MM`, a range may end after midnight) or none. The schedule MUST be the same every week. Until the director confirms the real times, the code SHALL hold plausible invented times, marked as provisional.

#### Scenario: Schedule shown with the post
- **WHEN** the director opens the Equip page of Paulo Freire
- **THEN** every post shows its weekly schedule (for example Educadora de nit: every night from 22:00, alternating weeks) and the CT shows "Sense horari fix"

#### Scenario: Different times per weekday
- **WHEN** a post works different hours on different weekdays (for example the Educadora referent)
- **THEN** each weekday shows its own range, and the same ranges repeat every week

### Requirement: Weekends, holidays, nights and the CT
Weekday posts MUST NOT work on public holidays. The weekend post (ECS) SHALL work weekends and public holidays, mornings and afternoons. The two people of the night post SHALL alternate by week. The CT SHALL have no fixed schedule.

#### Scenario: Night alternation
- **WHEN** the first seat of the night post works the nights of one week
- **THEN** the second seat works the nights of the next week

#### Scenario: Weekend mornings and afternoons
- **WHEN** the schedule of a Saturday is shown
- **THEN** the Educadora de cap de setmana covers the morning and the afternoon, and the night post covers the night

### Requirement: Minimal personal data
A person record SHALL hold only a full name, the House, the post key and seat, an optional start date in the House, an active flag and technical timestamps. It MUST NOT hold contact, identity, contract or health data. Personal data MUST be stored in the EU database.

#### Scenario: Person fields
- **WHEN** the director adds a person
- **THEN** the form asks only for the full name and an optional start date, and the House, post and seat come from where the person is added

### Requirement: People per post
Each seat of a post SHALL have at most one active person at a time, so a post has at most as many active people as seats. A seat without an active person MUST be shown as "Vacant". The database MUST reject a second active person for the same House, post and seat, independently of the application.

#### Scenario: Night post with two people
- **WHEN** David Valls Medina and Cristina Pascual Duran cover the two seats of the Educadora de nit post of Paulo Freire
- **THEN** the post shows both people, each with the weeks they work

#### Scenario: Vacant seat
- **WHEN** no active person covers the Corretorn post of Carme Aymerich
- **THEN** the Equip page shows that post as "Vacant" with an action to add a person

#### Scenario: Second active person rejected by the database
- **WHEN** a second active row for the same House, post and seat is inserted directly with SQL
- **THEN** the database rejects the insert

### Requirement: Equip lists posts and people
The Equip page of a House SHALL list every post of that House in inventory order, each with its weekly schedule and the active people who cover its seats, or "Vacant". It SHALL also list, separately, the inactive people whose House is that House ("Antics membres"), so the director can reincorporate someone who comes back (for example after an excedència) with their data and balances. It MUST NOT show people of the other House.

#### Scenario: Paulo Freire team
- **WHEN** the director opens `/paulo-freire/team`
- **THEN** every Paulo Freire post appears once with its schedule and its active people or "Vacant", and inactive Paulo Freire people appear under "Antics membres"

### Requirement: Add a person to a vacant seat
The director SHALL be able to add a person to a vacant seat of a post of the active House with a non-blank full name and an optional start date (`dd/mm/aaaa`). Adding a person to an occupied seat MUST be rejected with a Catalan message that names the current occupant. Two people MAY share the same name.

#### Scenario: Add to a vacant post
- **WHEN** the director adds "Carla Ribas Solé" to the vacant Educadora referent post of Paulo Freire
- **THEN** Carla Ribas Solé appears as the active person of that post

#### Scenario: Seat taken in the meantime
- **WHEN** the director submits a new person for a seat that another request has just filled
- **THEN** nothing is saved and the form shows an error with an icon naming who covers the seat

### Requirement: Rename a person
The director SHALL be able to correct a person's full name without changing their House, post, seat or balances.

#### Scenario: Name corrected
- **WHEN** the director renames "Roger Beltran Camps" to "Roger Beltrán Camps"
- **THEN** the same person keeps the same post and balances under the new name

### Requirement: Move a person to another post or House
The director SHALL be able to move an active person to a vacant seat of a post of the same House or of the other House. Moving to an occupied seat MUST be rejected with a message naming the occupant; the system MUST NOT swap people implicitly.

#### Scenario: Move to the other House
- **WHEN** the director moves Roger Beltrán Camps from the Educadora de tardes post of Paulo Freire to the vacant Educadora de tardes post of Carme Aymerich
- **THEN** Roger Beltrán Camps is listed in Carme Aymerich under that post and the Paulo Freire post becomes "Vacant"

#### Scenario: Target seat occupied
- **WHEN** the director tries to move a person to a seat that has an active person
- **THEN** the move is rejected, nothing changes, and the message names the person who covers that seat

### Requirement: Mark a person inactive and reactivate
The director SHALL be able to mark an active person as inactive (they left the House or are on a long leave such as an excedència), which frees their seat and keeps their data. The director SHALL be able to reactivate an inactive person into a vacant seat of a House. The interface MUST NOT offer to delete people.

#### Scenario: Person leaves
- **WHEN** the director marks Pol Jiménez Alcover, the Corretorn of Paulo Freire, as inactive
- **THEN** the Corretorn post of Paulo Freire shows "Vacant" and Pol Jiménez Alcover appears under "Antics membres"

#### Scenario: Person comes back
- **WHEN** the director reactivates Pol Jiménez Alcover into the vacant Corretorn post of Paulo Freire
- **THEN** Pol Jiménez Alcover is again the Corretorn of Paulo Freire with the same balances

### Requirement: Opening balances per person and year
For each person and calendar year the system SHALL store the vacation days the person is entitled to, the days carried over from the previous year (AA) and the calendar surplus at the start of the year, which MAY be negative. The director SHALL be able to edit them from the person's details on the Equip page.

#### Scenario: Balances saved
- **WHEN** the director saves 31 vacation days, 3 AA days and +12:00 for Mireia Santos Rovira in 2026
- **THEN** Mireia Santos Rovira's 2026 balances show 31 days, 3 AA days and +12 h

### Requirement: Default opening balances
When no balances are stored for a person and year, the system SHALL show defaults: 31 vacation days, 0 AA days and 0 hours. If the person started in that year, the vacation days MUST be prorated by their start date and rounded to whole days.

#### Scenario: Default for a full year
- **WHEN** a person who started before 2026 has no stored balances for 2026
- **THEN** their 2026 balances show 31 vacation days, 0 AA days and +0 h

#### Scenario: Prorated default
- **WHEN** a person started on 01/07/2026 and has no stored balances for 2026
- **THEN** their 2026 vacation days default to 16

### Requirement: Duration input
Every amount of hours SHALL be entered with one standard duration field of hours and minutes (`H:MM`, hours may exceed 24) that only accepts that format; a surplus adds an explicit + / − choice. Durations MUST be shown as `3 h 45 min`, with a sign when they are a surplus.

#### Scenario: Negative surplus
- **WHEN** the director chooses − and types `9:15` as a 2026 surplus
- **THEN** the balance is stored as −555 minutes and shown as "−9 h 15 min"

#### Scenario: Invalid duration
- **WHEN** the director types `9:75` or letters in a duration field
- **THEN** the field shows an error with an icon and nothing is saved

### Requirement: Balances follow the person
Vacation days, AA days, APs and the calendar surplus SHALL belong to the person, not to a House. Moving a person to the other House MUST keep their balances and their records as they are.

#### Scenario: Move keeps balances
- **WHEN** a person with 10 vacation days left, 8 h of AP left and −4 h of surplus is moved from Paulo Freire to Carme Aymerich
- **THEN** in Carme Aymerich the person still has 10 vacation days left, 8 h of AP left and −4 h of surplus

### Requirement: Writes are scoped to the active House
Every write SHALL resolve the House from the validated route and MUST verify that the person and post belong to that House (or, for a move, that the target post belongs to the target House). A tampered person, post or seat identifier MUST be rejected without changing data. Errors MUST be shown in Catalan with an icon and text, and form fields MUST keep their values.

#### Scenario: Person from the other House
- **WHEN** a request on `/paulo-freire/team` tries to rename a person whose House is Carme Aymerich
- **THEN** the request is rejected and no person changes

#### Scenario: Unknown post or seat
- **WHEN** a request submits a post key that does not exist in the House's inventory, or a seat beyond the post's seats
- **THEN** the request is rejected and nothing is saved
