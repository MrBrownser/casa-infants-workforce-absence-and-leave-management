import 'server-only';
import { requireDirector } from '@/lib/auth';
import { todayInMadrid, type IsoDate } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import {
  getEmployeeHistory,
  getPositionDetail,
  getTeamView,
  listEmployeeOptions,
  listMemberOptions,
  listPositionRows,
} from './staffing-queries';

// Staffing reads for pages. Every function checks the director grant itself:
// pages and layouts render in parallel, so a parent check does not protect
// these queries (FR-008).

export async function loadTeamView(houseId: string, date: IsoDate) {
  await requireDirector();
  return getTeamView(prisma, houseId, date, todayInMadrid());
}

export async function loadEmployeeHistory(houseId: string, employeeId: string) {
  await requireDirector();
  return getEmployeeHistory(prisma, houseId, employeeId);
}

export async function loadPositionDetail(houseId: string, positionId: string) {
  await requireDirector();
  return getPositionDetail(prisma, houseId, positionId);
}

export async function loadPositionRows(houseId: string, date: IsoDate) {
  await requireDirector();
  return listPositionRows(prisma, houseId, date);
}

export async function loadMemberOptions(houseId: string, date: IsoDate) {
  await requireDirector();
  return listMemberOptions(prisma, houseId, date);
}

export async function loadEmployeeOptions(houseId: string) {
  await requireDirector();
  return listEmployeeOptions(prisma, houseId, todayInMadrid());
}
