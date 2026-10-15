// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DATE_MESSAGE, HOURS_MESSAGE, addApSchema, apIdSchema, restoreApSchema } from './ap-schemas';

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';

describe('addApSchema', () => {
  const input = { personId: ID, kind: 'non_recoverable', year: 2026, date: '20/02/2026', hours: '3:45' };

  it('turns the form strings into domain values', () => {
    expect(addApSchema.parse(input)).toEqual({ personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 225 });
  });

  it('accepts 24:00 in one request', () => {
    expect(addApSchema.parse({ ...input, hours: '24:00' }).minutes).toBe(1440);
  });

  it.each(['9:75', '0:00', '25:00', '3,75', '4', ''])('rejects the hours "%s"', (hours) => {
    const result = addApSchema.safeParse({ ...input, hours });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(HOURS_MESSAGE);
  });

  it.each(['31/02/2026', '2026-02-20', ''])('rejects the date "%s"', (date) => {
    const result = addApSchema.safeParse({ ...input, date });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(DATE_MESSAGE);
  });

  it('asks for a person', () => {
    expect(addApSchema.safeParse({ ...input, personId: '' }).error?.issues[0]?.message).toBe('Tria una persona.');
  });

  it('rejects an unknown kind and a year out of range', () => {
    expect(addApSchema.safeParse({ ...input, kind: 'vacation' }).success).toBe(false);
    expect(addApSchema.safeParse({ ...input, year: 1999 }).success).toBe(false);
  });
});

describe('apIdSchema', () => {
  it('accepts a UUID only', () => {
    expect(apIdSchema.safeParse({ apId: ID }).success).toBe(true);
    expect(apIdSchema.safeParse({ apId: 'x' }).success).toBe(false);
  });
});

describe('restoreApSchema', () => {
  const snapshot = { personId: ID, kind: 'recoverable', year: 2026, date: '2027-01-15', minutes: 120, house: 'paulo-freire' };

  it('accepts the snapshot of a deleted AP', () => {
    expect(restoreApSchema.parse(snapshot)).toEqual(snapshot);
  });

  it.each([{ house: 'nowhere' }, { date: '15/01/2027' }, { minutes: 0 }, { minutes: 1441 }, { year: 1999 }])('rejects %o', (patch) => {
    expect(restoreApSchema.safeParse({ ...snapshot, ...patch }).success).toBe(false);
  });
});
