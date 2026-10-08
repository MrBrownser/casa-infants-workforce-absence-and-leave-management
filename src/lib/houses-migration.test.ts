// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOUSES } from './houses';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function houseContextMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_house_context'));
  if (!folder) throw new Error('house_context migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('house_context migration', () => {
  const sql = houseContextMigration();

  it('inserts exactly the Houses listed in HOUSES', () => {
    const inserted = [...sql.matchAll(/\('([a-z-]+)', '([^']+)'\)/g)].map(([, slug, name]) => ({ slug, name }));
    expect(inserted).toEqual(HOUSES.map(({ slug, name }) => ({ slug, name })));
  });

  it('keeps the hand-written membership constraints', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS btree_gist');
    expect(sql).toContain('"house_memberships_period_check"');
    expect(sql).toContain('"house_memberships_no_overlap"');
    expect(sql).toMatch(/daterange\("starts_on", "ends_on", '\[\]'\) WITH &&/);
  });
});
