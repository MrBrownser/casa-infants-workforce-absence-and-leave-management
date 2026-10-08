import { describe, expect, it } from 'vitest';
import { ROLES, ROLE_CODES, findRole, isRoleCode, roleOrder } from './roles';

describe('ROLES', () => {
  it('is the SPEC-002 catalogue in order', () => {
    expect(ROLES).toEqual([
      { code: 'PDG', label: 'Pedagoga' },
      { code: 'PSI', label: 'Psicòloga' },
      { code: 'ER', label: 'Educadora referent' },
      { code: 'TFM', label: 'Treballadora familiar de matins' },
      { code: 'TFT', label: 'Treballadora familiar de tardes' },
      { code: 'ET', label: 'Educadora de tardes' },
      { code: 'ECS', label: 'Educadora de cap de setmana' },
      { code: 'EN', label: 'Educadora de nit' },
      { code: 'CT', label: 'Corretor' },
    ]);
    expect(ROLE_CODES).toEqual(['PDG', 'PSI', 'ER', 'TFM', 'TFT', 'ET', 'ECS', 'EN', 'CT']);
  });

  it('recognises codes exactly', () => {
    expect(isRoleCode('CT')).toBe(true);
    expect(isRoleCode('ct')).toBe(false);
    expect(isRoleCode('director')).toBe(false);
    expect(isRoleCode(undefined)).toBe(false);
    expect(findRole('EN')?.label).toBe('Educadora de nit');
    expect(findRole('XX')).toBeUndefined();
  });

  it('orders roles as in the catalogue', () => {
    expect(roleOrder('PDG')).toBeLessThan(roleOrder('CT'));
  });
});
