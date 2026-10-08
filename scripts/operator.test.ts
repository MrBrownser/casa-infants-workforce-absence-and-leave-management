// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { UsageError, clerkInstance, confirmOrAbort, databaseHost, parseAccessArgs, parseLinkArgs, targetBanner } from './operator';

const EMPLOYEE = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';

describe('parseAccessArgs', () => {
  it('parses grant, revoke and list', () => {
    expect(parseAccessArgs(['grant', 'user_2abc'])).toEqual({ command: 'grant', clerkUserId: 'user_2abc', yes: false });
    expect(parseAccessArgs(['revoke', 'user_2abc', '--yes'])).toEqual({ command: 'revoke', clerkUserId: 'user_2abc', yes: true });
    expect(parseAccessArgs(['list'])).toEqual({ command: 'list', yes: false });
  });

  it('rejects anything else, including emails and names', () => {
    for (const argv of [[], ['grant'], ['grant', 'ana@example.org'], ['grant', 'Ana Puig'], ['delete', 'user_1'], ['grant', 'user_1', 'extra']]) {
      expect(() => parseAccessArgs(argv)).toThrow(UsageError);
    }
  });
});

describe('parseLinkArgs', () => {
  it('parses link and unlink', () => {
    expect(parseLinkArgs(['link', EMPLOYEE, 'user_2abc'])).toEqual({ command: 'link', employeeId: EMPLOYEE, clerkUserId: 'user_2abc', yes: false });
    expect(parseLinkArgs(['unlink', EMPLOYEE, '--yes'])).toEqual({ command: 'unlink', employeeId: EMPLOYEE, yes: true });
  });

  it('rejects malformed IDs', () => {
    expect(() => parseLinkArgs(['link', 'abc', 'user_1'])).toThrow(UsageError);
    expect(() => parseLinkArgs(['link', EMPLOYEE, 'ana@example.org'])).toThrow(UsageError);
  });
});

describe('target banner', () => {
  it('names the Clerk instance and database host, never secrets', () => {
    expect(clerkInstance('sk_test_x')).toBe('development');
    expect(clerkInstance('sk_live_x')).toBe('production');
    expect(clerkInstance(undefined)).toBe('unknown');
    expect(databaseHost('postgresql://u:secret@db.example.eu:5432/postgres')).toBe('db.example.eu:5432');
    const banner = targetBanner({ CLERK_SECRET_KEY: 'sk_live_abc', DIRECT_URL: 'postgresql://u:secret@db.example.eu:5432/postgres' });
    expect(banner).toContain('production');
    expect(banner).not.toContain('secret');
    expect(banner).not.toContain('sk_live_abc');
  });
});

describe('confirmOrAbort', () => {
  it('skips the question with --yes and otherwise asks', async () => {
    const ask = vi.fn().mockResolvedValue(false);
    await expect(confirmOrAbort('Grant?', true, ask)).resolves.toBe(true);
    expect(ask).not.toHaveBeenCalled();
    await expect(confirmOrAbort('Grant?', false, ask)).resolves.toBe(false);
    expect(ask).toHaveBeenCalledWith('Grant?');
  });
});
