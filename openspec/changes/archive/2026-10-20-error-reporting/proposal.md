## Why

Vercel Hobby keeps runtime logs for one hour, so a failed page or Server Function in
production goes unseen unless the director reports it (#17). The product owner created a
Sentry account; errors should reach it without sending any personal data (GDPR).

Light change: no new screens or domain rules, so no brainstorm, design or plan.

## What Changes

- `@sentry/nextjs` on the server (`src/instrumentation.ts`: `register`, `onRequestError`) and in
  the browser (`src/instrumentation-client.ts`); the House error boundary also reports.
- On only when `NEXT_PUBLIC_SENTRY_DSN` is set (production); off in dev, previews and CI.
- Errors only: no performance tracing, no session replay, no breadcrumbs, `sendDefaultPii` off,
  and a filter that drops user, cookies, headers, body, query string and extra data.
- No build wrapper and no source-map upload yet (no auth token to manage).

## Capabilities

### Modified Capabilities

- `operations`: error reporting without personal data.

## Non-goals

- Performance monitoring, session replay, alert rules beyond Sentry's defaults.
- Source maps (later, with `withSentryConfig` and an auth token, if stack traces are unreadable).

## Impact

- New dependency `@sentry/nextjs` (no new `npm audit` advisories). New sub-processor for GDPR:
  Sentry, EU region (data in Germany); the org must be created in the EU region.
