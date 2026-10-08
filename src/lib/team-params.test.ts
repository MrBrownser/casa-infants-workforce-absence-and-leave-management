import { describe, expect, it } from 'vitest';
import { parseTeamSearchParams, teamHref } from './team-params';

const TODAY = '2026-10-08';

describe('parseTeamSearchParams (Review Focus 2)', () => {
  it('defaults to people today', () => {
    expect(parseTeamSearchParams({}, TODAY)).toEqual({ view: 'people', date: TODAY });
  });

  it('accepts known views and real dates', () => {
    expect(parseTeamSearchParams({ view: 'positions', date: '2026-07-01' }, TODAY)).toEqual({ view: 'positions', date: '2026-07-01' });
  });

  it('falls back on invalid or repeated values', () => {
    expect(parseTeamSearchParams({ view: 'admin', date: '2026-02-30' }, TODAY)).toEqual({ view: 'people', date: TODAY });
    expect(parseTeamSearchParams({ date: 'yesterday' }, TODAY).date).toBe(TODAY);
    expect(parseTeamSearchParams({ view: ['former', 'people'] }, TODAY).view).toBe('former');
  });
});

describe('teamHref', () => {
  it('omits defaults from the URL', () => {
    expect(teamHref('paulo-freire', 'people', TODAY, TODAY)).toBe('/paulo-freire/team');
    expect(teamHref('paulo-freire', 'positions', '2026-07-01', TODAY)).toBe('/paulo-freire/team?view=positions&date=2026-07-01');
    expect(teamHref('paulo-freire', 'former', '2026-07-01', TODAY)).toBe('/paulo-freire/team?view=former');
  });
});
