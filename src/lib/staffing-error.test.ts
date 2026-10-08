import { describe, expect, it } from 'vitest';
import { StaffingError, isStaffingError } from './staffing-error';

describe('StaffingError', () => {
  it('carries a reason and mentions it in the message', () => {
    const error = new StaffingError('position-occupied');
    expect(error.reason).toBe('position-occupied');
    expect(error.message).toMatch(/position-occupied/);
    expect(error.name).toBe('StaffingError');
    expect(isStaffingError(error)).toBe(true);
    expect(isStaffingError(new Error('x'))).toBe(false);
  });
});
