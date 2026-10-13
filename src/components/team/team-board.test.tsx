import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildTeamView, type PersonRecord } from '@/lib/team';
import { TeamBoard } from './team-board';

vi.mock('@/app/(app)/[house]/team/actions', () => ({ addPersonAction: vi.fn() }));

const p = (id: string, fullName: string, house: PersonRecord['house'], postKey: string, extra: Partial<PersonRecord> = {}): PersonRecord => ({
  id,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: null,
  active: true,
  ...extra,
});

const TODAY = '2026-10-13';
const team = buildTeamView(
  'paulo-freire',
  [
    p('a', 'Meritxell Torres Vila', null, 'pdg'),
    p('b', 'David Valls Medina', 'paulo-freire', 'en', { seat: 1 }),
    p('c', 'Cristina Pascual Duran', 'paulo-freire', 'en', { seat: 2 }),
    p('d', 'Pol Jiménez Alcover', 'paulo-freire', 'ct', { active: false }),
  ],
  TODAY,
);

describe('TeamBoard', () => {
  it('shows the shared posts first, then every post of the House', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Compartits entre les dues cases', 'Llocs de Paulo Freire', 'Antics membres']);
    const shared = screen.getByRole('region', { name: 'Compartits entre les dues cases' });
    expect(within(shared).getByText('Pedagoga')).toBeInTheDocument();
    expect(within(shared).getByRole('link', { name: /Meritxell Torres Vila/ })).toHaveAttribute('href', '/paulo-freire/team?person=a');
  });

  it('shows each post with its label and schedule, and vacant seats with an add button', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const ct = screen.getByRole('listitem', { name: 'Corretorn' });
    expect(within(ct).getByText('Sense horari fix')).toBeInTheDocument();
    expect(within(ct).getByText('Vacant')).toBeInTheDocument();
    expect(within(ct).getByRole('button', { name: 'Afegeix una persona a Paulo Freire · Corretorn' })).toBeInTheDocument();
    const et = screen.getByRole('listitem', { name: 'Educadora de tardes' });
    expect(within(et).getByText('dl–dv 14:00–22:00')).toBeInTheDocument();
  });

  it('opens the add form with the cursor in the name field', async () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    await userEvent.click(screen.getByRole('button', { name: 'Afegeix una persona a Paulo Freire · Corretorn' }));
    expect(screen.getByRole('dialog', { name: 'Afegeix una persona' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nom complet')).toHaveFocus();
  });

  it('shows the two night people and their alternating weeks', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const en = screen.getByRole('listitem', { name: 'Educadora de nit' });
    expect(within(en).getByText(/setmanes alternes/)).toBeInTheDocument();
    expect(within(en).getByRole('link', { name: /David Valls Medina/ })).toBeInTheDocument();
    expect(within(en).getByRole('link', { name: /Cristina Pascual Duran/ })).toBeInTheDocument();
    expect(within(en).getByText('Aquesta setmana')).toBeInTheDocument();
    expect(within(en).getByText('La setmana vinent')).toBeInTheDocument();
  });

  it('lists inactive people under Antics membres', () => {
    render(<TeamBoard houseSlug="paulo-freire" houseName="Paulo Freire" team={team} today={TODAY} />);
    const former = screen.getByRole('region', { name: 'Antics membres' });
    expect(within(former).getByRole('link', { name: /Pol Jiménez Alcover/ })).toBeInTheDocument();
    expect(within(former).getByText('Paulo Freire · Corretorn')).toBeInTheDocument();
  });
});
