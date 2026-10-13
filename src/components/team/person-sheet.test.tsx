import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deactivatePersonAction,
  movePersonAction,
  reactivatePersonAction,
  renamePersonAction,
} from '@/app/(app)/[house]/team/actions';
import type { PersonDetails } from '@/lib/team';
import { PersonSheet } from './person-sheet';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/app/(app)/[house]/team/actions', () => ({
  renamePersonAction: vi.fn(async () => ({ ok: true })),
  movePersonAction: vi.fn(async () => ({ ok: true })),
  deactivatePersonAction: vi.fn(async () => ({ ok: true })),
  reactivatePersonAction: vi.fn(async () => ({ ok: true })),
  saveBalancesAction: vi.fn(async () => ({ ok: true })),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const details = (active = true): PersonDetails => ({
  person: { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire', postKey: 'et', seat: 1, startedOn: '2025-09-01', active },
  year: 2026,
  balances: { vacationDays: 31, carriedDays: 0, surplusMinutes: 0 },
  stored: false,
});
const vacant = [
  { value: 'carme-aymerich:et:1', label: 'Carme Aymerich · Educadora de tardes' },
  { value: 'paulo-freire:ct:1', label: 'Paulo Freire · Corretorn' },
];

beforeEach(() => vi.clearAllMocks());

describe('PersonSheet', () => {
  it('describes the person and closes back to the team page', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    expect(screen.getByRole('dialog', { name: 'Roger Beltrán Camps' })).toBeInTheDocument();
    expect(screen.getByText('Paulo Freire · Educadora de tardes · des del 01/09/2025')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(push).toHaveBeenCalledWith('/paulo-freire/team', { scroll: false });
  });

  it('renames keeping the same person', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    const name = screen.getByLabelText('Nom complet');
    await userEvent.clear(name);
    await userEvent.type(name, 'Roger Beltran Camps');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(renamePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID, fullName: 'Roger Beltran Camps' });
    expect(await screen.findByText('Desat.')).toBeInTheDocument();
  });

  it('keeps "Desat." when the new name comes back from the server', async () => {
    const { rerender } = render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    const name = screen.getByLabelText('Nom complet');
    await userEvent.clear(name);
    await userEvent.type(name, 'Roger Beltran Camps');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(await screen.findByText('Desat.')).toBeInTheDocument();
    const renamed = details();
    renamed.person = { ...renamed.person, fullName: 'Roger Beltran Camps' };
    rerender(<PersonSheet houseSlug="paulo-freire" details={renamed} vacantSeats={vacant} today="2026-10-13" />);
    expect(screen.getByText('Desat.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom complet')).toHaveValue('Roger Beltran Camps');
  });

  it('keeps the name and shows the error when renaming fails', async () => {
    vi.mocked(renamePersonAction).mockResolvedValueOnce({ ok: false, message: "Aquesta persona no és d'aquesta casa." });
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    const name = screen.getByLabelText('Nom complet');
    await userEvent.type(name, ' Jr');
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Aquesta persona no és d'aquesta casa.");
    expect(name).toHaveValue('Roger Beltrán Camps Jr');
  });

  it('rejects a blank name without calling the server', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.clear(screen.getByLabelText('Nom complet'));
    await userEvent.click(screen.getByRole('button', { name: 'Desa el nom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escriu el nom complet.');
    expect(renamePersonAction).not.toHaveBeenCalled();
  });

  it('moves an active person to a vacant seat', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.selectOptions(screen.getByLabelText('Lloc vacant'), 'carme-aymerich:et:1');
    await userEvent.click(screen.getByRole('button', { name: 'Mou' }));
    expect(movePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' });
  });

  it('clears the choice and confirms after a move', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    const select = screen.getByLabelText('Lloc vacant');
    await userEvent.selectOptions(select, 'paulo-freire:ct:1');
    await userEvent.click(screen.getByRole('button', { name: 'Mou' }));
    expect(await screen.findByText('Fet.')).toBeInTheDocument();
    expect(select).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Mou' }));
    expect(movePersonAction).toHaveBeenCalledTimes(1);
  });

  it('asks before moving someone to former members', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.click(screen.getByRole('button', { name: 'Passa a antics membres' }));
    expect(deactivatePersonAction).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Confirmació' });
    expect(within(confirm).getByText(/deixarà el lloc vacant/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sí, deixa el lloc vacant' }));
    expect(deactivatePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID });
  });

  it('offers to reactivate an inactive person instead of moving them', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details(false)} vacantSeats={vacant} today="2026-10-13" />);
    expect(screen.queryByRole('button', { name: 'Mou' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Passa a antics membres' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Lloc vacant'), 'paulo-freire:ct:1');
    await userEvent.click(screen.getByRole('button', { name: 'Reincorpora' }));
    expect(reactivatePersonAction).toHaveBeenCalledWith('paulo-freire', { personId: ID, seat: 'paulo-freire:ct:1' });
  });

  it('uses copy that fits any person, not only women', async () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={vacant} today="2026-10-13" />);
    await userEvent.click(screen.getByRole('button', { name: 'Passa a antics membres' }));
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).not.toMatch(/Mou-la|la pots/);
    expect(text).toContain('Roger Beltrán Camps deixarà el lloc vacant. Es guarden les seves dades i saldos per si torna.');
  });

  it('says so when there is no vacant seat', () => {
    render(<PersonSheet houseSlug="paulo-freire" details={details()} vacantSeats={[]} today="2026-10-13" />);
    expect(screen.getByText('No hi ha cap lloc vacant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mou' })).toBeNull();
  });
});
