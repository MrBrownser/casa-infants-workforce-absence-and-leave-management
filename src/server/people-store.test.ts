// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import {
  InvalidSeatError,
  SeatTakenError,
  addPerson,
  deactivatePerson,
  listPeopleOf,
  placePerson,
  saveOpeningBalances,
} from './people-store';

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';

function fakeDb(occupants: (string | null)[] = [null]) {
  const findFirst = vi.fn();
  for (const name of occupants) findFirst.mockResolvedValueOnce(name ? { fullName: name } : null);
  findFirst.mockResolvedValue(null);
  return {
    house: { findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => ({ id: `id-${where.slug}` })) },
    person: {
      findFirst,
      create: vi.fn(async () => ({ id: ID })),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    personYear: { upsert: vi.fn(async () => ({})), findUnique: vi.fn(async () => null) },
  };
}
const asDb = (db: ReturnType<typeof fakeDb>) => db as unknown as PrismaClient;
const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('addPerson', () => {
  it('adds a person to a vacant House seat', async () => {
    const db = fakeDb();
    await expect(
      addPerson(asDb(db), { fullName: 'Carla Ribas Solé', startedOn: '2025-09-01', seat: { house: 'paulo-freire', postKey: 'er', seat: 1 } }),
    ).resolves.toBe(ID);
    expect(db.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true, houseId: 'id-paulo-freire', postKey: 'er', seat: 1 } }),
    );
    expect(db.person.create).toHaveBeenCalledWith({
      data: { fullName: 'Carla Ribas Solé', houseId: 'id-paulo-freire', postKey: 'er', seat: 1, startedOn: new Date('2025-09-01T00:00:00Z'), active: true },
      select: { id: true },
    });
  });

  it('adds a person to a shared seat with no House', async () => {
    const db = fakeDb();
    await addPerson(asDb(db), { fullName: 'Meritxell Torres Vila', startedOn: null, seat: { house: null, postKey: 'pdg', seat: 1 } });
    expect(db.house.findUnique).not.toHaveBeenCalled();
    expect(db.person.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ houseId: null, startedOn: null }) }));
  });

  it('rejects an occupied seat naming the occupant', async () => {
    const db = fakeDb(['Carla Ribas Solé']);
    const error = await addPerson(asDb(db), { fullName: 'Nova', startedOn: null, seat: { house: 'paulo-freire', postKey: 'er', seat: 1 } }).catch((e) => e);
    expect(error).toBeInstanceOf(SeatTakenError);
    expect(error.occupant).toBe('Carla Ribas Solé');
    expect(db.person.create).not.toHaveBeenCalled();
  });

  it('turns a unique violation (two requests at once) into SeatTakenError', async () => {
    const db = fakeDb([null, 'Laia Vidal Mas']);
    db.person.create.mockRejectedValueOnce(uniqueViolation());
    const error = await addPerson(asDb(db), { fullName: 'Nova', startedOn: null, seat: { house: 'carme-aymerich', postKey: 'er', seat: 1 } }).catch((e) => e);
    expect(error).toBeInstanceOf(SeatTakenError);
    expect(error.occupant).toBe('Laia Vidal Mas');
  });

  it('rejects an unknown seat before any query', async () => {
    const db = fakeDb();
    await expect(
      addPerson(asDb(db), { fullName: 'Nova', startedOn: null, seat: { house: 'paulo-freire', postKey: 'er', seat: 2 } }),
    ).rejects.toBeInstanceOf(InvalidSeatError);
    expect(db.person.findFirst).not.toHaveBeenCalled();
  });
});

describe('placePerson', () => {
  it('moves or reactivates into a vacant seat, ignoring the person’s own row', async () => {
    const db = fakeDb();
    await placePerson(asDb(db), ID, { house: 'carme-aymerich', postKey: 'et', seat: 1 });
    expect(db.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true, houseId: 'id-carme-aymerich', postKey: 'et', seat: 1, NOT: { id: ID } } }),
    );
    expect(db.person.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { houseId: 'id-carme-aymerich', postKey: 'et', seat: 1, active: true },
    });
  });
});

describe('deactivatePerson', () => {
  it('keeps the last seat for reference', async () => {
    const db = fakeDb();
    await deactivatePerson(asDb(db), ID);
    expect(db.person.update).toHaveBeenCalledWith({ where: { id: ID }, data: { active: false } });
  });
});

describe('saveOpeningBalances', () => {
  it('creates or replaces the row of that year', async () => {
    const db = fakeDb();
    const balances = { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 };
    await saveOpeningBalances(asDb(db), ID, 2026, balances);
    expect(db.personYear.upsert).toHaveBeenCalledWith({
      where: { personId_year: { personId: ID, year: 2026 } },
      create: { personId: ID, year: 2026, ...balances },
      update: balances,
    });
  });
});

describe('listPeopleOf', () => {
  it('reads the House and the shared posts and maps rows to records', async () => {
    const db = fakeDb();
    db.person.findMany.mockResolvedValueOnce([
      { id: ID, fullName: 'Pol Jiménez Alcover', postKey: 'ct', seat: 1, startedOn: new Date('2025-09-01T00:00:00Z'), active: true, house: { slug: 'paulo-freire' } },
      { id: 'b', fullName: 'Meritxell Torres Vila', postKey: 'pdg', seat: 1, startedOn: null, active: true, house: null },
    ] as never);
    // Sorted by name (Catalan collation).
    await expect(listPeopleOf(asDb(db), 'paulo-freire')).resolves.toEqual([
      { id: 'b', fullName: 'Meritxell Torres Vila', house: null, postKey: 'pdg', seat: 1, startedOn: null, active: true },
      { id: ID, fullName: 'Pol Jiménez Alcover', house: 'paulo-freire', postKey: 'ct', seat: 1, startedOn: '2025-09-01', active: true },
    ]);
    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ house: { slug: 'paulo-freire' } }, { houseId: null }] } }),
    );
  });
});
