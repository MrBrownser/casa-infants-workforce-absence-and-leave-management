## MODIFIED Requirements

### Requirement: Switch active House
The director SHALL be able to switch between Paulo Freire and Carme Aymerich from the House switcher on every House-scoped page. Switching MUST keep the current section and MUST NOT create, modify, move or delete any business data.

#### Scenario: Director switches to Carme Aymerich
- **WHEN** the director is on `/paulo-freire/team` and selects Carme Aymerich
- **THEN** the browser navigates to `/carme-aymerich/team` and Carme Aymerich information is shown

#### Scenario: Switching writes nothing
- **WHEN** the director switches the active House any number of times
- **THEN** no House, Person or person-year record is created, changed or deleted

### Requirement: Navigation preserves the active House
Section navigation links on a House-scoped page SHALL point to sections of the same active House.

#### Scenario: Navigation keeps Paulo Freire
- **WHEN** Paulo Freire is active and the director follows any available section link
- **THEN** every visited URL starts with `/paulo-freire` and Paulo Freire remains active

### Requirement: Director-only access
Only signed-in users whose Clerk public metadata has `role` equal to `director` SHALL access House-scoped pages and House data. Other signed-in users MUST be redirected to a "Sense accés" page (`/no-access`) with an icon and explanatory text. Every House-scoped page, every server-side House data function and every Server Function MUST perform this check itself, not rely on a parent layout.

#### Scenario: Director enters
- **WHEN** a signed-in user with `role = director` opens `/paulo-freire/team`
- **THEN** the Equip page of Paulo Freire is shown

#### Scenario: Non-director is blocked
- **WHEN** a signed-in user without `role = director` opens `/paulo-freire/team`
- **THEN** the user is redirected to `/no-access`, the "Sense accés" page is shown, and no person names are rendered

#### Scenario: Data layer rejects non-director
- **WHEN** a House data function or a Server Function is called in a request from a non-director user
- **THEN** it stops with a redirect to `/no-access` without reading or writing House data

## ADDED Requirements

### Requirement: Product sections
House-scoped navigation SHALL list, in this order, the sections Saldos (`saldos`), Vacances (`vacances`), El mes (`mes`) and Equip (`team`), in the top bar on desktop and in the bottom tab bar on mobile. A section whose screens are not built yet MUST be shown as not available ("aviat") and MUST NOT be a link. Making a section available MUST only require changing its definition and adding its route.

#### Scenario: Sections in this release
- **WHEN** the director opens any page of Paulo Freire
- **THEN** the navigation shows Saldos, Vacances and El mes marked "aviat" and not clickable, and Equip as a link to `/paulo-freire/team`

#### Scenario: Unavailable section URL
- **WHEN** the director opens `/paulo-freire/saldos` before Saldos is available
- **THEN** the system responds with a not-found page

### Requirement: House home opens the first available section
Opening a House home (`/<house-slug>`) SHALL redirect to the first available section of that House, after checking director access.

#### Scenario: House home in this release
- **WHEN** the director opens `/carme-aymerich`
- **THEN** the browser is redirected to `/carme-aymerich/team`
