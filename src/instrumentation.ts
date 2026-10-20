import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

// Server-side error tracking (Next.js instrumentation hook). Off without a DSN.
export function register() {
  Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));
}

// Reports errors thrown while rendering, in route handlers and Server Functions.
export const onRequestError = Sentry.captureRequestError;
