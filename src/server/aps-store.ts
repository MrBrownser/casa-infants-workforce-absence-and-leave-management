// AP persistence with the Prisma client passed in. No auth and no
// `server-only` here so the dev seed can use it; app code goes through
// src/server/saldos.ts and the Server Functions, which check the director first.
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { checkNewAp, personBalances, type ApKind, type ApRecord } from '@/lib/balances';
import { dateToIsoDate, isoDateToDate, type IsoDate } from '@/lib/dates';
import { isHouseSlug, type HouseSlug } from '@/lib/houses';
import { defaultOpeningBalances, type OpeningBalances } from '@/lib/rules';

/** A rule stopped the write; the message is Catalan UI copy. */
export class ApRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApRuleError';
  }
}

export type NewAp = { personId: string; house: HouseSlug; kind: ApKind; year: number; date: IsoDate; minutes: number };

const apSelect = {
  id: true,
  personId: true,
  kind: true,
  year: true,
  date: true,
  minutes: true,
  house: { select: { slug: true } },
} satisfies Prisma.ApSelect;

type ApRow = Prisma.ApGetPayload<{ select: typeof apSelect }>;

function toRecord(row: ApRow): ApRecord {
  const { slug } = row.house;
  if (!isHouseSlug(slug)) throw new Error(`Unknown House ${slug}: keep HOUSES and the houses table in sync.`);
  return { id: row.id, personId: row.personId, house: slug, kind: row.kind, year: row.year, date: dateToIsoDate(row.date), minutes: row.minutes };
}

export async function listApsOf(db: PrismaClient, personIds: readonly string[], year: number): Promise<ApRecord[]> {
  if (personIds.length === 0) return [];
  const rows = await db.ap.findMany({
    where: { personId: { in: [...personIds] }, year },
    select: apSelect,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toRecord);
}

export async function listOpeningBalancesOf(db: PrismaClient, personIds: readonly string[], year: number): Promise<Map<string, OpeningBalances>> {
  if (personIds.length === 0) return new Map();
  const rows = await db.personYear.findMany({
    where: { personId: { in: [...personIds] }, year },
    select: { personId: true, vacationDays: true, carriedDays: true, surplusMinutes: true },
  });
  return new Map(rows.map(({ personId, ...balances }) => [personId, balances]));
}

export async function findAp(db: PrismaClient, id: string): Promise<ApRecord | null> {
  const row = await db.ap.findUnique({ where: { id }, select: apSelect });
  return row ? toRecord(row) : null;
}

/**
 * Checks the yearly limits and inserts in one transaction that first locks the
 * person's row (design D5), so two saves at once cannot both pass the limits.
 * Interactive transactions work through the pooled connection (pgbouncer in
 * transaction mode keeps one server connection per transaction).
 */
export async function createAp(db: PrismaClient, input: NewAp): Promise<string> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "people" WHERE "id" = ${input.personId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw new ApRuleError('Persona desconeguda.');
    const person = await tx.person.findUnique({ where: { id: input.personId }, select: { startedOn: true } });
    const house = await tx.house.findUnique({ where: { slug: input.house }, select: { id: true } });
    if (!house) throw new Error(`House ${input.house} is missing: run the migrations first.`);
    const stored = await tx.personYear.findUnique({
      where: { personId_year: { personId: input.personId, year: input.year } },
      select: { vacationDays: true, carriedDays: true, surplusMinutes: true },
    });
    const startedOn = person?.startedOn ? dateToIsoDate(person.startedOn) : null;
    const opening = stored ?? defaultOpeningBalances(input.year, startedOn);
    const existing = await tx.ap.findMany({ where: { personId: input.personId, year: input.year }, select: { kind: true, minutes: true } });
    const { errors } = checkNewAp(personBalances(opening, existing), input);
    if (errors.length > 0) throw new ApRuleError(errors[0]);
    const created = await tx.ap.create({
      data: {
        personId: input.personId,
        houseId: house.id,
        kind: input.kind,
        year: input.year,
        date: isoDateToDate(input.date),
        minutes: input.minutes,
      },
      select: { id: true },
    });
    return created.id;
  });
}

/**
 * A real delete (GDPR minimisation). Returns true when this call removed the
 * row and false when the AP was already gone, so of two concurrent deletes only
 * one reports success.
 */
export async function deleteAp(db: PrismaClient, id: string): Promise<boolean> {
  const { count } = await db.ap.deleteMany({ where: { id } });
  return count === 1;
}
