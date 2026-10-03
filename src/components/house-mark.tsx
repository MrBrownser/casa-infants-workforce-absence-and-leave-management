/**
 * Provisional clay-house mark, inspired by FASI's plasticine house (see
 * DESIGN.md → Illustration). Used as the wordmark mark and in empty states.
 *
 * TODO(before launch): replace this placeholder SVG with the final
 * illustration (FASI's clay-house image, with their permission, or a
 * commissioned one). Keep this component's API so callers do not change.
 */
export function HouseMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden="true">
      <path
        d="M150 52c-6-14 4-28 18-26 4-12 22-14 28-2 12-2 20 12 12 22 6 10-4 22-14 18-6 8-20 8-24-2-10 4-22-2-20-10z"
        fill="#F4F1EA"
      />
      <rect x="146" y="72" width="30" height="46" rx="6" fill="#C9653A" />
      <rect x="141" y="66" width="40" height="14" rx="6" fill="#DB7B4C" />
      <path d="M58 128h124v74c0 8-6 12-12 12H70c-6 0-12-4-12-12z" fill="#F5EDE0" />
      <path d="M150 128h32v74c0 8-6 12-12 12h-20z" fill="#E8DCCB" />
      <path d="M40 136c-6 0-8-8-4-12l78-70c4-4 10-4 14 0l78 70c4 4 2 12-4 12z" fill="#D2432F" />
      <path
        d="M58 118l64-56M80 125l50-44M104 129l34-30"
        stroke="#B5331F"
        strokeWidth="6"
        strokeLinecap="round"
        opacity=".55"
      />
      <path d="M40 136c-6 0-8-8-4-12l78-70" stroke="#E5654D" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="74" y="146" width="30" height="26" rx="6" fill="#BFDCE3" />
      <path d="M89 147v24M75 159h28" stroke="#E8F2F4" strokeWidth="3" />
      <rect x="114" y="146" width="28" height="26" rx="6" fill="#BFDCE3" />
      <path d="M128 147v24M115 159h26" stroke="#E8F2F4" strokeWidth="3" />
      <path d="M84 214v-24c0-8 6-12 12-12s12 4 12 12v24z" fill="#B25A3A" />
      <path d="M89 214v-21c0-5 3-8 7-8s7 3 7 8v21z" fill="#7C4A35" />
      <circle cx="100" cy="200" r="2.4" fill="#C98263" />
    </svg>
  );
}
