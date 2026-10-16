# house-context Specification

## Purpose
TBD - created by archiving change house-context. Update Purpose after archive.

## Requirements

### Requirement: Available Houses
The system SHALL contain exactly two Houses, Paulo Freire (slug `paulo-freire`) and Carme Aymerich (slug `carme-aymerich`), present in every environment without manual data entry.

#### Scenario: Houses exist after migration
- **WHEN** the database migrations have been applied to an empty database
- **THEN** the House table contains Paulo Freire and Carme Aymerich with slugs `paulo-freire` and `carme-aymerich`

#### Scenario: Code and database agree on Houses
- **WHEN** the application resolves a House slug
- **THEN** the set of valid slugs in code matches the Houses inserted by the migration

### Requirement: Active House in the URL
House-specific functionality SHALL operate under exactly one active House, identified by the first path segment of the URL (`/<house-slug>/...`). An unknown House slug MUST result in a not-found page.

#### Scenario: Director selects Paulo Freire
- **WHEN** the director opens `/paulo-freire`
- **THEN** Paulo Freire is the active House and House-scoped content uses Paulo Freire as its context

#### Scenario: Unknown House
- **WHEN** a user opens `/casa-inexistent/team`
- **THEN** the system responds with a not-found page

### Requirement: Active House is always identifiable
Every House-scoped page SHALL show which House is active, both in the House switcher (marked as the current option) and in the page header.

#### Scenario: Active House is marked
- **WHEN** the director views any page under `/carme-aymerich/`
- **THEN** the switcher marks Carme Aymerich as current (`aria-current="page"`) and the page header shows "Carme Aymerich"

#### Scenario: Active House is not shown in honey
- **WHEN** the switcher renders the active House
- **THEN** it uses the secondary (Salvia clara) selected style and does not use the accent (honey) color

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

### Requirement: Last active House is remembered
The system SHALL remember the last visited House in an `active-house` cookie and SHALL redirect `/dashboard` to that House. Without a valid cookie, `/dashboard` MUST redirect to Paulo Freire. The cookie MUST NOT be used for authorization or to scope data queries.

#### Scenario: Return to last House
- **WHEN** the director last visited `/carme-aymerich/team` and later opens `/dashboard`
- **THEN** the system redirects to `/carme-aymerich`

#### Scenario: No or invalid cookie
- **WHEN** the `active-house` cookie is missing or holds an unknown slug and the director opens `/dashboard`
- **THEN** the system redirects to `/paulo-freire`

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

### Requirement: Product sections
House-scoped navigation SHALL list, in this order, the sections Saldos (`saldos`), Vacances (`vacances`), El mes (`mes`) and Equip (`team`), in the top bar on desktop and in the bottom tab bar on mobile. A section whose screens are not built yet MUST be shown as not available ("aviat") and MUST NOT be a link. Making a section available MUST only require changing its definition and adding its route.

#### Scenario: Sections in this release
- **WHEN** the director opens any page of Paulo Freire
- **THEN** the navigation shows Saldos as a link to `/paulo-freire/saldos`, Vacances and El mes marked "aviat" and not clickable, and Equip as a link to `/paulo-freire/team`

#### Scenario: Unavailable section URL
- **WHEN** the director opens `/paulo-freire/mes` before El mes is available
- **THEN** the system responds with a not-found page

### Requirement: House home opens the first available section
Opening a House home (`/<house-slug>`) SHALL redirect to the first available section of that House, after checking director access.

#### Scenario: House home in this release
- **WHEN** the director opens `/carme-aymerich`
- **THEN** the browser is redirected to `/carme-aymerich/saldos`

### Requirement: Signed-out visitors are sent to sign in
A request without a signed-in user to a House-scoped page, a House data function or a Server Function SHALL be redirected to the sign-in page (`/sign-in`) without reading or writing House data. It MUST NOT end in a server error.

#### Scenario: Signed-out page request
- **WHEN** a request without a session opens `/paulo-freire/saldos`
- **THEN** the response redirects to `/sign-in` (or the proxy's sign-in redirect) and no server error is logged

#### Scenario: Signed-out data call
- **WHEN** a House data function or a Server Function runs without a signed-in user
- **THEN** it stops with a redirect to `/sign-in` before any House data is read or written

### Requirement: Access by invitation only
The application SHALL NOT offer self sign-up: the public pages MUST NOT show a sign-up action and there MUST NOT be a sign-up route. Accounts are created by invitation from the auth provider's dashboard.

#### Scenario: Landing page signed out
- **WHEN** a signed-out visitor opens `/`
- **THEN** the page offers "Inicia la sessió" and no "Crea un compte" action

#### Scenario: Sign-up URL
- **WHEN** a visitor opens `/sign-up`
- **THEN** the application does not render a sign-up form
