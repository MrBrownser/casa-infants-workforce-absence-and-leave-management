import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { isEnabledDirectorGrant } from '@/server/access-store';

export { isEnabledDirectorGrant };

export const NO_ACCESS_PATH = '/no-access';

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

function displayName(user: ClerkUserLike): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

// One Clerk Backend API call per request, however many callers check auth.
const getCurrentUser = cache(() => currentUser());

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authorized');
  return { userId: user.id, name: displayName(user) };
}

// Per-request caches only (React `cache`): a revoked grant stops working on the
// next request. Never cache grants across requests.
const getUserId = cache(async () => (await auth()).userId);
const getGrant = cache((clerkUserId: string) => prisma.accessGrant.findUnique({ where: { clerkUserId } }));

/**
 * Director-only gate for House pages, House and staffing data, and staffing
 * Server Functions. Users without an enabled grant are redirected to
 * /no-access. Call it in every page, data function and Server Function, not
 * only in a layout: layouts and pages render in parallel.
 */
export async function requireDirector(): Promise<{ userId: string }> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authorized');
  if (!isEnabledDirectorGrant(await getGrant(userId))) redirect(NO_ACCESS_PATH);
  return { userId };
}
