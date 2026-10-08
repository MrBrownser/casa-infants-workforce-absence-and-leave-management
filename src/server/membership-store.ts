// src/server/membership-store.ts
//
// Membership persistence with the Prisma client passed in. No auth and no
// `server-only` here so the dev seed can use it; app code must go through
// src/server/houses.ts, which checks the director first.
import type { PrismaClient } from '@/generated/prisma/client';
import { dateToIsoDate, type IsoDate } from '@/lib/dates';
import { membersOn, type Membership, type TeamMember } from '@/lib/house-membership';

type MembershipRow = { id: string; employeeId: string; houseId: string; startsOn: Date; endsOn: Date | null };

export function toMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    employeeId: row.employeeId,
    houseId: row.houseId,
    startsOn: dateToIsoDate(row.startsOn),
    endsOn: row.endsOn ? dateToIsoDate(row.endsOn) : null,
  };
}

export async function findCurrentMembers(db: PrismaClient, houseId: string, date: IsoDate): Promise<TeamMember[]> {
  const rows = await db.houseMembership.findMany({ where: { houseId }, include: { employee: true } });
  const names = new Map(rows.map((row) => [row.employeeId, row.employee.fullName]));
  return membersOn(rows.map(toMembership), houseId, date)
    .map((m) => ({ employeeId: m.employeeId, fullName: names.get(m.employeeId) ?? '', startsOn: m.startsOn }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ca'));
}
