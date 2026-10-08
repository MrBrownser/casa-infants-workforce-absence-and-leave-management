import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import * as queries from './staffing-queries';
import {
  loadEmployeeHistory,
  loadEmployeeOptions,
  loadMemberOptions,
  loadPositionDetail,
  loadPositionRows,
  loadTeamView,
} from './staffing';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { tag: 'prisma' } }));
vi.mock('@/lib/dates', async (orig) => ({ ...(await orig<typeof import('@/lib/dates')>()), todayInMadrid: () => '2026-10-08' }));
vi.mock('./staffing-queries', () => ({
  getTeamView: vi.fn().mockResolvedValue({ people: [], positions: [], former: [] }),
  getEmployeeHistory: vi.fn().mockResolvedValue(null),
  getPositionDetail: vi.fn().mockResolvedValue(null),
  listPositionRows: vi.fn().mockResolvedValue([]),
  listMemberOptions: vi.fn().mockResolvedValue([]),
  listEmployeeOptions: vi.fn().mockResolvedValue([]),
}));

const calls = [
  () => loadTeamView('pf', '2026-07-01'),
  () => loadEmployeeHistory('pf', 'e1'),
  () => loadPositionDetail('pf', 'p1'),
  () => loadPositionRows('pf', '2026-07-01'),
  () => loadMemberOptions('pf', '2026-07-01'),
  () => loadEmployeeOptions('pf'),
];

beforeEach(() => vi.clearAllMocks());

describe('staffing reads for a user without a grant (AC-018)', () => {
  it('stop before any query', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    for (const call of calls) await expect(call()).rejects.toThrow('NEXT_REDIRECT');
    for (const fn of Object.values(queries)) if (vi.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('staffing reads for the director', () => {
  it('pass the House and dates through, with today in Madrid for former members', async () => {
    vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1' });
    await loadTeamView('pf', '2026-07-01');
    expect(queries.getTeamView).toHaveBeenCalledWith({ tag: 'prisma' }, 'pf', '2026-07-01', '2026-10-08');
    await loadEmployeeOptions('pf');
    expect(queries.listEmployeeOptions).toHaveBeenCalledWith({ tag: 'prisma' }, 'pf', '2026-10-08');
  });
});
