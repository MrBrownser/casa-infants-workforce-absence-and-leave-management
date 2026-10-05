## ADDED Requirements

### Requirement: Team on a selected date
The Equip page (`/<house>/team`) SHALL show the active House's team for today (Europe/Madrid) by default and for any past or future date the director selects. Each member SHALL appear once, with their membership start and their position on that date or `Sense lloc assignat`. When the selected date is not today, the page SHALL state the shown date clearly and offer a way back to today. An invalid date MUST fall back to today.

#### Scenario: Default is today's team
- **WHEN** the director opens `/paulo-freire/team`
- **THEN** the current members of Paulo Freire are listed with their positions or `Sense lloc assignat`

#### Scenario: Before and after a transfer
- **WHEN** Ana's Paulo Freire membership ends on 2026-06-30, her Carme Aymerich membership starts on 2026-07-01, and the director views Paulo Freire on 2026-06-30 and then on 2026-07-01
- **THEN** Ana is listed on 2026-06-30 and not on 2026-07-01, and each date shows her position from the dated assignments

#### Scenario: Madrid date decides today
- **WHEN** a transfer to Carme Aymerich takes effect on 2026-07-01 and the time is 2026-06-30T23:30:00Z
- **THEN** today's Carme Aymerich team includes the transferred employee

#### Scenario: Winter boundary
- **WHEN** a membership starts on 2026-12-01 and the time is 2026-11-30T23:30:00Z (00:30 in Madrid, winter offset)
- **THEN** the employee is part of today's team

#### Scenario: Returning employee appears once
- **WHEN** an employee had a Paulo Freire membership in 2025, a gap, and a new Paulo Freire membership from 2026-03-01
- **THEN** on any date in 2026 after 2026-03-01 the employee appears once, and the history shows both periods

### Requirement: Positions view
The Equip page SHALL offer a positions view listing every position of the active House, grouped by role, with its occupant on the selected date or `Vacant`. Vacancies, empty lists and future periods SHALL be shown as neutral information and MUST NOT use the honey accent colour.

#### Scenario: Vacant and occupied positions
- **WHEN** Paulo Freire has "ER 1" occupied by Laia and "ER 2" without an active assignment on the selected date
- **THEN** the positions view lists "ER 1 · Laia" and "ER 2 · Vacant" under Educadora referent

### Requirement: Former members
The Equip page SHALL offer a `Membres anteriors` view listing employees who had a completed membership in the active House and are not members of it today, with the dates of their last period there.

#### Scenario: Transferred employee is a former member
- **WHEN** today is 2026-08-01 and Ana's Paulo Freire membership ended on 2026-06-30
- **THEN** Ana appears in Paulo Freire's `Membres anteriors` and not in its current team

### Requirement: Individual history
The director SHALL be able to open an employee's history from a House the employee has had a membership in. It SHALL show the employee's name, every membership period with its House and every position assignment with its position and House, including future periods, ordered by date.

#### Scenario: History across Houses
- **WHEN** the director opens Ana's history from Carme Aymerich after her transfer
- **THEN** it shows her Paulo Freire period with its position and her Carme Aymerich period with its position, each labelled with its House

### Requirement: Positions page
The director SHALL be able to open a `Llocs de treball` page per House listing positions with today's occupant or `Vacant`, and a page per position showing its occupancy history with actions to relabel it, assign an occupant or replace the occupant.

#### Scenario: Position history after turnover
- **WHEN** "ER 1" was held by Marta until 2026-06-30 and by Ana from 2026-07-01
- **THEN** the "ER 1" page lists both periods in date order on the same position
