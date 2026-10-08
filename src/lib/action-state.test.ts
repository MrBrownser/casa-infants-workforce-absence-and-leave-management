// src/lib/action-state.test.ts
import { describe, expect, it } from 'vitest';
import { doneHref, firstParam, parseDone } from './action-state';

describe('done notes', () => {
  it('builds and parses the ?done marker', () => {
    expect(doneHref('/paulo-freire/team/e1', 'person-created', 'applied')).toBe('/paulo-freire/team/e1?done=person-created');
    expect(doneHref('/paulo-freire/team/e1', 'renamed', 'already-applied')).toBe('/paulo-freire/team/e1?done=renamed&repeat=1');
    expect(parseDone({ done: 'renamed', repeat: '1' })).toEqual({ done: 'renamed', repeat: true });
    expect(parseDone({ done: 'hacked' })).toEqual({ done: null, repeat: false });
    expect(parseDone({ done: ['assigned', 'renamed'] })).toEqual({ done: 'assigned', repeat: false });
  });

  it('reads the first value of repeated parameters', () => {
    expect(firstParam({ view: ['people', 'former'] }, 'view')).toBe('people');
    expect(firstParam({}, 'view')).toBeUndefined();
  });
});
