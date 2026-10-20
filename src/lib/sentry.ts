import type { ErrorEvent } from '@sentry/nextjs';

/**
 * Sentry options shared by the server (src/instrumentation.ts) and the browser
 * (src/instrumentation-client.ts). Off without a DSN (local dev, previews, CI).
 * Errors only: no performance tracing, no session replay, nothing about the
 * person signed in or the request beyond its path. *Why:* the pages show staff
 * names and leave data (GDPR), and error tracking needs none of it.
 */
export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: () => null,
  };
}

/** Drops everything that could carry personal data before an event leaves the app. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  if (event.request) {
    const url = event.request.url?.split('?')[0];
    event.request = url ? { url } : {};
  }
  return event;
}
