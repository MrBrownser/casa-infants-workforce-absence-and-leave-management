import { describe, expect, it } from 'vitest';
import { HOUSES } from './houses';
import {
  NO_FIXED_SCHEDULE,
  ROLE_LABELS,
  allSeats,
  decodeSeatRef,
  encodeSeatRef,
  findPost,
  isValidSeat,
  nightSeatOnDuty,
  postsOf,
  rangesOn,
  scheduleSummary,
  sharedPostHouseOn,
  sharedPosts,
  sharedWeekSplit,
} from './posts';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

describe('House posts', () => {
  it.each(HOUSES.map((h) => h.slug))('%s has ER, TFM, TFT, ET, ECS, EN and CT in this order', (slug) => {
    const posts = postsOf(slug);
    expect(posts.map((p) => p.roleCode)).toEqual(['ER', 'TFM', 'TFT', 'ET', 'ECS', 'EN', 'CT']);
    expect(new Set(posts.map((p) => p.key)).size).toBe(posts.length);
  });

  it('gives two seats only to the night post', () => {
    const multi = postsOf('paulo-freire').filter((p) => p.seats > 1);
    expect(multi.map((p) => [p.key, p.seats])).toEqual([['en', 2]]);
  });

  it('never exceeds the seat CHECK of the database (1..2)', () => {
    for (const post of [...sharedPosts(), ...postsOf('paulo-freire'), ...postsOf('carme-aymerich')]) {
      expect(post.seats).toBeGreaterThanOrEqual(1);
      expect(post.seats).toBeLessThanOrEqual(2);
    }
  });
});

describe('shared posts', () => {
  it('are the Pedagoga and the Psicòloga, one seat each', () => {
    expect(sharedPosts().map((p) => [p.key, p.roleCode, p.seats])).toEqual([
      ['pdg', 'PDG', 1],
      ['psi', 'PSI', 1],
    ]);
  });

  it('belong to no House', () => {
    expect(findPost(null, 'pdg')?.roleCode).toBe('PDG');
    expect(findPost('paulo-freire', 'pdg')).toBeUndefined();
    expect(findPost(null, 'er')).toBeUndefined();
  });
});

describe('role labels', () => {
  it('uses the director’s words', () => {
    expect(ROLE_LABELS.ET).toBe('Educadora de tardes');
    expect(ROLE_LABELS.CT).toBe('Corretorn');
    expect(ROLE_LABELS.PSI).toBe('Psicòloga');
  });
});

describe('schedules', () => {
  const all = [...sharedPosts(), ...postsOf('paulo-freire')];

  it('has seven days of valid HH:MM ranges for every post with a schedule', () => {
    for (const post of all.filter((p) => p.schedule)) {
      expect(post.schedule).toHaveLength(7);
      for (const day of post.schedule!) {
        for (const range of day) {
          expect(range.from).toMatch(HHMM);
          expect(range.to).toMatch(HHMM);
          expect(range.from).not.toBe(range.to);
        }
      }
    }
  });

  it('gives the CT no fixed schedule', () => {
    expect(findPost('paulo-freire', 'ct')?.schedule).toBeNull();
    expect(scheduleSummary(null)).toBe(NO_FIXED_SCHEDULE);
    expect(NO_FIXED_SCHEDULE).toBe('Sense horari fix');
  });

  it('summarises each post compactly', () => {
    const summary = (key: string) => scheduleSummary(findPost('paulo-freire', key)!.schedule);
    expect(summary('tfm')).toBe('dl–dv 07:30–15:00');
    expect(summary('er')).toBe('dl i dc 09:00–17:00 · dt i dj 13:00–21:00 · dv 08:00–15:00');
    expect(summary('ecs')).toBe('ds–dg 10:30–22:15');
    expect(summary('en')).toBe('dl–dj i dg 22:00–08:00 · dv–ds 22:00–10:30');
    expect(scheduleSummary(findPost(null, 'psi')!.schedule)).toBe('dl, dc i dv 09:00–15:00 · dt i dj 14:00–20:00');
  });
});

describe('rangesOn', () => {
  const post = (key: string) => findPost('paulo-freire', key)!;

  it('returns the weekday ranges on a normal day', () => {
    expect(rangesOn(post('tfm'), '2026-10-12')).toEqual([{ from: '07:30', to: '15:00' }]);
    expect(rangesOn(post('tfm'), '2026-10-17')).toEqual([]);
  });

  it('rests weekday posts on public holidays', () => {
    expect(rangesOn(post('tfm'), '2026-10-12', true)).toEqual([]);
    expect(rangesOn(findPost(null, 'pdg')!, '2026-10-12', true)).toEqual([]);
  });

  it('puts the ECS on a weekday holiday and keeps the night as usual', () => {
    expect(rangesOn(post('ecs'), '2026-10-12', true)).toEqual([{ from: '10:30', to: '22:15' }]);
    expect(rangesOn(post('en'), '2026-10-12', true)).toEqual(rangesOn(post('en'), '2026-10-12'));
  });

  it('never gives the CT ranges', () => {
    expect(rangesOn(post('ct'), '2026-10-12')).toEqual([]);
  });
});

describe('night alternation', () => {
  it('keeps one seat all week and switches the next week', () => {
    expect(nightSeatOnDuty('2026-10-12')).toBe(nightSeatOnDuty('2026-10-18'));
    expect(nightSeatOnDuty('2026-10-19')).not.toBe(nightSeatOnDuty('2026-10-12'));
  });

  it('alternates across the 53-week year 2026', () => {
    expect(nightSeatOnDuty('2027-01-04')).not.toBe(nightSeatOnDuty('2026-12-28'));
  });
});

describe('shared posts by weekday', () => {
  it('works Monday to Wednesday in one House and Thursday and Friday in the other', () => {
    expect(sharedPostHouseOn('2026-10-12')).toBe(sharedPostHouseOn('2026-10-14'));
    expect(sharedPostHouseOn('2026-10-15')).not.toBe(sharedPostHouseOn('2026-10-12'));
    expect(sharedPostHouseOn('2026-10-17')).toBeNull();
  });

  it('swaps the Houses every week', () => {
    expect(sharedPostHouseOn('2026-10-19')).not.toBe(sharedPostHouseOn('2026-10-12'));
    expect(sharedWeekSplit('2026-10-14')).toEqual([
      { days: 'dl–dc', house: sharedPostHouseOn('2026-10-12') },
      { days: 'dj–dv', house: sharedPostHouseOn('2026-10-15') },
    ]);
  });
});

describe('seat refs', () => {
  it('validates House and shared seats', () => {
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'en', seat: 2 })).toBe(true);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'en', seat: 3 })).toBe(false);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'er', seat: 2 })).toBe(false);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'er', seat: 1.5 })).toBe(false);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'xx', seat: 1 })).toBe(false);
    expect(isValidSeat({ house: null, postKey: 'pdg', seat: 1 })).toBe(true);
    expect(isValidSeat({ house: 'paulo-freire', postKey: 'pdg', seat: 1 })).toBe(false);
    expect(isValidSeat({ house: null, postKey: 'er', seat: 1 })).toBe(false);
  });

  it('round-trips through a form string', () => {
    for (const ref of allSeats()) expect(decodeSeatRef(encodeSeatRef(ref))).toEqual(ref);
    expect(encodeSeatRef({ house: null, postKey: 'pdg', seat: 1 })).toBe('shared:pdg:1');
  });

  it('rejects tampered strings', () => {
    for (const value of ['shared:er:1', 'x:er:1', 'paulo-freire:er', 'paulo-freire:er:1:x', 'paulo-freire:er:2', 'paulo-freire:er:01', '']) {
      expect(decodeSeatRef(value)).toBeNull();
    }
  });

  it('lists every seat: 2 shared plus 8 per House', () => {
    expect(allSeats()).toHaveLength(18);
  });
});
