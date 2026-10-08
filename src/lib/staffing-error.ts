/**
 * Why a staffing operation was rejected. The domain plans, the store's
 * database error mapping and the Catalan messages share this vocabulary.
 */
export type StaffingErrorReason =
  | 'invalid-dates'
  | 'not-ongoing'
  | 'same-house'
  | 'starts-too-early'
  | 'membership-overlap'
  | 'employee-has-position'
  | 'position-occupied'
  | 'outside-membership'
  | 'future-assignment-blocks'
  | 'label-taken'
  | 'stale'
  | 'not-found'
  | 'operation-conflict';

export class StaffingError extends Error {
  readonly reason: StaffingErrorReason;

  constructor(reason: StaffingErrorReason) {
    super(`Invalid staffing operation: ${reason}`);
    this.name = 'StaffingError';
    this.reason = reason;
  }
}

export function isStaffingError(error: unknown): error is StaffingError {
  return error instanceof StaffingError;
}
