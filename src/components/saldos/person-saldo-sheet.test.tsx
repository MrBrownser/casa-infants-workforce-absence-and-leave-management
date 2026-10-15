// src/components/saldos/person-saldo-sheet.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import { PersonSaldoSheet } from './person-saldo-sheet';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const ap = (id: string, date: string, minutes: number): ApRecord => ({
  id,
  personId: DAVID,
  house: 'paulo-freire',
  kind: 'non_recoverable',
  year: 2026,
  date,
  minutes,
});
const [row] = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [{ id: DAVID, fullName: 'David Valls Medina', house: 'paulo-freire', postKey: 'en', seat: 1, startedOn: '2025-09-01', active: true }],
  openings: new Map([[DAVID, { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 }]]),
  aps: [ap('b', '2026-03-19', 660), ap('c', '2027-01-15', 120), ap('a', '2026-03-18', 660)],
}).rows;

const onRecord = vi.fn();
const onDelete = vi.fn();
async function openSheet() {
  render(<PersonSaldoSheet houseSlug="paulo-freire" year={2026} row={row} deleting={false} onRecord={onRecord} onDelete={onDelete} />);
  return screen.findByRole('dialog', { name: 'David Valls Medina' });
}
const section = (heading: RegExp) => screen.getByRole('heading', { name: heading }).closest('section')!;

beforeEach(() => vi.clearAllMocks());

describe('PersonSaldoSheet', () => {
  it('shows the balances and reminds what the person owes', async () => {
    await openSheet();
    expect(screen.getByText('Ha de retornar 9 h 15 min treballant quan calgui.')).toBeInTheDocument();
    expect(screen.getByText('Deu 9 h 15 min')).toBeInTheDocument();
    expect(screen.getByText('Deu 9 h 15 min').parentElement!.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/31 dies ·/)).toHaveTextContent("31 dies · Els períodes s'apuntaran a Vacances.");
  });

  it('lists the APs by date with the weekday, and labels next January', async () => {
    await openSheet();
    const items = within(section(/^AP no recuperables/)).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['dc. 18/03/202611 h', 'dj. 19/03/202611 h', 'dv. 15/01/2027 (gener 2027)2 h']);
    expect(within(section(/^AP recuperables/)).getByText('Cap AP recuperable aquest any.')).toBeInTheDocument();
  });

  it('shows the opening surplus with a link to edit it on Equip', async () => {
    await openSheet();
    expect(screen.getByText(/Excedent a l'inici de l'any/)).toHaveTextContent("Excedent a l'inici de l'any: −9 h 15 min");
    expect(screen.getByRole('link', { name: "Edita'l a Equip" })).toHaveAttribute('href', `/paulo-freire/team?person=${DAVID}&year=2026`);
  });

  it('asks to record an AP and to delete one', async () => {
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar AP' }));
    expect(onRecord).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: "Esborra l'AP del dc. 18/03/2026" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', date: '2026-03-18' }));
  });

  it('closes back to Saldos of the same year', async () => {
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/paulo-freire/saldos?year=2026', { scroll: false }));
  });
});
