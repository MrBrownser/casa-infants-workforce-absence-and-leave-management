import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addApAction } from '@/app/(app)/[house]/saldos/actions';
import { HOURS_MESSAGE } from '@/lib/ap-schemas';
import type { ApKind, ApRecord } from '@/lib/balances';
import { buildSaldosView } from '@/lib/saldos';
import type { PersonRecord } from '@/lib/team';
import { ApForm } from './ap-form';

vi.mock('@/app/(app)/[house]/saldos/actions', () => ({
  addApAction: vi.fn(async () => ({ ok: true, data: { id: 'new-ap' } })),
}));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));

const CARLA = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const DAVID = '1c7a3b63-2d5f-4a8b-8b62-3e4f8d2f9ba1';
const MERITXELL = '2d8b4c74-3e6a-4b9c-9c73-4f5a9e3a0cb2';
const ROGER = '3e9c5d85-4f7b-4cad-8d84-5a6b0f4b1dc3';
const POL = '4fad6e96-5a8c-4dbe-9e95-6b7c1a5c2ed4';

const person = (id: string, fullName: string, postKey: string): PersonRecord => ({
  id,
  fullName,
  house: 'paulo-freire',
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active: true,
});
let n = 0;
const ap = (personId: string, kind: ApKind, minutes: number): ApRecord => ({
  id: `ap-${(n += 1)}`,
  personId,
  house: 'paulo-freire',
  kind,
  year: 2026,
  date: '2026-02-02',
  minutes,
});

const { rows } = buildSaldosView({
  house: 'paulo-freire',
  year: 2026,
  people: [
    person(CARLA, 'Carla Ribas Solé', 'er'),
    person(DAVID, 'David Valls Medina', 'en'),
    person(MERITXELL, 'Meritxell Torres Vila', 'tfm'),
    person(ROGER, 'Roger Beltrán Camps', 'et'),
    person(POL, 'Pol Jiménez Alcover', 'ct'),
  ],
  openings: new Map([[ROGER, { vacationDays: 31, carriedDays: 0, surplusMinutes: 120 }]]),
  aps: [
    ...Array.from({ length: 5 }, () => ap(CARLA, 'non_recoverable', 240)),
    ...Array.from({ length: 4 }, () => ap(DAVID, 'non_recoverable', 270)),
    ...Array.from({ length: 3 }, () => ap(MERITXELL, 'non_recoverable', 240)),
    ap(POL, 'recoverable', 480),
  ],
});

const onSaved = vi.fn();
function renderForm(initialPersonId: string | null = null) {
  return render(<ApForm houseSlug="paulo-freire" year={2026} rows={rows} initialPersonId={initialPersonId} onSaved={onSaved} onCancel={() => {}} />);
}
const submit = () => screen.getByRole('button', { name: 'Apunta-ho' });

beforeEach(() => vi.clearAllMocks());

describe('ApForm', () => {
  it('records an AP after a person is chosen, with a preview of the balance', async () => {
    renderForm();
    expect(submit()).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Persona'), MERITXELL);
    expect(screen.getByText('Saldo de Meritxell')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '600');
    expect(screen.getByText("Li quedaran 6 h d'AP no recuperables (dia 4 de 5).")).toBeInTheDocument();
    await userEvent.click(submit());
    // handleSubmit validates asynchronously before the Server Function runs.
    await waitFor(() =>
      expect(addApAction).toHaveBeenCalledWith('paulo-freire', {
        personId: MERITXELL,
        kind: 'non_recoverable',
        year: 2026,
        date: '10/03/2026',
        hours: '6:00',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'new-ap', text: 'Apuntat AP no recuperable de 6 h a Meritxell Torres Vila.' }));
  });

  it('starts the last allowed request at the time left', () => {
    renderForm(DAVID);
    expect(screen.getByLabelText('Hores')).toHaveValue('6:00');
    expect(screen.getByText("És l'últim dia: li queden 6 h")).toBeInTheDocument();
  });

  it('offers the rest of the time as a shortcut', async () => {
    renderForm(POL);
    await userEvent.click(screen.getByRole('radio', { name: /^AP recuperable/ }));
    await userEvent.click(screen.getByRole('button', { name: 'La resta (16 h)' }));
    expect(screen.getByLabelText('Hores')).toHaveValue('16:00');
  });

  it('blocks a sixth AP no recuperable', () => {
    renderForm(CARLA);
    expect(screen.getByRole('alert')).toHaveTextContent("Ja ha fet servir els 5 dies que permet aquest tipus d'AP.");
    expect(submit()).toBeDisabled();
  });

  it('warns about a public holiday but allows it', async () => {
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Dia'), '25122026');
    await userEvent.type(screen.getByLabelText('Hores'), '200');
    expect(screen.getByText('És festiu (Nadal): segons la instrucció no es poden demanar AP en festius.')).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('warns when an AP recuperable takes the surplus below zero, and allows it', async () => {
    renderForm(ROGER);
    await userEvent.click(screen.getByRole('radio', { name: /^AP recuperable/ }));
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '600');
    expect(screen.getByText("L'excedent passarà de +2 h a −4 h: haurà de retornar 4 h. Es pot apuntar igualment.")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('shows an hours error with an icon when the field is left', async () => {
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Hores'), '975');
    await userEvent.tab();
    const error = await screen.findByText(HOURS_MESSAGE);
    expect(error.closest('p')?.querySelector('svg')).not.toBeNull();
  });

  it('cannot save twice while the first save is running', async () => {
    let resolve!: (result: { ok: true; data: { id: string } }) => void;
    vi.mocked(addApAction).mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '100');
    await userEvent.click(submit());
    await waitFor(() => expect(submit()).toBeDisabled());
    await userEvent.click(submit());
    expect(addApAction).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: { id: 'new-ap' } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('shows the server message when the save is refused', async () => {
    vi.mocked(addApAction).mockResolvedValueOnce({ ok: false, message: "Aquesta persona no és d'aquesta casa." });
    renderForm(MERITXELL);
    await userEvent.type(screen.getByLabelText('Dia'), '10032026');
    await userEvent.type(screen.getByLabelText('Hores'), '100');
    await userEvent.click(submit());
    expect(await screen.findByText("Aquesta persona no és d'aquesta casa.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
