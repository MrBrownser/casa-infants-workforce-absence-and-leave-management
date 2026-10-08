// src/server/houses.ts
import 'server-only';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Every function checks the director itself: pages and layouts render in
// parallel, so a check in a parent layout does not protect these queries.

export async function getHouseBySlug(slug: string) {
  await requireDirector();
  return prisma.house.findUnique({ where: { slug } });
}
