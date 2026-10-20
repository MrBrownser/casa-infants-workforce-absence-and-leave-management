// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubEvent, sentryOptions } from './sentry';

describe('sentryOptions', () => {
  it('is off without a DSN', () => {
    expect(sentryOptions(undefined).enabled).toBe(false);
    expect(sentryOptions('').enabled).toBe(false);
  });

  it('reports errors only, with no personal data', () => {
    const options = sentryOptions('https://key@o1.ingest.de.sentry.io/1');
    expect(options.enabled).toBe(true);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.beforeBreadcrumb()).toBeNull();
  });
});

describe('scrubEvent', () => {
  it('keeps the error and the path, drops user, request details, extra and breadcrumbs', () => {
    const event = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: 'boom' }] },
      user: { id: 'user_1', email: 'director@example.org' },
      extra: { person: 'Marta Soler' },
      breadcrumbs: [{ message: 'Marta Soler' }],
      request: {
        url: 'https://app.example/paulo-freire/saldos?person=0b6f2a52',
        cookies: { __session: 'x' },
        headers: { cookie: 'x' },
        data: { fullName: 'Marta Soler' },
        query_string: 'person=0b6f2a52',
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.exception?.values?.[0]?.value).toBe('boom');
    expect(scrubbed.request).toEqual({ url: 'https://app.example/paulo-freire/saldos' });
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(JSON.stringify(scrubbed)).not.toContain('Marta');
  });
});
