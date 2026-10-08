// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isHouseSlug } from '../src/lib/houses';
import { isRoleCode } from '../src/lib/roles';
import { SEED_INVENTORY, SEED_START } from './seed-data';

describe('SEED_INVENTORY', () => {
  it('has ten fictional positions per House with valid roles', () => {
    expect(SEED_START).toBe('2025-09-01');
    expect(SEED_INVENTORY.map((house) => house.houseSlug)).toEqual(['paulo-freire', 'carme-aymerich']);
    for (const house of SEED_INVENTORY) {
      expect(isHouseSlug(house.houseSlug)).toBe(true);
      expect(house.positions).toHaveLength(10);
      expect(house.positions.every((p) => isRoleCode(p.roleCode))).toBe(true);
      expect(new Set(house.positions.map((p) => p.label.toLowerCase())).size).toBe(10);
      expect(house.positions.filter((p) => p.roleCode === 'EN')).toHaveLength(2);
    }
  });

  it('uses each fictional name once', () => {
    const names = SEED_INVENTORY.flatMap((house) => house.positions.map((p) => p.occupant));
    expect(new Set(names).size).toBe(20);
  });
});
