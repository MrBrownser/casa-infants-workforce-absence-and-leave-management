// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOUSES } from './houses';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function initMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_init'));
  if (!folder) throw new Error('init migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('init migration', () => {
  const sql = initMigration();

  it('inserts exactly the Houses listed in HOUSES', () => {
    const inserted = [...sql.matchAll(/\('([a-z-]+)', '([^']+)'\)/g)].map(([, slug, name]) => ({ slug, name }));
    expect(inserted).toEqual(HOUSES.map(({ slug, name }) => ({ slug, name })));
  });

  it('keeps one active person per seat, for House and shared posts', () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "people_active_house_seat_key" ON "people" ("house_id", "post_key", "seat") WHERE "active" AND "house_id" IS NOT NULL;',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "people_active_shared_seat_key" ON "people" ("post_key", "seat") WHERE "active" AND "house_id" IS NULL;',
    );
  });

  it('keeps the hand-written CHECKs', () => {
    for (const name of [
      'people_full_name_check',
      'people_seat_check',
      'person_years_year_check',
      'person_years_vacation_days_check',
      'person_years_carried_days_check',
      'person_years_surplus_minutes_check',
    ]) {
      expect(sql).toContain(`"${name}"`);
    }
  });
});
