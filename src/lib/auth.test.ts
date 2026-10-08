import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { NO_ACCESS_PATH, isEnabledDirectorGrant, requireDirector } from './auth';

// React's per-request cache would memoize across tests outside RSC: pass it through.
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { accessGrant: { findUnique: vi.fn() } } }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const signedIn = (userId: string | null) => vi.mocked(auth).mockResolvedValue({ userId } as never);
const grant = (value: { role: string; revokedAt: Date | null } | null) =>
  vi.mocked(prisma.accessGrant.findUnique).mockResolvedValue(value as never);

beforeEach(() => vi.clearAllMocks());

describe('isEnabledDirectorGrant', () => {
  it('needs role director and no revocation', () => {
    expect(isEnabledDirectorGrant({ role: 'director', revokedAt: null })).toBe(true);
    expect(isEnabledDirectorGrant({ role: 'director', revokedAt: new Date() })).toBe(false);
    expect(isEnabledDirectorGrant({ role: 'Director', revokedAt: null })).toBe(false);
    expect(isEnabledDirectorGrant(null)).toBe(false);
    expect(isEnabledDirectorGrant(undefined)).toBe(false);
  });
});

describe('requireDirector', () => {
  it('lets an enabled grant through and reads it by Clerk user ID', async () => {
    signedIn('user_1');
    grant({ role: 'director', revokedAt: null });
    await expect(requireDirector()).resolves.toEqual({ userId: 'user_1' });
    expect(prisma.accessGrant.findUnique).toHaveBeenCalledWith({ where: { clerkUserId: 'user_1' } });
  });

  it('ignores the old metadata flag: no grant means no access (AC-019)', async () => {
    signedIn('user_1');
    vi.mocked(currentUser).mockResolvedValue({ id: 'user_1', publicMetadata: { role: 'director' } } as never);
    grant(null);
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(NO_ACCESS_PATH);
    expect(currentUser).not.toHaveBeenCalled();
  });

  it('denies a revoked grant', async () => {
    signedIn('user_1');
    grant({ role: 'director', revokedAt: new Date('2026-10-01T00:00:00Z') });
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
  });

  it('rejects a signed-out request before touching the database', async () => {
    signedIn(null);
    await expect(requireDirector()).rejects.toThrow('Not authorized');
    expect(prisma.accessGrant.findUnique).not.toHaveBeenCalled();
  });
});
