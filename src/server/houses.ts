// src/server/houses.ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import type { IsoDate } from '@/lib/dates';
import type { TeamMember } from '@/lib/house-membership';
import { prisma } from '@/lib/prisma';
import { applyTransfer, findCurrentMembers } from './membership-store';

// Every function checks the director itself: pages and layouts render in
// parallel, so a check in a parent layout does not protect these queries.

export async function getHouseBySlug(slug: string) {
  await requireDirector();
  return prisma.house.findUnique({ where: { slug } });
}

export async function listCurrentMembers(houseId: string, date: IsoDate): Promise<TeamMember[]> {
  await requireDirector();
  return findCurrentMembers(prisma, houseId, date);
}

export async function transferEmployee(employeeId: string, toHouseId: string, startsOn: IsoDate): Promise<void> {
  await requireDirector();
  await applyTransfer(prisma, employeeId, toHouseId, startsOn);
}
