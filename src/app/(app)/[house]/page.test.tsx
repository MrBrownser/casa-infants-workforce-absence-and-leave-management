import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound, redirect } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import HouseHomePage from './page';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const params = (house: string) => ({ params: Promise.resolve({ house }) });

beforeEach(() => vi.clearAllMocks());

describe('House home', () => {
  it('redirects the director to the first available section', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    await expect(HouseHomePage(params('carme-aymerich'))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/carme-aymerich/team');
  });

  it('checks the director before redirecting', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(HouseHomePage(params('carme-aymerich'))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('404s an unknown House', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    await expect(HouseHomePage(params('nowhere'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
