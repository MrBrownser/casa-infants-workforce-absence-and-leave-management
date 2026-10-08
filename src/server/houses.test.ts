import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getHouseBySlug } from './houses';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    house: { findUnique: vi.fn() },
  },
}));

beforeEach(() => vi.clearAllMocks());

describe('House data for a non-director', () => {
  beforeEach(() => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
  });

  it('stops before any query', async () => {
    await expect(getHouseBySlug('paulo-freire')).rejects.toThrow('NEXT_REDIRECT');
    expect(prisma.house.findUnique).not.toHaveBeenCalled();
  });
});

describe('House data for the director', () => {
  beforeEach(() => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1' });
  });

  it('looks a House up by slug', async () => {
    vi.mocked(prisma.house.findUnique).mockResolvedValue({ id: 'pf', slug: 'paulo-freire', name: 'Paulo Freire' } as never);
    await expect(getHouseBySlug('paulo-freire')).resolves.toEqual({ id: 'pf', slug: 'paulo-freire', name: 'Paulo Freire' });
    expect(prisma.house.findUnique).toHaveBeenCalledWith({ where: { slug: 'paulo-freire' } });
  });
});
