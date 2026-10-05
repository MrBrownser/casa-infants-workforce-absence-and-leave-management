import { describe, expect, it } from 'vitest';
import { activeHouseCookieUpdate, resolveDashboardRedirect } from './active-house';

describe('activeHouseCookieUpdate', () => {
  it('stores the House when entering a House path', () => {
    expect(activeHouseCookieUpdate('/carme-aymerich/team', undefined)).toBe('carme-aymerich');
    expect(activeHouseCookieUpdate('/carme-aymerich', 'paulo-freire')).toBe('carme-aymerich');
  });

  it('leaves the cookie alone when nothing changes', () => {
    expect(activeHouseCookieUpdate('/carme-aymerich/team', 'carme-aymerich')).toBeNull();
  });

  it('ignores paths outside a House, including wrong case', () => {
    expect(activeHouseCookieUpdate('/dashboard', 'paulo-freire')).toBeNull();
    expect(activeHouseCookieUpdate('/no-access', undefined)).toBeNull();
    expect(activeHouseCookieUpdate('/Carme-Aymerich', undefined)).toBeNull();
  });
});

describe('resolveDashboardRedirect', () => {
  it('returns to the remembered House', () => {
    expect(resolveDashboardRedirect('carme-aymerich')).toBe('/carme-aymerich');
  });

  it('falls back to Paulo Freire without a valid cookie', () => {
    expect(resolveDashboardRedirect(undefined)).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('')).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('casa-inexistent')).toBe('/paulo-freire');
  });

  it('never redirects to a tampered value', () => {
    expect(resolveDashboardRedirect('//evil.example')).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('https://evil.example')).toBe('/paulo-freire');
    expect(resolveDashboardRedirect('../paulo-freire')).toBe('/paulo-freire');
  });
});
