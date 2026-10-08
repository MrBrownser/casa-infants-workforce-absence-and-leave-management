// src/lib/staffing-views.ts
// Shapes of the staffing views that pages pass to client components. Types
// only, so client code never imports the server query module.
import type { IsoDate } from './dates';
import type { Membership } from './house-membership';
import type { HouseSlug } from './houses';
import type { RoleCode } from './roles';
import type { Assignment, Position } from './staffing';

export type PersonRow = {
  employeeId: string;
  fullName: string;
  memberSince: IsoDate;
  positionId: string | null;
  positionLabel: string | null;
};
export type PositionRow = {
  positionId: string;
  label: string;
  roleCode: RoleCode;
  occupant: { employeeId: string; fullName: string } | null;
};
export type FormerRow = { employeeId: string; fullName: string; startsOn: IsoDate; endsOn: IsoDate };
export type TeamView = { people: PersonRow[]; positions: PositionRow[]; former: FormerRow[] };

export type HistoryMembership = Membership & { houseSlug: HouseSlug; houseName: string };
export type HistoryAssignment = Assignment & { positionLabel: string; roleCode: RoleCode; houseSlug: HouseSlug; houseName: string };
export type EmployeeHistory = {
  employee: { id: string; fullName: string; updatedAt: string };
  memberships: HistoryMembership[];
  assignments: HistoryAssignment[];
};
export type PositionDetail = { position: Position; history: (Assignment & { fullName: string })[] };

/** Option rows for selects. */
export type MemberOption = { employeeId: string; fullName: string };
export type EmployeeOption = { employeeId: string; fullName: string; currentHouseName: string | null };
