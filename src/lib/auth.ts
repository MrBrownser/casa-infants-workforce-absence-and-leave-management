import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export const NO_ACCESS_PATH = '/no-access';
export const SIGN_IN_PATH = '/sign-in';

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  publicMetadata?: Record<string, unknown>;
};

function displayName(user: ClerkUserLike): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

// One Clerk Backend API call per request, however many callers check auth.
const getCurrentUser = cache(() => currentUser());

/**
 * Without a signed-in user, redirect to sign in rather than throw: the proxy
 * can let a non-browser request through (e.g. curl without Clerk's dev-browser
 * cookie), and a thrown error would answer 500. A redirect still stops a Server
 * Function before it reads or writes anything.
 */
async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}

export async function requireUser() {
  const user = await signedInUser();
  return { userId: user.id, name: displayName(user) };
}

/** Temporary role check until SPEC-002 models roles: set by hand in the Clerk dashboard. */
export function isDirector(user: { publicMetadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.publicMetadata?.role === 'director';
}

/**
 * Director-only gate for House pages and House data. Everyone else is
 * redirected to /no-access. Call it in every page and data function, not only
 * in a layout: layouts and pages render in parallel, so a layout check alone
 * does not stop a page's queries.
 */
export async function requireDirector() {
  const user = await signedInUser();
  if (!isDirector(user)) redirect(NO_ACCESS_PATH);
  return { userId: user.id, name: displayName(user) };
}
