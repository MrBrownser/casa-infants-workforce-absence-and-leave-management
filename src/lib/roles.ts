// Occupational roles (SPEC-002 FR-001), shared by both Houses. Keep in sync
// with the rows inserted by the staffing migration (a test checks it). Roles
// carry no schedule and no application permission.
export const ROLES = [
  { code: 'PDG', label: 'Pedagoga' },
  { code: 'PSI', label: 'Psicòloga' },
  { code: 'ER', label: 'Educadora referent' },
  { code: 'TFM', label: 'Treballadora familiar de matins' },
  { code: 'TFT', label: 'Treballadora familiar de tardes' },
  { code: 'ET', label: 'Educadora de tardes' },
  { code: 'ECS', label: 'Educadora de cap de setmana' },
  { code: 'EN', label: 'Educadora de nit' },
  { code: 'CT', label: 'Corretor' },
] as const;

export type Role = (typeof ROLES)[number];
export type RoleCode = Role['code'];

export const ROLE_CODES = ROLES.map((role) => role.code) as [RoleCode, ...RoleCode[]];

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === 'string' && ROLES.some((role) => role.code === value);
}

export function findRole(code: string): Role | undefined {
  return ROLES.find((role) => role.code === code);
}

/** Catalogue position, for grouping positions by role. */
export function roleOrder(code: RoleCode): number {
  return ROLE_CODES.indexOf(code);
}
