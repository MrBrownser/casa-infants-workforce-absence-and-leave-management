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

// Team pages without a record in the path keep their section when switching;
// employee and position pages go to the other House's team list, because an
// employee or position ID has no relationship with the other House (FR-006).
const RECORD_FREE_TEAM_PAGES = new Set(['new', 'positions']);

/**
 * Same section, other House: `/paulo-freire/team` becomes `/carme-aymerich/team`.
 * A path outside any House goes to the target House home.
 */
export function switchHousePath(pathname: string, toSlug: HouseSlug): string {
  const fromSlug = houseSlugFromPath(pathname);
  if (!fromSlug) return `/${toSlug}`;
  const [, section, page, ...deeper] = pathname.split('/').filter(Boolean);
  const rest = [section, page, ...deeper].filter((segment): segment is string => segment !== undefined);
  if (fromSlug === toSlug) return `/${[toSlug, ...rest].join('/')}`;
  const recordPage = section === 'team' && page !== undefined && (deeper.length > 0 || !RECORD_FREE_TEAM_PAGES.has(page));
  if (recordPage) return `/${toSlug}/team`;
  return `/${[toSlug, ...rest].join('/')}`;
}
