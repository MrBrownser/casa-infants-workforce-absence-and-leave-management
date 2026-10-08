// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { StaffingPlan } from '@/lib/staffing';
import { planToken } from './plan-token';

const plan: StaffingPlan = {
  closes: [
    { kind: 'assignment', id: 'a1', employeeId: 'e1', houseId: 'pf', positionId: 'p1', endsOn: '2026-06-30' },
    { kind: 'membership', id: 'm1', employeeId: 'e1', houseId: 'pf', positionId: null, endsOn: '2026-06-30' },
  ],
  opens: [{ kind: 'membership', employeeId: 'e1', houseId: 'ca', startsOn: '2026-07-01', endsOn: null }],
};

describe('planToken', () => {
  it('is a stable sha256 that ignores ordering', () => {
    const token = planToken(plan);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(planToken({ ...plan, closes: [...plan.closes].reverse() })).toBe(token);
  });

  it('changes when any date or record changes', () => {
    const token = planToken(plan);
    expect(planToken({ ...plan, opens: [{ ...plan.opens[0], startsOn: '2026-07-02' }] })).not.toBe(token);
    expect(planToken({ ...plan, closes: plan.closes.slice(1) })).not.toBe(token);
  });
});
