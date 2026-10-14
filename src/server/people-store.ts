// People persistence with the Prisma client passed in. No auth and no
// `server-only` here so the dev seed can use it; app code goes through
// src/server/people.ts and the Server Functions, which check the director first.
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { dateToIsoDate, isoDateToDate, type IsoDate } from '@/lib/dates';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import { isValidSeat, type SeatRef } from '@/lib/posts';
import type { OpeningBalances } from '@/lib/rules';
import type { PersonRecord } from '@/lib/team';

export class SeatTakenError extends Error {
  constructor(readonly occupant: string | null) {
    super(`Seat taken by ${occupant ?? 'someone else'}`);
    this.name = 'SeatTakenError';
  }
}

export class InvalidSeatError extends Error {
  constructor(ref: SeatRef) {
    super(`Unknown seat ${ref.house ?? 'shared'}:${ref.postKey}:${ref.seat}`);
    this.name = 'InvalidSeatError';
  }
}

const personSelect = {
  id: true,
  fullName: true,
  postKey: true,
  seat: true,
  startedOn: true,
  active: true,
  house: { select: { slug: true } },
} satisfies Prisma.PersonSelect;

type PersonRow = Prisma.PersonGetPayload<{ select: typeof personSelect }>;

function toRecord(row: PersonRow): PersonRecord {
  const slug = row.house?.slug ?? null;
  if (slug !== null && !isHouseSlug(slug)) throw new Error(`Unknown House ${slug}: keep HOUSES and the houses table in sync.`);
  return {
    id: row.id,
    fullName: row.fullName,
    house: slug,
    postKey: row.postKey,
    seat: row.seat,
    startedOn: row.startedOn ? dateToIsoDate(row.startedOn) : null,
    active: row.active,
  };
}

const byName = (a: PersonRecord, b: PersonRecord) => a.fullName.localeCompare(b.fullName, 'ca');

/** People of a House plus the people of the shared posts, active and inactive. */
export async function listPeopleOf(db: PrismaClient, house: HouseSlug): Promise<PersonRecord[]> {
  const rows = await db.person.findMany({ where: { OR: [{ house: { slug: house } }, { houseId: null }] }, select: personSelect });
  return rows.map(toRecord).sort(byName);
}

export async function listActivePeople(db: PrismaClient): Promise<PersonRecord[]> {
  const rows = await db.person.findMany({ where: { active: true }, select: personSelect });
  return rows.map(toRecord).sort(byName);
}

export async function findPerson(db: PrismaClient, id: string): Promise<PersonRecord | null> {
  const row = await db.person.findUnique({ where: { id }, select: personSelect });
  return row ? toRecord(row) : null;
}

async function houseIdOf(db: PrismaClient, house: HouseSlug | null): Promise<string | null> {
  if (!house) return null;
  const row = await db.house.findUnique({ where: { slug: house }, select: { id: true } });
  if (!row) throw new Error(`House ${house} is missing: run the migrations first.`);
  return row.id;
}

async function occupantOf(db: PrismaClient, houseId: string | null, ref: SeatRef, exceptId?: string): Promise<string | null> {
  const occupant = await db.person.findFirst({
    where: { active: true, houseId, postKey: ref.postKey, seat: ref.seat, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { fullName: true },
  });
  return occupant?.fullName ?? null;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Checks the seat is free, then writes. The partial unique indexes catch two
 * writes racing for the same seat; both paths end in SeatTakenError.
 */
async function writeToSeat<T>(db: PrismaClient, ref: SeatRef, exceptId: string | undefined, write: (houseId: string | null) => Promise<T>): Promise<T> {
  if (!isValidSeat(ref)) throw new InvalidSeatError(ref);
  const houseId = await houseIdOf(db, ref.house);
  const occupant = await occupantOf(db, houseId, ref, exceptId);
  if (occupant) throw new SeatTakenError(occupant);
  try {
    return await write(houseId);
  } catch (error) {
    if (isUniqueViolation(error)) throw new SeatTakenError(await occupantOf(db, houseId, ref, exceptId));
    throw error;
  }
}

export async function addPerson(
  db: PrismaClient,
  input: { fullName: string; startedOn: IsoDate | null; seat: SeatRef },
): Promise<string> {
  const { seat } = input;
  const created = await writeToSeat(db, seat, undefined, (houseId) =>
    db.person.create({
      data: {
        fullName: input.fullName,
        houseId,
        postKey: seat.postKey,
        seat: seat.seat,
        startedOn: input.startedOn ? isoDateToDate(input.startedOn) : null,
        active: true,
      },
      select: { id: true },
    }),
  );
  return created.id;
}

export async function renamePerson(db: PrismaClient, id: string, fullName: string): Promise<void> {
  await db.person.update({ where: { id }, data: { fullName } });
}

/** Moves an active person, or reactivates an inactive one, into a vacant seat. Balances stay with the person. */
export async function placePerson(db: PrismaClient, id: string, seat: SeatRef): Promise<void> {
  await writeToSeat(db, seat, id, (houseId) =>
    db.person.update({ where: { id }, data: { houseId, postKey: seat.postKey, seat: seat.seat, active: true } }),
  );
}

/** Frees the seat; the person keeps their data, balances and last seat for reference. */
export async function deactivatePerson(db: PrismaClient, id: string): Promise<void> {
  await db.person.update({ where: { id }, data: { active: false } });
}

export async function findOpeningBalances(db: PrismaClient, personId: string, year: number): Promise<OpeningBalances | null> {
  return db.personYear.findUnique({
    where: { personId_year: { personId, year } },
    select: { vacationDays: true, carriedDays: true, surplusMinutes: true },
  });
}

export async function saveOpeningBalances(db: PrismaClient, personId: string, year: number, balances: OpeningBalances): Promise<void> {
  await db.personYear.upsert({
    where: { personId_year: { personId, year } },
    create: { personId, year, ...balances },
    update: balances,
  });
}
