import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NO_ACCESS_PATH, isDirector, requireDirector } from './auth';

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

  it('rejects a signed-out request', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    await expect(requireDirector()).rejects.toThrow('Not authorized');
  });
});
