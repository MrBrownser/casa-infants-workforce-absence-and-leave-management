import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBalancesAction } from '@/app/(app)/[house]/team/actions';
import type { PersonDetails } from '@/lib/team';
import { BalancesSection } from './balances-section';

vi.mock('@/app/(app)/[house]/team/actions', () => ({ saveBalancesAction: vi.fn(async () => ({ ok: true })) }));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const mireia = (stored: boolean, balances = { vacationDays: 31, carriedDays: 0, surplusMinutes: 0 }): PersonDetails => ({
  person: { id: ID, fullName: 'Mireia Santos Rovira', house: 'paulo-freire', postKey: 'ecs', seat: 1, startedOn: '2025-09-01', active: true },
  year: 2026,
  balances,
  stored,
});

beforeEach(() => vi.clearAllMocks());

describe('BalancesSection', () => {
  it('shows defaults and says they are not saved yet', () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    expect(screen.getByText('31 dies')).toBeInTheDocument();
    expect(screen.getByText('+0 h')).toBeInTheDocument();
    expect(screen.getByText(/Encara no s'han desat/)).toBeInTheDocument();
  });

  it('links the previous, current and next year', () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    expect(screen.getByRole('link', { name: '2026' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '2027' })).toHaveAttribute('href', `/paulo-freire/team?person=${ID}&year=2027`);
    expect(screen.getByRole('link', { name: '2025' })).toBeInTheDocument();
  });

  it('shows stored balances with a signed surplus', () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(true, { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 })} currentYear={2026} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('+12 h')).toBeInTheDocument();
    expect(screen.queryByText(/Encara no s'han desat/)).toBeNull();
    expect(screen.getByLabelText("Excedent de calendari a l'inici de l'any")).toHaveValue('12:00');
  });

  it('saves a negative surplus typed as − 9:15', async () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Excedent negatiu' }));
    const surplus = screen.getByLabelText("Excedent de calendari a l'inici de l'any");
    await userEvent.clear(surplus);
    await userEvent.type(surplus, '915');
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    expect(saveBalancesAction).toHaveBeenCalledWith('paulo-freire', {
      personId: ID,
      year: 2026,
      vacationDays: '31',
      carriedDays: '0',
      surplusSign: '-',
      surplus: '9:15',
    });
  });

  it('keeps "Desat." when the saved values come back from the server', async () => {
    const { rerender } = render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    const surplus = screen.getByLabelText("Excedent de calendari a l'inici de l'any");
    await userEvent.clear(surplus);
    await userEvent.type(surplus, '1200');
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    expect(await screen.findByText('Desat.')).toBeInTheDocument();
    rerender(<BalancesSection houseSlug="paulo-freire" details={mireia(true, { vacationDays: 31, carriedDays: 0, surplusMinutes: 720 })} currentYear={2026} />);
    expect(screen.getByText('Desat.')).toBeInTheDocument();
    expect(screen.getByText('+12 h')).toBeInTheDocument();
    expect(screen.getByLabelText("Excedent de calendari a l'inici de l'any")).toHaveValue('12:00');
  });

  it('starts clean when switching year', async () => {
    const { rerender } = render(<BalancesSection houseSlug="paulo-freire" details={mireia(true, { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 })} currentYear={2026} />);
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    expect(await screen.findByText('Desat.')).toBeInTheDocument();
    rerender(<BalancesSection houseSlug="paulo-freire" details={{ ...mireia(false), year: 2027 }} currentYear={2026} />);
    expect(screen.queryByText('Desat.')).toBeNull();
    expect(screen.getByLabelText('Dies AA (any anterior)')).toHaveValue('0');
  });

  it('shows an error with an icon as soon as letters are typed', async () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    const surplus = screen.getByLabelText("Excedent de calendari a l'inici de l'any");
    await userEvent.clear(surplus);
    await userEvent.type(surplus, 'tres');
    expect(surplus).toHaveValue('tres');
    await userEvent.tab();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Escriu les hores com H:MM, per exemple 3:45.');
    expect(alert.querySelector('svg')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    expect(saveBalancesAction).not.toHaveBeenCalled();
  });

  it('shows an error with an icon for 9:75 and saves nothing', async () => {
    render(<BalancesSection houseSlug="paulo-freire" details={mireia(false)} currentYear={2026} />);
    const surplus = screen.getByLabelText("Excedent de calendari a l'inici de l'any");
    await userEvent.clear(surplus);
    await userEvent.type(surplus, '975');
    await userEvent.click(screen.getByRole('button', { name: 'Desa els saldos de 2026' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Escriu les hores com H:MM, per exemple 3:45.');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(saveBalancesAction).not.toHaveBeenCalled();
  });
});
