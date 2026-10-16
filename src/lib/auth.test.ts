import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NO_ACCESS_PATH, SIGN_IN_PATH, isDirector, requireDirector, requireUser } from './auth';

// React's per-request cache would memoize across tests outside RSC: pass it through.
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

function user(publicMetadata: Record<string, unknown>) {
  return { id: 'user_1', firstName: 'Marta', lastName: 'Soler', publicMetadata } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('isDirector', () => {
  it('is true only for role director', () => {
    expect(isDirector({ publicMetadata: { role: 'director' } })).toBe(true);
    expect(isDirector({ publicMetadata: { role: 'Director' } })).toBe(false);
    expect(isDirector({ publicMetadata: {} })).toBe(false);
    expect(isDirector({})).toBe(false);
    expect(isDirector(null)).toBe(false);
  });
});

describe('requireDirector', () => {
  it('returns the director', async () => {
    vi.mocked(currentUser).mockResolvedValue(user({ role: 'director' }));
    await expect(requireDirector()).resolves.toEqual({ userId: 'user_1', name: 'Marta Soler' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects a signed-in non-director to /no-access', async () => {
    vi.mocked(currentUser).mockResolvedValue(user({}));
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(NO_ACCESS_PATH);
  });

  it('redirects a signed-out request to sign in', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    await expect(requireDirector()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(SIGN_IN_PATH);
  });
});

describe('requireUser', () => {
  it('returns any signed-in user', async () => {
    vi.mocked(currentUser).mockResolvedValue(user({}));
    await expect(requireUser()).resolves.toEqual({ userId: 'user_1', name: 'Marta Soler' });
  });

  it('redirects a signed-out request to sign in', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(SIGN_IN_PATH);
  });
});
