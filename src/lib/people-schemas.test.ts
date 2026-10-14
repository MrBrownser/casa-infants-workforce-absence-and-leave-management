import { describe, expect, it } from 'vitest';
import { addPersonSchema, balancesSchema, isPersonId, placePersonSchema, renamePersonSchema } from './people-schemas';

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const firstMessage = (result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  result.error?.issues[0] ? { path: result.error.issues[0].path.join('.'), message: result.error.issues[0].message } : null;

describe('addPersonSchema', () => {
  it('trims the name and parses the date and the seat', () => {
    expect(addPersonSchema.parse({ fullName: '  Carla Ribas Solé ', startedOn: '01/07/2026', seat: 'paulo-freire:er:1' })).toEqual({
      fullName: 'Carla Ribas Solé',
      startedOn: '2026-07-01',
      seat: { house: 'paulo-freire', postKey: 'er', seat: 1 },
    });
  });

  it('allows no start date', () => {
    expect(addPersonSchema.parse({ fullName: 'Carla', startedOn: '', seat: 'shared:pdg:1' }).startedOn).toBeNull();
  });

  it('rejects a blank name', () => {
    expect(firstMessage(addPersonSchema.safeParse({ fullName: '   ', startedOn: '', seat: 'paulo-freire:er:1' }))).toEqual({
      path: 'fullName',
      message: 'Escriu el nom complet.',
    });
  });

  it.each(['31/02/2026', '2026-07-01', '1/7/2026'])('rejects the date %s', (startedOn) => {
    expect(firstMessage(addPersonSchema.safeParse({ fullName: 'Carla', startedOn, seat: 'paulo-freire:er:1' }))).toEqual({
      path: 'startedOn',
      message: 'Escriu la data com dd/mm/aaaa.',
    });
  });

  it.each(['paulo-freire:er:2', 'paulo-freire:xx:1', 'shared:er:1', ''])('rejects the seat %s', (seat) => {
    expect(firstMessage(addPersonSchema.safeParse({ fullName: 'Carla', startedOn: '', seat }))).toEqual({
      path: 'seat',
      message: 'Tria un lloc vacant.',
    });
  });
});

describe('renamePersonSchema and placePersonSchema', () => {
  it('needs a real person id', () => {
    expect(renamePersonSchema.safeParse({ personId: 'abc', fullName: 'Roger' }).success).toBe(false);
    expect(renamePersonSchema.parse({ personId: ID, fullName: ' Roger Beltrán Camps ' }).fullName).toBe('Roger Beltrán Camps');
    expect(placePersonSchema.parse({ personId: ID, seat: 'carme-aymerich:et:1' }).seat).toEqual({ house: 'carme-aymerich', postKey: 'et', seat: 1 });
    expect(isPersonId(ID)).toBe(true);
    expect(isPersonId('1')).toBe(false);
  });
});

describe('balancesSchema', () => {
  const base = { personId: ID, year: 2026, vacationDays: '31', carriedDays: '3', surplusSign: '+' as const, surplus: '12:00' };

  it('stores the surplus in minutes with its sign', () => {
    expect(balancesSchema.parse(base)).toEqual({ personId: ID, year: 2026, vacationDays: 31, carriedDays: 3, surplusMinutes: 720 });
    expect(balancesSchema.parse({ ...base, surplusSign: '-', surplus: '9:15' }).surplusMinutes).toBe(-555);
  });

  it('stores −0:00 as 0', () => {
    expect(Object.is(balancesSchema.parse({ ...base, surplusSign: '-', surplus: '0:00' }).surplusMinutes, 0)).toBe(true);
  });

  it.each(['9:75', 'abc', '', '12'])('rejects the surplus %s', (surplus) => {
    expect(firstMessage(balancesSchema.safeParse({ ...base, surplus }))).toEqual({
      path: 'surplus',
      message: 'Escriu les hores com H:MM, per exemple 3:45.',
    });
  });

  it.each(['100', '-1', '3.5', ''])('rejects vacation days %s', (vacationDays) => {
    expect(firstMessage(balancesSchema.safeParse({ ...base, vacationDays }))?.path).toBe('vacationDays');
  });

  it('rejects a year out of range', () => {
    expect(balancesSchema.safeParse({ ...base, year: 1999 }).success).toBe(false);
  });
});
