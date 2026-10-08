import { createHash } from 'node:crypto';
import type { StaffingPlan } from '@/lib/staffing';

/**
 * Fingerprint of a plan (design D6). A confirm is applied only if the plan
 * recomputed under the lock still matches the one previewed; otherwise stale.
 */
export function planToken(plan: StaffingPlan): string {
  const closes = plan.closes.map((c) => [c.kind, c.id, c.endsOn].join('|')).sort();
  const opens = plan.opens
    .map((o) => [o.kind, o.employeeId, o.houseId, o.kind === 'assignment' ? o.positionId : '', o.startsOn, o.endsOn ?? ''].join('|'))
    .sort();
  return createHash('sha256').update(JSON.stringify({ closes, opens })).digest('hex');
}
