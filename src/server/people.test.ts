import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { findOpeningBalances, findPerson, listActivePeople, listPeopleOf } from './people-store';
import { getPersonDetails, getTeam, getVacantSeats } from './people';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('./people-store', () => ({
  listPeopleOf: vi.fn(async () => []),
  listActivePeople: vi.fn(async () => []),
  findPerson: vi.fn(async () => null),
  findOpeningBalances: vi.fn(async () => null),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const aina = { id: ID, fullName: 'Aina Martín Serra', house: 'carme-aymerich' as const, postKey: 'tft', seat: 1, startedOn: '2026-07-01', active: true };

beforeEach(() => vi.clearAllMocks());

describe('for a non-director', () => {
  it('stops before any query', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(getTeam('paulo-freire')).rejects.toThrow('NEXT_REDIRECT');
    await expect(getVacantSeats()).rejects.toThrow('NEXT_REDIRECT');
    await expect(getPersonDetails('paulo-freire', ID, 2026)).rejects.toThrow('NEXT_REDIRECT');
    expect(listPeopleOf).not.toHaveBeenCalled();
    expect(listActivePeople).not.toHaveBeenCalled();
    expect(findPerson).not.toHaveBeenCalled();
  });
});

describe('for the director', () => {
  beforeEach(() => vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' }));

  it('builds the team of the House', async () => {
    const team = await getTeam('paulo-freire');
    expect(listPeopleOf).toHaveBeenCalledWith({}, 'paulo-freire');
    expect(team.posts).toHaveLength(7);
  });

  it('shows prorated defaults when nothing is stored', async () => {
    vi.mocked(findPerson).mockResolvedValue(aina);
    await expect(getPersonDetails('carme-aymerich', ID, 2026)).resolves.toEqual({
      person: aina,
      year: 2026,
      balances: { vacationDays: 16, carriedDays: 0, surplusMinutes: 0 },
      stored: false,
    });
  });

  it('returns the stored balances', async () => {
    vi.mocked(findPerson).mockResolvedValue(aina);
    vi.mocked(findOpeningBalances).mockResolvedValue({ vacationDays: 20, carriedDays: 1, surplusMinutes: -60 });
    await expect(getPersonDetails('carme-aymerich', ID, 2026)).resolves.toMatchObject({ stored: true, balances: { vacationDays: 20 } });
  });

  it('hides a person of the other House', async () => {
    vi.mocked(findPerson).mockResolvedValue(aina);
    await expect(getPersonDetails('paulo-freire', ID, 2026)).resolves.toBeNull();
    expect(findOpeningBalances).not.toHaveBeenCalled();
  });

  it('ignores an id that is not a UUID without querying', async () => {
    await expect(getPersonDetails('paulo-freire', 'nope', 2026)).resolves.toBeNull();
    expect(findPerson).not.toHaveBeenCalled();
  });
});
