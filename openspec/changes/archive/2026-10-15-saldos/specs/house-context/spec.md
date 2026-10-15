## MODIFIED Requirements

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
