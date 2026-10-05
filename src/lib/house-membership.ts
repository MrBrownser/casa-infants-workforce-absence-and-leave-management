// src/lib/house-membership.ts
import { addDays, type IsoDate } from './dates';

/**
 * A period during which an employee belongs to a House. Both bounds are
 * inclusive; `endsOn: null` means ongoing. The database forbids overlapping
 * periods for the same employee (one House at a time, BR-002).
 */
export type Membership = {
  id: string;
  employeeId: string;
  houseId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
};

export type MembershipPeriod = Pick<Membership, 'employeeId' | 'startsOn' | 'endsOn'>;

/** A current team member as shown on the team page. */
export type TeamMember = { employeeId: string; fullName: string; startsOn: IsoDate };

const OPEN_END: IsoDate = '9999-12-31';

export function isActiveOn(m: Pick<Membership, 'startsOn' | 'endsOn'>, date: IsoDate): boolean {
  return m.startsOn <= date && date <= (m.endsOn ?? OPEN_END);
}

/** Memberships of `houseId` active on `date`: the team on that day. */
export function membersOn<T extends Membership>(memberships: readonly T[], houseId: string, date: IsoDate): T[] {
  return memberships.filter((m) => m.houseId === houseId && isActiveOn(m, date));
}

/** The House an employee belonged to on `date`, or null. */
export function houseOf(memberships: readonly Membership[], employeeId: string, date: IsoDate): string | null {
  return memberships.find((m) => m.employeeId === employeeId && isActiveOn(m, date))?.houseId ?? null;
}

function overlaps(a: MembershipPeriod, b: MembershipPeriod): boolean {
  return a.startsOn <= (b.endsOn ?? OPEN_END) && b.startsOn <= (a.endsOn ?? OPEN_END);
}

/** Mirrors the database exclusion constraint so callers can show a friendly error. */
export function findOverlap<T extends MembershipPeriod>(existing: readonly T[], candidate: MembershipPeriod): T | undefined {
  return existing.find((m) => m.employeeId === candidate.employeeId && overlaps(m, candidate));
}

export type TransferErrorReason = 'no-current-membership' | 'already-ending' | 'same-house' | 'starts-too-early';

export class TransferError extends Error {
  readonly reason: TransferErrorReason;

  constructor(reason: TransferErrorReason) {
    super(`Invalid transfer: ${reason}`);
    this.name = 'TransferError';
    this.reason = reason;
  }
}

export type TransferPlan = {
  close: { id: string; endsOn: IsoDate };
  open: { employeeId: string; houseId: string; startsOn: IsoDate };
};

/**
 * A transfer ends the ongoing membership the day before `startsOn` and opens a
 * new one. Past periods keep their House and start date (BR-004).
 */
export function planTransfer(current: Membership, toHouseId: string, startsOn: IsoDate): TransferPlan {
  if (current.endsOn !== null) throw new TransferError('already-ending');
  if (current.houseId === toHouseId) throw new TransferError('same-house');
  if (startsOn <= current.startsOn) throw new TransferError('starts-too-early');
  return {
    close: { id: current.id, endsOn: addDays(startsOn, -1) },
    open: { employeeId: current.employeeId, houseId: toHouseId, startsOn },
  };
}
