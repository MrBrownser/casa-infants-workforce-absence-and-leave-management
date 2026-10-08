// The active House lives in the URL. This cookie only remembers the last one
// so /dashboard can send the director back to it. It is never used to
// authorize or to scope queries.
import { DEFAULT_HOUSE_SLUG, houseSlugFromPath, isHouseSlug, type HouseSlug } from './houses';

export const ACTIVE_HOUSE_COOKIE = 'active-house';
export const ACTIVE_HOUSE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The slug to store for this request, or null to leave the cookie as it is. */
export function activeHouseCookieUpdate(pathname: string, current: string | undefined): HouseSlug | null {
  const slug = houseSlugFromPath(pathname);
  return slug && slug !== current ? slug : null;
}

/** Only known slugs are ever echoed, so a tampered cookie cannot cause an open redirect. */
export function resolveDashboardRedirect(cookieValue: string | undefined): string {
  return `/${isHouseSlug(cookieValue) ? cookieValue : DEFAULT_HOUSE_SLUG}`;
}
