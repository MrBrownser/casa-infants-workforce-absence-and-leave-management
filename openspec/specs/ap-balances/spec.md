# ap-balances Specification

## Purpose
Each person's AP (assumptes propis) balances per year: the two AP types and FASI's limits, the date window, how an AP recuperable eats into the calendar surplus, recording, deleting and undoing APs with public-holiday notices, and the Saldos page that shows every person's vacation entitlement, AP balances and surplus. Created by archiving change saldos (SPEC-004).

## Requirements
### Requirement: AP types and yearly limits
The system SHALL support two types of AP (assumptes propis), counted in hours per person and year: AP no recuperable, at most 24 hours a year in at most 5 requests, and AP recuperable, at most 24 hours a year in at most 3 requests. The limits MUST be defined in code. Recording an AP that would exceed a limit MUST be rejected, in the form and on the server, with a Catalan message and an icon.

#### Scenario: Sixth AP no recuperable
- **WHEN** a person already has 5 APs no recuperables in 2026 and the director records another one for 2026
- **THEN** nothing is saved and the form shows "Ja ha fet servir els 5 dies que permet aquest tipus d'AP." with an icon

#### Scenario: Yearly hours exceeded
- **WHEN** a person has used 22 hours of AP recuperable in 2026 and the director records 2:30 more
- **THEN** nothing is saved and the form shows "Supera el màxim de 24 h: només li queden 2 h." with an icon

#### Scenario: Exactly the remaining hours
- **WHEN** a person has used 20 hours of AP no recuperable in 2026 and the director records 4:00 more
- **THEN** the AP is saved and the person has 0 hours of AP no recuperable left

### Requirement: Length of one request
One AP request MUST be between 0:01 and 24:00 hours, so a night shift plus the following team meeting (REE) can be one request.

#### Scenario: Night plus team meeting in one request
- **WHEN** the director records an AP of 12:00 dated the Monday of a night shift that includes Tuesday's team meeting
- **THEN** it is saved as one request of 12 hours

#### Scenario: Invalid hours
- **WHEN** the director types `9:75`, `0:00` or `25:00` as the hours of an AP
- **THEN** the field shows an error with an icon and nothing is saved

### Requirement: AP year and date window
Each AP SHALL count toward one calendar year, chosen by the director, and its date MUST be between 1 January of that year and 31 January of the next year (FASI instruction FPOL32 §1). The database MUST reject an AP whose date is outside that window.

#### Scenario: January AP for last year
- **WHEN** the director records, on Saldos 2026, an AP dated 15/01/2027
- **THEN** it is saved for 2026, counts toward the 2026 balances, and the person sheet labels it as January 2027

#### Scenario: Date outside the window
- **WHEN** the director records, on Saldos 2026, an AP dated 01/02/2027 or 31/12/2025
- **THEN** nothing is saved and the form shows "La data ha de ser entre el 01/01/2026 i el 31/01/2027." with an icon

### Requirement: AP recuperable deducted from the calendar surplus
The current calendar surplus of a person and year SHALL be the opening surplus of that year minus the hours of their APs recuperables of that year. An AP recuperable MUST NOT be blocked for lack of surplus: the surplus MAY become negative, and the form MUST say so before saving.

#### Scenario: Surplus goes negative
- **WHEN** a person has a 2026 opening surplus of +2:00, no APs recuperables, and the director enters an AP recuperable of 6:00
- **THEN** the form shows "L'excedent passarà de +2 h a −4 h: haurà de retornar 4 h. Es pot apuntar igualment." with an icon, and saving is allowed

#### Scenario: Owed hours shown
- **WHEN** a person's current 2026 surplus is −9 h 18 min
- **THEN** Saldos 2026 shows "Deu 9 h 18 min" for that person

### Requirement: Balances follow the person
AP balances SHALL be computed from all the APs of the person and year, whichever House they were recorded in. Each AP MUST keep the House where it was recorded, which MUST NOT change when the person moves; for a person of a shared post it is the House the director was in.

#### Scenario: Person moved to the other House
- **WHEN** Roger Beltrán Camps has 2 APs no recuperables recorded in Paulo Freire in 2026 and is moved to Carme Aymerich
- **THEN** Saldos 2026 of Carme Aymerich shows Roger Beltrán Camps with 2 of 5 requests used, and each AP keeps Paulo Freire as the House where it was recorded

#### Scenario: Shared post
- **WHEN** the director records, on Carme Aymerich's Saldos, an AP for Meritxell Torres Vila, the shared Pedagoga
- **THEN** the AP is saved with Carme Aymerich as its House and shows on the Saldos of both Houses

### Requirement: Minimal AP data
An AP SHALL hold only the person, the House where it was recorded, the type, the year, the date, the number of minutes and a creation timestamp. It MUST NOT hold a reason, a document or health data. Deleting an AP MUST remove it from the database.

#### Scenario: AP fields
- **WHEN** the director records an AP
- **THEN** the form asks only for the person, the type, the day and the hours

### Requirement: Record an AP
The director SHALL be able to record an AP for a person of the active House or of a shared post, for the year shown, with a type, a day (`dd/mm/aaaa`) and hours (`H:MM`). The form SHALL show the person's current balances as soon as the person is chosen and a preview of the balance after saving.

#### Scenario: Preview before saving
- **WHEN** the director chooses Laia Vidal Mas, who has 3 APs no recuperables totalling 12 h in 2026, and types 6:00
- **THEN** the form shows "Li quedaran 6 h d'AP no recuperables (dia 4 de 5)."

#### Scenario: Person of the other House
- **WHEN** a request to record an AP on Paulo Freire names a person of Carme Aymerich
- **THEN** nothing is saved and the response is "Aquesta persona no és d'aquesta casa."

### Requirement: Remaining time in the form
When the next request is the last one allowed for its type, the hours MUST start at the remaining time (at most 24:00) with a hint, and remain editable. Otherwise, while time is left, the form SHALL offer a shortcut that fills in the remaining time.

#### Scenario: Last request prefilled
- **WHEN** the director chooses AP no recuperable for a person who has 4 requests and 18 hours used in 2026
- **THEN** the hours field shows 6:00 and the hint "És l'últim dia: li queden 6 h", and the director can lower it before saving

#### Scenario: Remaining time shortcut
- **WHEN** the director chooses AP recuperable for a person who has 1 request of 8 hours in 2026
- **THEN** the form offers "La resta (16 h)", which fills the hours with 16:00

### Requirement: Public holiday notice
When the AP date is a public holiday known for that year, the form SHALL show a notice with an icon naming the holiday and the instruction's rule, and MUST still allow saving. Public holidays SHALL be defined in code per year; a year without a list shows no notice.

#### Scenario: AP on Christmas
- **WHEN** the director enters an AP dated 25/12/2026
- **THEN** the form shows "És festiu (Nadal): segons la instrucció no es poden demanar AP en festius." with an icon, and saving is allowed

### Requirement: Delete an AP and undo any change
The director SHALL be able to delete an AP from the person's details. Right after recording or deleting an AP, the system SHALL offer "Desfés" for a few seconds; undoing a record deletes it, and undoing a delete records the same AP again (same person, type, year, date, hours and House) after checking the limits again.

#### Scenario: Undo a new AP
- **WHEN** the director records an AP and presses "Desfés"
- **THEN** the AP is removed and the balances are as before

#### Scenario: Undo a delete
- **WHEN** the director deletes an AP of 4 h dated 20/02/2026 and presses "Desfés"
- **THEN** the AP of 4 h dated 20/02/2026 is back and the balances are as before

#### Scenario: Undo blocked by a limit
- **WHEN** the director deletes a person's fifth AP no recuperable, records another one, and then presses "Desfés" on the delete
- **THEN** nothing is saved and the message "Ja ha fet servir els 5 dies que permet aquest tipus d'AP." is shown with an icon

### Requirement: Saldos lists the balances of a House
The Saldos page of a House (`/<house>/saldos`) SHALL show, for one year, every active person of that House and of the shared posts with: their vacation days of the year including AA days, their AP no recuperable hours left and requests used of 5, their AP recuperable hours used and requests of 3, and their current calendar surplus. It MUST NOT show people of the other House. Until vacation periods are recorded (SPEC-006), the vacation figures MUST show the entitlement only.

#### Scenario: Vacation days with AA
- **WHEN** a person has 31 vacation days and 3 AA days in 2026
- **THEN** Saldos 2026 shows "34 dies (3 AA)" for that person

#### Scenario: Paulo Freire in 2026
- **WHEN** the director opens `/paulo-freire/saldos`
- **THEN** the page is titled "Saldos 2026" and lists the active Paulo Freire people plus Meritxell Torres Vila and Sílvia Miró Esteve, each with their vacation days, AP balances and surplus, and no Carme Aymerich people

### Requirement: Saldos year
The Saldos page SHALL show the current year in Europe/Madrid unless the director chooses the previous or the next year on a year switcher, which MUST be kept in the URL.

#### Scenario: Another year
- **WHEN** the director chooses 2025 on the year switcher
- **THEN** the URL has `?year=2025` and the balances are those of 2025

### Requirement: Former members on Saldos
Inactive people of the House who have APs or stored opening balances in the year shown SHALL be listed apart, collapsed, under "Antics membres", and MUST NOT count in the totals.

#### Scenario: Former member with data
- **WHEN** Núria Roca Ferrer, an inactive Paulo Freire person, has an AP in 2026
- **THEN** she appears under the collapsed "Antics membres" group and is not counted in the totals

### Requirement: Saldos totals and filters
The Saldos page SHALL show two totals for the active people listed: the AP no recuperable hours used out of the team's total allowance, and the number of people who owe hours with the hours owed in total. The second total SHALL toggle a "Deuen hores" filter, also offered next to "Tothom". A search box SHALL filter people by name ignoring accents and case.

#### Scenario: Who owes hours
- **WHEN** two active people of Paulo Freire have a negative surplus in 2026, of −4 h and −9 h 15 min
- **THEN** the total shows "2 persones" and "13 h 15 min en total", and choosing it lists only those two people

#### Scenario: Search ignores accents and case
- **WHEN** the director types "BELTRAN" in the search box
- **THEN** Roger Beltrán Camps is listed

#### Scenario: Nobody matches
- **WHEN** the filter and the search match nobody
- **THEN** the page shows "Ningú coincideix amb aquest filtre."

### Requirement: Person details on Saldos
Choosing a person on Saldos SHALL open their details for the year: their balance tiles, a reminder when they owe hours, every AP no recuperable and recuperable of the year sorted by date with the day of the week, the date, the hours and a delete action, the opening surplus of the year with a link to edit it on the Equip page, and an action to record an AP for that person.

#### Scenario: Details of a person who owes hours
- **WHEN** the director opens David Valls Medina, whose 2026 surplus is −9 h 15 min
- **THEN** the details show "Ha de retornar 9 h 15 min treballant quan calgui." and his APs of 2026 sorted by date

#### Scenario: Record from the details
- **WHEN** the director chooses "Apuntar AP" in a person's details
- **THEN** the AP form opens with that person already chosen

### Requirement: Director-only Saldos
The Saldos page, its data function and every AP Server Function MUST check director access themselves, and every Server Function MUST validate its input again on the server, whatever the form sent.

#### Scenario: Non-director records an AP
- **WHEN** a signed-in user without the director flag calls the Server Function that records an AP
- **THEN** nothing is saved and the user is redirected to `/no-access`

