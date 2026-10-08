import { describe, expect, it } from 'vitest';
import { isUuid } from './ids';

describe('isUuid', () => {
  it('accepts canonical UUIDs only', () => {
    expect(isUuid('6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f')).toBe(true);
    expect(isUuid('6F1C2E7A-0B3D-4C5E-8F90-1A2B3C4D5E6F')).toBe(true);
    expect(isUuid('abc')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f/x')).toBe(false);
  });
});
