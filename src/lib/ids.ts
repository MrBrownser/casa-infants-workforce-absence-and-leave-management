const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards IDs from URLs before they reach Postgres (a malformed UUID would raise 22P02). */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
