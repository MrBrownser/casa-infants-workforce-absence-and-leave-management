// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function allMigrations(): string {
  return readdirSync(migrationsDir)
    .filter((folder) => /^\d+_/.test(folder))
    .sort()
    .map((folder) => readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8'))
    .join('\n');
}

// Supabase's Data API reads the public schema with the anon key: RLS with no
// policies closes it. This also fails when a later migration adds a table
// without enabling RLS on it.
describe('Row Level Security', () => {
  const sql = allMigrations();
  const tables = ['_prisma_migrations', ...[...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map(([, name]) => name)];

  it('is enabled on every table', () => {
    expect(tables).toEqual(expect.arrayContaining(['houses', 'people', 'person_years', 'aps']));
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('has no policies and is not forced on the owner (the app)', () => {
    expect(sql).not.toMatch(/CREATE POLICY|FORCE ROW LEVEL SECURITY/);
  });
});
