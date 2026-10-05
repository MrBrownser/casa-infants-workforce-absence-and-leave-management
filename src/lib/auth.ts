import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const NO_ACCESS_PATH = '/no-access';

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  publicMetadata?: Record<string, unknown>;
};

function displayName(user: ClerkUserLike): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('Not authorized');
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
  const user = await currentUser();
  if (!user) throw new Error('Not authorized');
  if (!isDirector(user)) redirect(NO_ACCESS_PATH);
  return { userId: user.id, name: displayName(user) };
}
