// src/server/staffing-upgrade.db.test.ts
//
// AC-022: applying the staffing migration to a database that already holds
// SPEC-001 data keeps IDs, names, dates and the membership constraints.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, inject } from 'vitest';

const url = new URL(inject('databaseUrl'));
const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
const migration = (suffix: string) => {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith(suffix));
  if (!folder) throw new Error(`${suffix} migration not found`);
  return join(migrationsDir, folder, 'migration.sql');
};

function psql(database: string, args: string[]): string {
  return execFileSync(
    join(inject('pgBin'), 'psql'),
    ['-h', 'localhost', '-p', url.port, '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q', '-tA', ...args],
    { encoding: 'utf8', stdio: 'pipe' },
  ).trim();
}

const ANA = '00000000-0000-4000-8000-0000000000a1';

describe('staffing migration over SPEC-001 data', () => {
  beforeAll(() => {
    psql('casa_test', ['-c', 'DROP DATABASE IF EXISTS casa_upgrade']);
    psql('casa_test', ['-c', 'CREATE DATABASE casa_upgrade']);
    psql('casa_upgrade', ['-f', migration('_house_context')]);
    psql('casa_upgrade', [
      '-c',
      `INSERT INTO employees (id, full_name) VALUES ('${ANA}', 'Ana Puig');
       INSERT INTO house_memberships (employee_id, house_id, starts_on, ends_on)
         SELECT '${ANA}', id, '2025-09-01', '2026-06-30' FROM houses WHERE slug = 'paulo-freire';
       INSERT INTO house_memberships (employee_id, house_id, starts_on)
         SELECT '${ANA}', id, '2026-07-01' FROM houses WHERE slug = 'carme-aymerich';`,
    ]);
    psql('casa_upgrade', ['-f', migration('_staffing')]);
  });

  it('keeps employees and membership dates, and adds no assignments', () => {
    expect(psql('casa_upgrade', ['-c', `SELECT id || '|' || full_name FROM employees`])).toBe(`${ANA}|Ana Puig`);
    expect(psql('casa_upgrade', ['-c', `SELECT starts_on || '|' || coalesce(ends_on::text, '') FROM house_memberships ORDER BY starts_on`])).toBe(
      '2025-09-01|2026-06-30\n2026-07-01|',
    );
    expect(psql('casa_upgrade', ['-c', 'SELECT count(*) FROM position_assignments'])).toBe('0');
  });

  it('still rejects overlapping memberships', () => {
    expect(() =>
      psql('casa_upgrade', [
        '-c',
        `INSERT INTO house_memberships (employee_id, house_id, starts_on) SELECT '${ANA}', id, '2026-06-01' FROM houses WHERE slug = 'paulo-freire'`,
      ]),
    ).toThrow(/house_memberships_no_overlap/);
  });
});
