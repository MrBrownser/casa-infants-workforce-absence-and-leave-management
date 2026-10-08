// src/lib/staffing-migration.test.ts
// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLES } from './roles';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function staffingMigration(): string {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_staffing'));
  if (!folder) throw new Error('staffing migration not found');
  return readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('staffing migration', () => {
  const sql = staffingMigration();

  it('inserts exactly the roles listed in ROLES, idempotently', () => {
    const block = sql.slice(sql.indexOf('INSERT INTO "occupational_roles"'));
    const rows = [...block.slice(0, block.indexOf(';')).matchAll(/\('([A-Z]+)', '([^']+)'\)/g)].map(([, code, label]) => ({ code, label }));
    expect(rows).toEqual(ROLES.map(({ code, label }) => ({ code, label })));
    expect(block).toMatch(/ON CONFLICT \("code"\) DO NOTHING/);
  });

  it('keeps the hand-written constraints and triggers', () => {
    for (const name of [
      '"positions_normalise_and_freeze"',
      '"positions_label_not_blank"',
      '"position_assignments_period_check"',
      '"position_assignments_employee_no_overlap"',
      '"position_assignments_position_no_overlap"',
      '"assert_assignments_within_membership"',
      '"position_assignments_within_membership"',
      '"house_memberships_keep_assignments"',
    ]) {
      expect(sql).toContain(name);
    }
    expect(sql).toContain("ERRCODE = 'CI001'");
    expect(sql).toContain("ERRCODE = 'CI002'");
    expect(sql.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(2);
    expect(sql).toContain('FOREIGN KEY ("position_id", "house_id") REFERENCES "positions"("id", "house_id")');
  });
});
