// src/lib/aps-migration.test.ts
// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function apsMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_aps'));
  if (!folder) throw new Error('aps migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

// Prisma does not show these in schema.prisma (design D1); the database
// rejects impossible rows even if the app has a bug.
describe('aps migration', () => {
  const sql = apsMigration();

  it('keeps the hand-written CHECKs', () => {
    for (const name of ['aps_year_check', 'aps_date_check', 'aps_minutes_check']) {
      expect(sql).toContain(`"${name}"`);
    }
  });

  it('bounds the date to 31 January of the next year (FPOL32 §1)', () => {
    expect(sql).toContain('CHECK ("date" BETWEEN make_date("year", 1, 1) AND make_date("year" + 1, 1, 31))');
  });

  it('bounds one request to 24 h', () => {
    expect(sql).toContain('CHECK ("minutes" BETWEEN 1 AND 1440)');
  });
});
