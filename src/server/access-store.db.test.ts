import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestClient, houseIds, insertEmployee, insertMembership, resetData } from '../../test/db/helpers';
import { AccountLinkError, grantDirector, isEnabledDirectorGrant, linkAccount, listGrants, revokeDirector, unlinkAccount } from './access-store';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

const enabled = async (clerkUserId: string) => isEnabledDirectorGrant(await db.accessGrant.findUnique({ where: { clerkUserId } }));

describe('director grants', () => {
  it('grants, revokes and grants again', async () => {
    await grantDirector(db, 'user_director');
    expect(await enabled('user_director')).toBe(true);
    expect(await revokeDirector(db, 'user_director')).toBe(true);
    expect(await enabled('user_director')).toBe(false);
    expect(await revokeDirector(db, 'user_director')).toBe(false);
    await grantDirector(db, 'user_director');
    expect(await enabled('user_director')).toBe(true);
    expect(await listGrants(db)).toHaveLength(1);
  });
});

describe('account links', () => {
  it('rejects a second employee for the same account and a second account for one employee (AC-021)', async () => {
    const { pf } = await houseIds(db);
    const ana = await insertEmployee(db, 'Ana Puig');
    const marta = await insertEmployee(db, 'Marta Soler');
    await insertMembership(db, ana, pf, '2026-01-01');
    await linkAccount(db, ana, 'user_ana');
    await expect(linkAccount(db, marta, 'user_ana')).rejects.toMatchObject({ reason: 'already-linked' });
    await expect(linkAccount(db, ana, 'user_other')).rejects.toBeInstanceOf(AccountLinkError);
    expect(await db.houseMembership.count({ where: { employeeId: ana } })).toBe(1);
  });

  it('never grants access and unlinks cleanly', async () => {
    const ana = await insertEmployee(db, 'Ana Puig');
    await linkAccount(db, ana, 'user_ana');
    expect(await db.accessGrant.count()).toBe(0);
    expect(await unlinkAccount(db, ana)).toBe(true);
    expect(await unlinkAccount(db, ana)).toBe(false);
  });

  it('rejects an unknown employee', async () => {
    await expect(linkAccount(db, '00000000-0000-4000-8000-000000000000', 'user_x')).rejects.toMatchObject({ reason: 'employee-not-found' });
  });
});
