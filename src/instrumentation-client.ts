import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

// Browser-side error tracking (unhandled errors and rejections). Off without a DSN.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
