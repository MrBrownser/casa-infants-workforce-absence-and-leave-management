import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import type { PersonRecord } from '@/lib/team';
import { SaldosBoard } from './saldos-board';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), unstable_rethrow: vi.fn() }));
vi.mock('@/app/(app)/[house]/saldos/actions', () => ({
  addApAction: vi.fn(),
  deleteApAction: vi.fn(),
  restoreApAction: vi.fn(),
}));

const ROGER = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const MERITXELL = '2d8b4c74-3e6a-4b9c-9c73-4f5a9e3a0cb2';
const NURIA = '3e9c5d85-4f7b-4cad-8d84-5a6b0f4b1dc3';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';

const person = (id: string, fullName: string, house: PersonRecord['house'], postKey: string, active = true): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active,
});

const aps: ApRecord[] = [
  { id: AP_ID, personId: DAVID, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-03-18', minutes: 660 },
  { id: 'n1', personId: NURIA, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-02-06', minutes: 480 },
];

const view = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [
    person(ROGER, 'Roger Beltrán Camps', 'paulo-freire', 'et'),
    person(DAVID, 'David Valls Medina', 'paulo-freire', 'en'),
    person(MERITXELL, 'Meritxell Torres Vila', null, 'pdg'),
    person(NURIA, 'Núria Roca Ferrer', 'paulo-freire', 'tfm', false),
  ],
  openings: new Map([
    [ROGER, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }],
    [DAVID, { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 }],
  ]),
  aps,
});

function renderBoard(personId: string | null = null) {
  return render(<SaldosBoard houseSlug="paulo-freire" houseName="Paulo Freire" currentYear={2026} view={view} personId={personId} />);
}

const tableNames = () => within(screen.getAllByRole('table')[0]).getAllByRole('link').map((link) => link.textContent);

beforeEach(() => vi.clearAllMocks());

describe('SaldosBoard list', () => {
  it('shows the House, the year and the year switcher', () => {
    renderBoard();
    expect(screen.getByRole('heading', { level: 1, name: 'Saldos 2026' })).toBeInTheDocument();
    expect(screen.getByText('Paulo Freire')).toBeInTheDocument();
    const years = screen.getByRole('navigation', { name: 'Any' });
    expect(within(years).getByRole('link', { name: '2025' })).toHaveAttribute('href', '/paulo-freire/saldos?year=2025');
    expect(within(years).getByRole('link', { name: '2026' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists each active person with their balances, and who owes hours', () => {
    renderBoard();
    expect(tableNames()).toEqual(['David Valls Medina', 'Meritxell Torres Vila', 'Roger Beltrán Camps']);
    const table = screen.getAllByRole('table')[0];
    const roger = within(table).getByRole('link', { name: 'Roger Beltrán Camps' }).closest('tr')!;
    expect(roger).toHaveTextContent('33 dies (2 AA)');
    expect(roger).toHaveTextContent('Deu 4 h');
    expect(within(table).getByRole('link', { name: 'David Valls Medina' })).toHaveAttribute('href', `/paulo-freire/saldos?year=2026&person=${DAVID}`);
  });

  it('totals the AP hours used and who owes hours', () => {
    renderBoard();
    expect(screen.getByText('AP no recuperables usats').closest('div')).toHaveTextContent('11 hde 72 h de tot l\'equip');
    expect(screen.getByRole('button', { name: /Han de retornar hores/ })).toHaveTextContent('2 persones13 h 15 min en total');
  });

  it('filters the people who owe hours from the stat card and the segmented control', async () => {
    renderBoard();
    await userEvent.click(screen.getByRole('button', { name: /Han de retornar hores/ }));
    expect(tableNames()).toEqual(['David Valls Medina', 'Roger Beltrán Camps']);
    expect(screen.getByRole('button', { name: 'Deuen hores' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Tothom' }));
    expect(tableNames()).toHaveLength(3);
  });

  it('searches ignoring accents and case', async () => {
    renderBoard();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca una persona' }), 'BELTRAN');
    expect(tableNames()).toEqual(['Roger Beltrán Camps']);
  });

  it('says so when nobody matches', async () => {
    renderBoard();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca una persona' }), 'zzz');
    expect(screen.getByText('Ningú coincideix amb aquest filtre.')).toBeInTheDocument();
  });

  it('keeps former members with data apart, under "Antics membres"', () => {
    renderBoard();
    const group = screen.getByText('Antics membres').closest('details')!;
    expect(within(group).getAllByText('Núria Roca Ferrer').length).toBeGreaterThan(0);
    expect(tableNames()).not.toContain('Núria Roca Ferrer');
  });
});
