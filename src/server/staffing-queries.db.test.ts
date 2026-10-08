// src/server/staffing-queries.db.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestClient, houseIds, insertAssignment, insertEmployee, insertMembership, insertPosition, resetData } from '../../test/db/helpers';
import { getEmployeeHistory, getPositionDetail, getTeamView, listEmployeeOptions, listMemberOptions, listPositionRows } from './staffing-queries';

const db = createTestClient();

beforeEach(() => resetData(db));
afterAll(() => db.$disconnect());

// Ana: PF 2026-01-01..06-30 holding "ER 2", then CA from 07-01 on "ER A".
// Marta: PF from 2025-09-01 holding "ER 10". Núria: PF from 2025-09-01, no position.
async function setup() {
  const { pf, ca } = await houseIds(db);
  const ana = await insertEmployee(db, 'Ana Puig');
  const marta = await insertEmployee(db, 'Marta Soler');
  const nuria = await insertEmployee(db, 'Núria Costa');
  await insertMembership(db, ana, pf, '2026-01-01', '2026-06-30');
  await insertMembership(db, ana, ca, '2026-07-01');
  await insertMembership(db, marta, pf, '2025-09-01');
  await insertMembership(db, nuria, pf, '2025-09-01');
  const er2 = await insertPosition(db, pf, 'ER', 'ER 2');
  const er10 = await insertPosition(db, pf, 'ER', 'ER 10');
  const ct = await insertPosition(db, pf, 'CT', 'CT');
  const pdg = await insertPosition(db, pf, 'PDG', 'PDG');
  const erA = await insertPosition(db, ca, 'ER', 'ER A');
  await insertAssignment(db, ana, er2, pf, '2026-01-01', '2026-06-30');
  await insertAssignment(db, ana, erA, ca, '2026-07-01');
  await insertAssignment(db, marta, er10, pf, '2025-09-01');
  return { pf, ca, ana, marta, nuria, er2, er10, ct, pdg, erA };
}

describe('getTeamView', () => {
  it('lists people with positions on the date, sorted by name (AC-014)', async () => {
    const { pf } = await setup();
    const before = await getTeamView(db, pf, '2026-06-30', '2026-06-30');
    expect(before.people.map((p) => [p.fullName, p.positionLabel])).toEqual([
      ['Ana Puig', 'ER 2'],
      ['Marta Soler', 'ER 10'],
      ['Núria Costa', null],
    ]);
    const after = await getTeamView(db, pf, '2026-07-01', '2026-07-01');
    expect(after.people.map((p) => p.fullName)).toEqual(['Marta Soler', 'Núria Costa']);
  });

  it('lists positions in catalogue order with vacancies (AC-008)', async () => {
    const { pf } = await setup();
    const view = await getTeamView(db, pf, '2026-08-01', '2026-08-01');
    expect(view.positions.map((p) => [p.label, p.occupant?.fullName ?? null])).toEqual([
      ['PDG', null],
      ['ER 2', null],
      ['ER 10', 'Marta Soler'],
      ['CT', null],
    ]);
  });

  it('lists former members relative to today, not the selected date', async () => {
    const { pf } = await setup();
    const view = await getTeamView(db, pf, '2026-03-01', '2026-08-01');
    expect(view.former).toEqual([{ employeeId: expect.any(String), fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: '2026-06-30' }]);
  });
});

describe('options', () => {
  it('lists current members and candidates for a new membership', async () => {
    const { pf, ca } = await setup();
    expect((await listMemberOptions(db, pf, '2026-08-01')).map((o) => o.fullName)).toEqual(['Marta Soler', 'Núria Costa']);
    expect(await listEmployeeOptions(db, pf, '2026-08-01')).toEqual([{ employeeId: expect.any(String), fullName: 'Ana Puig', currentHouseName: 'Carme Aymerich' }]);
    expect((await listEmployeeOptions(db, ca, '2026-08-01')).map((o) => o.fullName)).toEqual(['Marta Soler', 'Núria Costa']);
    expect((await listPositionRows(db, ca, '2026-08-01')).map((r) => [r.label, r.occupant?.fullName])).toEqual([['ER A', 'Ana Puig']]);
  });
});

describe('getEmployeeHistory', () => {
  it('shows both Houses in date order from either House', async () => {
    const { pf, ca, ana } = await setup();
    for (const house of [pf, ca]) {
      const history = await getEmployeeHistory(db, house, ana);
      expect(history?.memberships.map((m) => [m.houseName, m.startsOn, m.endsOn])).toEqual([
        ['Paulo Freire', '2026-01-01', '2026-06-30'],
        ['Carme Aymerich', '2026-07-01', null],
      ]);
      expect(history?.assignments.map((a) => [a.positionLabel, a.houseSlug])).toEqual([
        ['ER 2', 'paulo-freire'],
        ['ER A', 'carme-aymerich'],
      ]);
    }
  });

  it('is null for another House, an unknown or a malformed ID (Review Focus 1)', async () => {
    const { ca, marta } = await setup();
    expect(await getEmployeeHistory(db, ca, marta)).toBeNull();
    expect(await getEmployeeHistory(db, ca, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await getEmployeeHistory(db, ca, 'abc')).toBeNull();
  });
});

describe('getPositionDetail', () => {
  it('returns the history of a position of the House only', async () => {
    const { pf, ca, er2 } = await setup();
    expect((await getPositionDetail(db, pf, er2))?.history.map((h) => [h.fullName, h.startsOn, h.endsOn])).toEqual([['Ana Puig', '2026-01-01', '2026-06-30']]);
    expect(await getPositionDetail(db, ca, er2)).toBeNull();
    expect(await getPositionDetail(db, pf, 'x')).toBeNull();
  });
});
