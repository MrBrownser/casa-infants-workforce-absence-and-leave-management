import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { expect, inject } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { isoDateToDate, type IsoDate } from '@/lib/dates';
import { pgErrorOf } from '@/server/db-errors';

const LOCAL_TEST_URL = /^postgresql:\/\/postgres@localhost:\d+\/casa_test$/;

/** A client for the throwaway test database. Refuses anything that is not the local test DB. */
export function createTestClient(): PrismaClient {
  const url = inject('databaseUrl');
  if (!LOCAL_TEST_URL.test(url)) throw new Error('DB tests only run against the local test database.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Empties every data table; keeps the Houses and roles inserted by the migrations. */
export async function resetData(db: PrismaClient): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('houses', 'occupational_roles', '_prisma_migrations')`;
  if (rows.length === 0) return;
  await db.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
}

export async function houseIds(db: PrismaClient): Promise<{ pf: string; ca: string }> {
  const houses = await db.house.findMany();
  const id = (slug: string) => {
    const house = houses.find((h) => h.slug === slug);
    if (!house) throw new Error(`House ${slug} missing`);
    return house.id;
  };
  return { pf: id('paulo-freire'), ca: id('carme-aymerich') };
}

export async function insertEmployee(db: PrismaClient, fullName = 'Ana Puig'): Promise<string> {
  return (await db.employee.create({ data: { fullName } })).id;
}

export async function insertMembership(
  db: PrismaClient,
  employeeId: string,
  houseId: string,
  startsOn: IsoDate,
  endsOn: IsoDate | null = null,
): Promise<string> {
  const row = await db.houseMembership.create({
    data: { employeeId, houseId, startsOn: isoDateToDate(startsOn), endsOn: endsOn ? isoDateToDate(endsOn) : null },
  });
  return row.id;
}

/** The Postgres SQLSTATE behind a Prisma 7 driver-adapter error, if any. */
export function pgCodeOf(error: unknown): string | undefined {
  return pgErrorOf(error)?.code;
}

export function ctx(operationId: string = randomUUID()): { operationId: string; actor: string } {
  return { operationId, actor: 'user_test' };
}

export async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected Postgres error ${code}`).not.toBeNull();
  expect(pgCodeOf(error)).toBe(code);
}

export async function insertPosition(db: PrismaClient, houseId: string, roleCode: string, label: string): Promise<string> {
  return (await db.position.create({ data: { houseId, roleCode, label } })).id;
}

export async function insertAssignment(
  db: PrismaClient,
  employeeId: string,
  positionId: string,
  houseId: string,
  startsOn: IsoDate,
  endsOn: IsoDate | null = null,
): Promise<string> {
  const row = await db.positionAssignment.create({
    data: { employeeId, positionId, houseId, startsOn: isoDateToDate(startsOn), endsOn: endsOn ? isoDateToDate(endsOn) : null },
  });
  return row.id;
}
