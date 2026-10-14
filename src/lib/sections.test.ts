// @vitest-environment node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS, firstAvailableSection, sectionHref } from './sections';

describe('SECTIONS', () => {
  it('lists Saldos, Vacances, El mes and Equip in this order', () => {
    expect(SECTIONS.map((s) => [s.segment, s.label])).toEqual([
      ['saldos', 'Saldos'],
      ['vacances', 'Vacances'],
      ['mes', 'El mes'],
      ['team', 'Equip'],
    ]);
  });

  it('opens Equip first until Saldos ships', () => {
    expect(firstAvailableSection().segment).toBe('team');
  });

  it('builds hrefs inside the active House', () => {
    expect(sectionHref('carme-aymerich', 'team')).toBe('/carme-aymerich/team');
  });

  // Making a section available means flipping its flag AND adding its route; an
  // unavailable section has no route, so its URL is a 404.
  const houseDir = join(process.cwd(), 'src', 'app', '(app)', '[house]');
  it.each(SECTIONS.map((s) => [s.segment, s.available] as const))('%s has a route only when available', (segment, available) => {
    expect(existsSync(join(houseDir, segment, 'page.tsx'))).toBe(available);
  });
});
