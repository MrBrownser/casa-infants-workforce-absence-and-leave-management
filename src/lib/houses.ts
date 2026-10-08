// The two Cases d'Infants (FR-001). Keep in sync with the rows inserted by the
// house_context migration (a test checks it). The proxy uses this list, so it
// must stay a plain constant with no database access.
export const HOUSES = [
  { slug: 'paulo-freire', name: 'Paulo Freire' },
  { slug: 'carme-aymerich', name: 'Carme Aymerich' },
] as const;

export type House = (typeof HOUSES)[number];
export type HouseSlug = House['slug'];

export const DEFAULT_HOUSE_SLUG: HouseSlug = 'paulo-freire';

export function isHouseSlug(value: unknown): value is HouseSlug {
  return typeof value === 'string' && HOUSES.some((house) => house.slug === value);
}

export function findHouseBySlug(slug: string): House | undefined {
  return HOUSES.find((house) => house.slug === slug);
}

/** The House in the first path segment: `/paulo-freire/team` is `paulo-freire`. */
export function houseSlugFromPath(pathname: string): HouseSlug | null {
  const first = pathname.split('/')[1] ?? '';
  return isHouseSlug(first) ? first : null;
}

/**
 * Same section, other House: `/paulo-freire/team` becomes `/carme-aymerich/team`.
 * A path outside any House goes to the target House home.
 */
export function switchHousePath(pathname: string, toSlug: HouseSlug): string {
  if (!houseSlugFromPath(pathname)) return `/${toSlug}`;
  const segments = pathname.split('/');
  segments[1] = toSlug;
  const path = segments.join('/');
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
