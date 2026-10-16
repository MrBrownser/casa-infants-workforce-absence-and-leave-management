## ADDED Requirements

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
