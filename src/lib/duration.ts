// Durations are integer minutes. The UI reads and writes one standard format,
// `H:MM` (hours may exceed 24), and shows `3 h 45 min` (design D7).
const DURATION = /^(\d{1,3}):([0-5]\d)$/;
const MINUS = '−';

export function parseDuration(text: string): number | null {
  const match = DURATION.exec(text.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes as `H:MM` for an input, without the sign: 555 becomes `9:15`. */
export function toDurationText(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** `3 h 45 min`, `3 h`, `45 min`; with `signed`, `+12 h` or `−9 h 15 min`. */
export function formatDuration(minutes: number, { signed = false }: { signed?: boolean } = {}): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const body = hours && rest ? `${hours} h ${rest} min` : rest ? `${rest} min` : `${hours} h`;
  if (minutes < 0) return `${MINUS}${body}`;
  return signed ? `+${body}` : body;
}

/** Rebuilds the field from its digits while typing: the colon goes before the last two (`945` is `9:45`). */
export function maskDuration(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 5);
  return digits.length >= 3 ? `${digits.slice(0, -2)}:${digits.slice(-2)}` : digits;
}
