// src/server/aps-store.test.ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { ApRuleError, createAp, deleteAp, findAp, listApsOf, listOpeningBalancesOf, type NewAp } from './aps-store';

const PERSON = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';

function fakeDb({
  locked = true,
  stored = null as { vacationDays: number; carriedDays: number; surplusMinutes: number } | null,
  existing = [] as { kind: 'non_recoverable' | 'recoverable'; minutes: number }[],
} = {}) {
  const db = {
    $queryRaw: vi.fn(async () => (locked ? [{ id: PERSON }] : [])),
    house: { findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => ({ id: `id-${where.slug}` })) },
    person: { findUnique: vi.fn(async () => ({ startedOn: null })) },
    personYear: { findUnique: vi.fn(async () => stored), findMany: vi.fn(async () => [] as unknown[]) },
    ap: {
      findMany: vi.fn(async () => existing as unknown[]),
      findUnique: vi.fn(async () => null as unknown),
      create: vi.fn(async () => ({ id: AP_ID })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  return Object.assign(db, { $transaction: vi.fn<(fn: (tx: typeof db) => unknown, options?: unknown) => Promise<unknown>>(async (fn) => fn(db)) });
}
const asDb = (db: ReturnType<typeof fakeDb>) => db as unknown as PrismaClient;

const input: NewAp = { personId: PERSON, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240 };

describe('createAp', () => {
  it('locks the person, checks the rules and inserts, in one transaction', async () => {
    const db = fakeDb();
    await expect(createAp(asDb(db), input)).resolves.toBe(AP_ID);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // The row lock only prevents a sixth AP when each statement takes its own snapshot.
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    const [strings, ...values] = db.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?')).toContain('FOR UPDATE');
    expect(values).toEqual([PERSON]);
    // The lock comes before reading the APs it protects.
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.ap.findMany.mock.invocationCallOrder[0]);
    expect(db.ap.findMany).toHaveBeenCalledWith({ where: { personId: PERSON, year: 2026 }, select: { kind: true, minutes: true } });
    expect(db.ap.create).toHaveBeenCalledWith({
      data: { personId: PERSON, houseId: 'id-paulo-freire', kind: 'non_recoverable', year: 2026, date: new Date('2026-02-20T00:00:00Z'), minutes: 240 },
      select: { id: true },
    });
  });

  it('rejects a sixth AP no recuperable with the Catalan message', async () => {
    const db = fakeDb({ existing: Array.from({ length: 5 }, () => ({ kind: 'non_recoverable' as const, minutes: 60 })) });
    const error = await createAp(asDb(db), input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApRuleError);
    expect((error as Error).message).toBe("Ja ha fet servir els 5 dies que permet aquest tipus d'AP.");
    expect(db.ap.create).not.toHaveBeenCalled();
  });

  it('never blocks an AP recuperable for lack of surplus (default balances when none are stored)', async () => {
    const db = fakeDb();
    await expect(createAp(asDb(db), { ...input, kind: 'recoverable', minutes: 360 })).resolves.toBe(AP_ID);
  });

  it('uses the stored opening balances of that year', async () => {
    const db = fakeDb({ stored: { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 } });
    await createAp(asDb(db), { ...input, kind: 'recoverable' });
    expect(db.personYear.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId_year: { personId: PERSON, year: 2026 } } }),
    );
  });

  it('rejects an unknown person', async () => {
    const db = fakeDb({ locked: false });
    await expect(createAp(asDb(db), input)).rejects.toThrow(new ApRuleError('Persona desconeguda.'));
    expect(db.ap.create).not.toHaveBeenCalled();
  });
});

describe('reads and delete', () => {
  const row = {
    id: AP_ID,
    personId: PERSON,
    kind: 'recoverable',
    year: 2026,
    date: new Date('2027-01-15T00:00:00Z'),
    minutes: 120,
    house: { slug: 'carme-aymerich' },
  };

  it('maps rows to records with ISO dates and the House slug', async () => {
    const db = fakeDb();
    db.ap.findMany.mockResolvedValueOnce([row]);
    await expect(listApsOf(asDb(db), [PERSON], 2026)).resolves.toEqual([
      { id: AP_ID, personId: PERSON, house: 'carme-aymerich', kind: 'recoverable', year: 2026, date: '2027-01-15', minutes: 120 },
    ]);
    expect(db.ap.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { personId: { in: [PERSON] }, year: 2026 } }));
  });

  it('does not query for nobody', async () => {
    const db = fakeDb();
    await expect(listApsOf(asDb(db), [], 2026)).resolves.toEqual([]);
    await expect(listOpeningBalancesOf(asDb(db), [], 2026)).resolves.toEqual(new Map());
    expect(db.ap.findMany).not.toHaveBeenCalled();
    expect(db.personYear.findMany).not.toHaveBeenCalled();
  });

  it('reads the opening balances of many people', async () => {
    const db = fakeDb();
    db.personYear.findMany.mockResolvedValueOnce([{ personId: PERSON, vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]);
    await expect(listOpeningBalancesOf(asDb(db), [PERSON], 2026)).resolves.toEqual(
      new Map([[PERSON, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]]),
    );
  });

  it('finds one AP or null', async () => {
    const db = fakeDb();
    await expect(findAp(asDb(db), AP_ID)).resolves.toBeNull();
    db.ap.findUnique.mockResolvedValueOnce(row);
    await expect(findAp(asDb(db), AP_ID)).resolves.toMatchObject({ id: AP_ID, date: '2027-01-15' });
  });

  it('deletes by id and reports true when it removed the row', async () => {
    const db = fakeDb();
    await expect(deleteAp(asDb(db), AP_ID)).resolves.toBe(true);
    expect(db.ap.deleteMany).toHaveBeenCalledWith({ where: { id: AP_ID } });
  });

  it('reports false, without throwing, when the AP is already gone', async () => {
    const db = fakeDb();
    db.ap.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(deleteAp(asDb(db), AP_ID)).resolves.toBe(false);
  });
});
