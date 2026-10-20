## ADDED Requirements

### Requirement: Error reporting without personal data
When an error tracking DSN is configured, the system SHALL report unhandled server errors (rendering, route handlers, Server Functions), unhandled browser errors and errors caught by the House error boundary to the error tracker. Reports MUST NOT include the signed-in user, cookies, request headers, request bodies, query strings, breadcrumbs or extra data, and MUST NOT include performance traces or session replays. Without a DSN, nothing is reported.

#### Scenario: No DSN
- **WHEN** the app runs without `NEXT_PUBLIC_SENTRY_DSN`
- **THEN** no error report is sent anywhere

#### Scenario: Error in production
- **WHEN** a Server Function throws an unexpected error in production with a DSN configured
- **THEN** the error tracker receives the error type, message, stack and the request path, and no user, cookie, header, body or query data
