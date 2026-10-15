// src/components/saldos/saldos-board.actions.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addApAction, deleteApAction, restoreApAction } from '@/app/(app)/[house]/saldos/actions';
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
const LAIA = '2d8b4c74-3e6a-4b9c-9c73-4f5a9e3a0cb2';
const GONE = '3e9c5d85-4f7b-4cad-8d84-5a6b0f4b1dc3';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';

const person = (id: string, fullName: string, house: PersonRecord['house'], postKey: string): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active: true,
});
const aps: ApRecord[] = [{ id: AP_ID, personId: DAVID, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-03-18', minutes: 660 }];
const view = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [
    person(ROGER, 'Roger Beltrán Camps', 'paulo-freire', 'et'),
    person(DAVID, 'David Valls Medina', 'paulo-freire', 'en'),
    person(LAIA, 'Laia Vidal Mas', 'carme-aymerich', 'er'),
    { ...person(GONE, 'Berta Soler Pons', 'paulo-freire', 'en'), active: false },
  ],
  openings: new Map([[ROGER, { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 }]]),
  aps,
});
const removed = { personId: DAVID, kind: 'non_recoverable' as const, year: 2026, date: '2026-03-18', minutes: 660, house: 'paulo-freire' as const };

function renderBoard(personId: string | null = null) {
  return render(<SaldosBoard houseSlug="paulo-freire" houseName="Paulo Freire" currentYear={2026} view={view} personId={personId} />);
}

beforeEach(() => vi.clearAllMocks());

describe('SaldosBoard person details', () => {
  it('opens the person named in the URL', async () => {
    renderBoard(DAVID);
    expect(await screen.findByRole('dialog', { name: 'David Valls Medina' })).toBeInTheDocument();
  });

  it.each([LAIA, GONE, 'not-an-id'])('opens nothing for a person who is not listed here (%s)', (personId) => {
    renderBoard(personId);
    expect(screen.getByRole('heading', { level: 1, name: 'Saldos 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('SaldosBoard delete and undo', () => {
  it('deletes an AP from the sheet and undoes it from the toast', async () => {
    vi.mocked(deleteApAction).mockResolvedValue({ ok: true, data: { removed } });
    vi.mocked(restoreApAction).mockResolvedValue({ ok: true, data: { id: 'restored' } });
    renderBoard(DAVID);
    const sheet = await screen.findByRole('dialog', { name: 'David Valls Medina' });
    await userEvent.click(within(sheet).getByRole('button', { name: "Esborra l'AP del dc. 18/03/2026" }));
    expect(deleteApAction).toHaveBeenCalledWith('paulo-freire', { apId: AP_ID });
    // The toast is reachable while the sheet is open (portalled, design D11).
    expect(await screen.findByRole('status')).toHaveTextContent('Esborrat.');
    await userEvent.click(screen.getByRole('button', { name: 'Desfés' }));
    expect(restoreApAction).toHaveBeenCalledWith('paulo-freire', removed);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByRole('dialog', { name: 'David Valls Medina' })).toBeInTheDocument();
  });

  it('shows why a delete failed', async () => {
    vi.mocked(deleteApAction).mockResolvedValue({ ok: false, message: 'Aquest AP ja no existeix.' });
    renderBoard(DAVID);
    const sheet = await screen.findByRole('dialog', { name: 'David Valls Medina' });
    await userEvent.click(within(sheet).getByRole('button', { name: "Esborra l'AP del dc. 18/03/2026" }));
    expect(await screen.findByRole('status')).toHaveTextContent('Aquest AP ja no existeix.');
    expect(screen.queryByRole('button', { name: 'Desfés' })).toBeNull();
  });
});

describe('SaldosBoard recording', () => {
  it('records an AP from the header and undoes it', async () => {
    vi.mocked(addApAction).mockResolvedValue({ ok: true, data: { id: 'new-ap' } });
    vi.mocked(deleteApAction).mockResolvedValue({ ok: true, data: { removed } });
    renderBoard();
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar AP' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apuntar AP' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Persona'), ROGER);
    await userEvent.type(within(dialog).getByLabelText('Dia'), '10032026');
    await userEvent.type(within(dialog).getByLabelText('Hores'), '400');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apunta-ho' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Apuntar AP' })).toBeNull());
    expect(await screen.findByRole('status')).toHaveTextContent('Apuntat AP no recuperable de 4 h a Roger Beltrán Camps.');
    await userEvent.click(screen.getByRole('button', { name: 'Desfés' }));
    expect(deleteApAction).toHaveBeenCalledWith('paulo-freire', { apId: 'new-ap' });
  });

  it('records from the person sheet with the person already chosen', async () => {
    renderBoard(ROGER);
    const sheet = await screen.findByRole('dialog', { name: 'Roger Beltrán Camps' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Apuntar AP' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apuntar AP' });
    expect(within(dialog).getByLabelText('Persona')).toHaveValue(ROGER);
  });
});
