import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { getSaldos } from '@/server/saldos';
import { SaldosContent } from './saldos-content';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/server/saldos', () => ({
  getSaldos: vi.fn(async (_house: string, year: number) => ({
    year,
    rows: [],
    former: [],
    totals: { apnrUsedMinutes: 0, apnrCapMinutes: 0, owePeople: 0, oweMinutes: 0 },
  })),
}));
vi.mock('@/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dates')>()),
  todayInMadrid: () => '2026-10-15',
}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

const props = (house: string, searchParams: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ house }),
  searchParams: Promise.resolve(searchParams),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
});

describe('SaldosContent', () => {
  it('rejects a non-director before reading any balance', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(SaldosContent(props('paulo-freire'))).rejects.toThrow('NEXT_REDIRECT');
    expect(getSaldos).not.toHaveBeenCalled();
  });

  it('404s an unknown House without reading', async () => {
    await expect(SaldosContent(props('nowhere'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getSaldos).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 2026],
    [{ year: '2025' }, 2025],
    [{ year: 'abcd' }, 2026],
    [{ year: '1999' }, 2026],
    [{ year: '2101' }, 2026],
    [{ year: ['2025', '2027'] }, 2026],
  ])('reads %o as the year %i', async (searchParams, year) => {
    await SaldosContent(props('paulo-freire', searchParams));
    expect(getSaldos).toHaveBeenCalledWith('paulo-freire', year);
  });
});
