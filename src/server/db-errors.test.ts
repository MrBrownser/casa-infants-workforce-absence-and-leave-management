// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { StaffingError } from '@/lib/staffing-error';
import { isReceiptConflict, pgErrorOf, toStaffingError } from './db-errors';

// Shapes observed from Prisma 7 + @prisma/adapter-pg (spike, 2026-10-08).
function adapterError(code: string, message: string) {
  return Object.assign(new Error(message), { name: 'DriverAdapterError', cause: { originalCode: code, originalMessage: message, kind: 'postgres' } });
}
function knownError(prismaCode: string, code: string, message: string) {
  return Object.assign(new Error('Invalid invocation'), {
    name: 'PrismaClientKnownRequestError',
    code: prismaCode,
    meta: { driverAdapterError: { name: 'DriverAdapterError', cause: { originalCode: code, originalMessage: message } } },
  });
}

const reason = (error: unknown) => (toStaffingError(error) as StaffingError).reason;

describe('pgErrorOf', () => {
  it('reads both error shapes', () => {
    expect(pgErrorOf(adapterError('23P01', 'conflicting key value violates exclusion constraint "position_assignments_position_no_overlap"'))).toEqual({
      code: '23P01', constraint: 'position_assignments_position_no_overlap',
    });
    expect(pgErrorOf(knownError('P2002', '23505', 'duplicate key value violates unique constraint "positions_house_id_label_key_key"'))).toEqual({
      code: '23505', constraint: 'positions_house_id_label_key_key',
    });
    expect(pgErrorOf(new Error('x'))).toBeNull();
    expect(pgErrorOf(null)).toBeNull();
  });
});

describe('toStaffingError', () => {
  it('maps constraints, custom SQLSTATEs and missing records', () => {
    expect(reason(adapterError('23P01', 'violates exclusion constraint "position_assignments_position_no_overlap"'))).toBe('position-occupied');
    expect(reason(adapterError('23P01', 'violates exclusion constraint "position_assignments_employee_no_overlap"'))).toBe('employee-has-position');
    expect(reason(adapterError('23P01', 'violates exclusion constraint "house_memberships_no_overlap"'))).toBe('membership-overlap');
    expect(reason(knownError('P2002', '23505', 'violates unique constraint "positions_house_id_label_key_key"'))).toBe('label-taken');
    expect(reason(adapterError('23514', 'violates check constraint "position_assignments_period_check"'))).toBe('invalid-dates');
    expect(reason(adapterError('CI001', 'assignment x is outside its membership'))).toBe('outside-membership');
    expect(reason(adapterError('CI002', 'position house and role are immutable'))).toBe('not-found');
    expect(reason(knownError('P2003', '23503', 'violates foreign key constraint "x"'))).toBe('not-found');
    expect(reason(Object.assign(new Error('x'), { code: 'P2025' }))).toBe('not-found');
  });

  it('keeps StaffingErrors and unknown errors as they are', () => {
    const staffing = new StaffingError('stale');
    expect(toStaffingError(staffing)).toBe(staffing);
    const unknown = new Error('boom');
    expect(toStaffingError(unknown)).toBe(unknown);
  });

  it('recognises a duplicate operation receipt', () => {
    expect(isReceiptConflict(knownError('P2002', '23505', 'violates unique constraint "operation_receipts_pkey"'))).toBe(true);
    expect(isReceiptConflict(knownError('P2002', '23505', 'violates unique constraint "positions_house_id_label_key_key"'))).toBe(false);
  });
});
