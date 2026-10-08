import { Fragment } from 'react';

/**
 * Gives its children a new identity on every server render, so a form never survives a redirect
 * back to its own route (React keeps client state when only the search params change, which would
 * keep the old operation ID and make the next submit look like a retry). Within one render the
 * key is fixed, so preview, confirm and double clicks still share one operation ID (design D5).
 */
export function FreshForm({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Fragment key={crypto.randomUUID()}>{children}</Fragment>;
}
