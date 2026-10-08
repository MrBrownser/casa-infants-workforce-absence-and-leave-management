import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { findCurrentMembers, toMembership } from './membership-store';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function row(id: string, employeeId: string, fullName: string, houseId: string, startsOn: string, endsOn: string | null) {
  return { id, employeeId, houseId, startsOn: d(startsOn), endsOn: endsOn ? d(endsOn) : null, employee: { id: employeeId, fullName } };
}

describe('toMembership', () => {
  it('maps database dates to IsoDate', () => {
    expect(toMembership(row('m1', 'e1', 'Ana', 'pf', '2026-01-01', '2026-06-30'))).toEqual({
      id: 'm1', employeeId: 'e1', houseId: 'pf', startsOn: '2026-01-01', endsOn: '2026-06-30',
    });
  });
});

describe('findCurrentMembers', () => {
  it('returns only members active on the date, sorted by name', async () => {
    const findMany = vi.fn().mockResolvedValue([
      row('m1', 'e1', 'Ana Puig', 'pf', '2026-01-01', '2026-06-30'),
      row('m2', 'e2', 'Laia Serra', 'pf', '2025-09-01', null),
      row('m3', 'e3', 'Èric Bosch', 'pf', '2025-09-01', null),
      row('m4', 'e4', 'Pol Mas', 'pf', '2026-11-01', null),
    ]);
    const db = { houseMembership: { findMany } } as unknown as PrismaClient;

    const members = await findCurrentMembers(db, 'pf', '2026-10-04');

    expect(findMany).toHaveBeenCalledWith({ where: { houseId: 'pf' }, include: { employee: true } });
    expect(members).toEqual([
      { employeeId: 'e3', fullName: 'Èric Bosch', startsOn: '2025-09-01' },
      { employeeId: 'e2', fullName: 'Laia Serra', startsOn: '2025-09-01' },
    ]);
  });
});
