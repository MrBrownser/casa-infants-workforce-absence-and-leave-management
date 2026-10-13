import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { getPersonDetails, getTeam, getVacantSeats } from '@/server/people';
import TeamPage from './page';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/server/people', () => ({
  getTeam: vi.fn(),
  getPersonDetails: vi.fn(),
  getVacantSeats: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const props = (house: string) => ({
  params: Promise.resolve({ house }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => vi.clearAllMocks());

describe('Equip page', () => {
  it('rejects a non-director before reading any team data', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(TeamPage(props('paulo-freire'))).rejects.toThrow('NEXT_REDIRECT');
    expect(getTeam).not.toHaveBeenCalled();
    expect(getPersonDetails).not.toHaveBeenCalled();
    expect(getVacantSeats).not.toHaveBeenCalled();
  });

  it('404s an unknown House without reading the team', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    await expect(TeamPage(props('nowhere'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getTeam).not.toHaveBeenCalled();
  });
});
