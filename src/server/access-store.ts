// Director grants and employee account links (design D9, D10), client passed
// in, no auth. Used only by the operator scripts in scripts/ and by DB tests;
// no form or Server Function can reach these functions.
import type { PrismaClient } from '@/generated/prisma/client';
import { pgErrorOf } from './db-errors';

export const DIRECTOR_ROLE = 'director';

/**
 * An enabled director grant (design D9). Occupational roles, memberships,
 * account links and Clerk metadata never count. Pure: no Clerk or Next imports.
 */
export function isEnabledDirectorGrant(grant: { role: string; revokedAt: Date | null } | null | undefined): boolean {
  return grant?.role === DIRECTOR_ROLE && grant.revokedAt === null;
}

export function grantDirector(db: PrismaClient, clerkUserId: string) {
  return db.accessGrant.upsert({
    where: { clerkUserId },
    create: { clerkUserId, role: DIRECTOR_ROLE },
    update: { role: DIRECTOR_ROLE, revokedAt: null, grantedAt: new Date() },
  });
}

/** True if an enabled grant was revoked. Takes effect on the user's next request. */
export async function revokeDirector(db: PrismaClient, clerkUserId: string): Promise<boolean> {
  const { count } = await db.accessGrant.updateMany({ where: { clerkUserId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count > 0;
}

export function listGrants(db: PrismaClient) {
  return db.accessGrant.findMany({ orderBy: { grantedAt: 'asc' } });
}

export type AccountLinkFailure = 'employee-not-found' | 'already-linked';

export class AccountLinkError extends Error {
  readonly reason: AccountLinkFailure;

  constructor(reason: AccountLinkFailure) {
    super(`Account link rejected: ${reason}`);
    this.name = 'AccountLinkError';
    this.reason = reason;
  }
}

/** One account per employee and one employee per account (FR-010). Grants nothing. */
export async function linkAccount(db: PrismaClient, employeeId: string, clerkUserId: string): Promise<void> {
  try {
    await db.employeeAccountLink.create({ data: { employeeId, clerkUserId } });
  } catch (error) {
    const pg = pgErrorOf(error);
    if (pg?.code === '23505') throw new AccountLinkError('already-linked');
    if (pg?.code === '23503' || pg?.code === '22P02') throw new AccountLinkError('employee-not-found');
    throw error;
  }
}

export async function unlinkAccount(db: PrismaClient, employeeId: string): Promise<boolean> {
  const { count } = await db.employeeAccountLink.deleteMany({ where: { employeeId } });
  return count > 0;
}
