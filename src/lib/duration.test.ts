import { describe, expect, it } from 'vitest';
import { formatDuration, maskDuration, parseDuration, toDurationText } from './duration';

describe('parseDuration', () => {
  it('reads H:MM as minutes, hours beyond 24 allowed', () => {
    expect(parseDuration('3:45')).toBe(225);
    expect(parseDuration('0:30')).toBe(30);
    expect(parseDuration('55:30')).toBe(3330);
    expect(parseDuration(' 12:00 ')).toBe(720);
  });

  it('rejects anything else', () => {
    for (const text of ['9:75', 'abc', '', '3', '3:5', '3,75', '-1:00', '1000:00']) expect(parseDuration(text)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('writes hours and minutes', () => {
    expect(formatDuration(225)).toBe('3 h 45 min');
    expect(formatDuration(180)).toBe('3 h');
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(0)).toBe('0 h');
  });

  it('signs a surplus with + or the minus sign', () => {
    expect(formatDuration(720, { signed: true })).toBe('+12 h');
    expect(formatDuration(-555, { signed: true })).toBe('−9 h 15 min');
    expect(formatDuration(0, { signed: true })).toBe('+0 h');
  });
});

describe('toDurationText', () => {
  it('fills an input, without the sign', () => {
    expect(toDurationText(-555)).toBe('9:15');
    expect(toDurationText(0)).toBe('0:00');
    expect(toDurationText(3330)).toBe('55:30');
  });
});

describe('maskDuration', () => {
  it('inserts the colon before the last two digits', () => {
    expect(maskDuration('9')).toBe('9');
    expect(maskDuration('94')).toBe('94');
    expect(maskDuration('945')).toBe('9:45');
    expect(maskDuration('5:530')).toBe('55:30');
    expect(maskDuration('99959')).toBe('999:59');
  });

  it('drops letters and extra digits', () => {
    expect(maskDuration('ab')).toBe('');
    expect(maskDuration('9a4b5')).toBe('9:45');
    expect(maskDuration('123456')).toBe('123:45');
  });
});
