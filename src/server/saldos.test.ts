import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { listApsOf, listOpeningBalancesOf } from './aps-store';
import { listPeopleOf } from './people-store';
import { getSaldos } from './saldos';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('./people-store', () => ({ listPeopleOf: vi.fn(async () => []) }));
vi.mock('./aps-store', () => ({
  listApsOf: vi.fn(async () => []),
  listOpeningBalancesOf: vi.fn(async () => new Map()),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const roger = { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire' as const, postKey: 'et', seat: 1, startedOn: '2025-09-01', active: true };

beforeEach(() => vi.clearAllMocks());

describe('getSaldos', () => {
  it('stops a non-director before any query', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(getSaldos('paulo-freire', 2026)).rejects.toThrow('NEXT_REDIRECT');
    expect(listPeopleOf).not.toHaveBeenCalled();
  });

  it('reads the people, their openings and APs of the year, and builds the view', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
    vi.mocked(listPeopleOf).mockResolvedValue([roger]);
    vi.mocked(listOpeningBalancesOf).mockResolvedValue(new Map([[ID, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]]));
    const view = await getSaldos('paulo-freire', 2026);
    expect(listPeopleOf).toHaveBeenCalledWith({}, 'paulo-freire');
    expect(listOpeningBalancesOf).toHaveBeenCalledWith({}, [ID], 2026);
    expect(listApsOf).toHaveBeenCalledWith({}, [ID], 2026);
    expect(view.rows[0].balances.surplusMinutes).toBe(-240);
    expect(view.totals.owePeople).toBe(1);
  });
});
