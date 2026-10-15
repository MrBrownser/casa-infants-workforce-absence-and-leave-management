// House sections in navigation order (SPEC-003 design D8). A later spec makes a
// section available by flipping `available` and adding
// src/app/(app)/[house]/<segment>/page.tsx (sections.test.ts checks both).
// A plain module, not 'use client': Server Components call these.
import type { HouseSlug } from './houses';

export type Section = { readonly segment: string; readonly label: string; readonly available: boolean };

export const SECTIONS: readonly Section[] = [
  { segment: 'saldos', label: 'Saldos', available: true },
  { segment: 'vacances', label: 'Vacances', available: false },
  { segment: 'mes', label: 'El mes', available: false },
  { segment: 'team', label: 'Equip', available: true },
];

export function firstAvailableSection(): Section {
  const section = SECTIONS.find((s) => s.available);
  if (!section) throw new Error('No House section is available.');
  return section;
}

export function sectionHref(houseSlug: HouseSlug, segment: string): string {
  return `/${houseSlug}/${segment}`;
}
