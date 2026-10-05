import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_SLUG,
  HOUSES,
  findHouseBySlug,
  houseSlugFromPath,
  isHouseSlug,
  switchHousePath,
} from './houses';

describe('HOUSES', () => {
  it('lists exactly the two Houses with their permanent slugs', () => {
    expect(HOUSES).toEqual([
      { slug: 'paulo-freire', name: 'Paulo Freire' },
      { slug: 'carme-aymerich', name: 'Carme Aymerich' },
    ]);
    expect(DEFAULT_HOUSE_SLUG).toBe('paulo-freire');
  });
});

describe('isHouseSlug / findHouseBySlug', () => {
  it('accepts known slugs only, case-sensitively', () => {
    expect(isHouseSlug('carme-aymerich')).toBe(true);
    expect(isHouseSlug('Paulo-Freire')).toBe(false);
    expect(isHouseSlug('')).toBe(false);
    expect(isHouseSlug(undefined)).toBe(false);
    expect(findHouseBySlug('paulo-freire')?.name).toBe('Paulo Freire');
    expect(findHouseBySlug('casa-inexistent')).toBeUndefined();
  });
});

describe('houseSlugFromPath', () => {
  it('reads the first path segment', () => {
    expect(houseSlugFromPath('/paulo-freire')).toBe('paulo-freire');
    expect(houseSlugFromPath('/carme-aymerich/team')).toBe('carme-aymerich');
    expect(houseSlugFromPath('/carme-aymerich/team/')).toBe('carme-aymerich');
  });

  it('returns null outside a House', () => {
    expect(houseSlugFromPath('/')).toBeNull();
    expect(houseSlugFromPath('/dashboard')).toBeNull();
    expect(houseSlugFromPath('/Paulo-Freire/team')).toBeNull();
  });
});

describe('switchHousePath', () => {
  it('swaps the House and keeps the section', () => {
    expect(switchHousePath('/paulo-freire', 'carme-aymerich')).toBe('/carme-aymerich');
    expect(switchHousePath('/paulo-freire/team', 'carme-aymerich')).toBe('/carme-aymerich/team');
    expect(switchHousePath('/paulo-freire/team/a/b', 'carme-aymerich')).toBe('/carme-aymerich/team/a/b');
  });

  it('drops a trailing slash', () => {
    expect(switchHousePath('/paulo-freire/team/', 'carme-aymerich')).toBe('/carme-aymerich/team');
  });

  it('keeps the path when switching to the same House', () => {
    expect(switchHousePath('/paulo-freire/team', 'paulo-freire')).toBe('/paulo-freire/team');
  });

  it('goes to the House home from a non-House path', () => {
    expect(switchHousePath('/dashboard', 'carme-aymerich')).toBe('/carme-aymerich');
  });
});
