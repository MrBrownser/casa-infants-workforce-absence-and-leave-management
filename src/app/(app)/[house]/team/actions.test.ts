import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { requireDirector } from '@/lib/auth';
import * as store from '@/server/people-store';
import {
  addPersonAction,
  deactivatePersonAction,
  movePersonAction,
  reactivatePersonAction,
  renamePersonAction,
  saveBalancesAction,
} from './actions';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/people-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/people-store')>()),
  addPerson: vi.fn(async () => 'new-id'),
  findPerson: vi.fn(async () => null),
  renamePerson: vi.fn(),
  placePerson: vi.fn(),
  deactivatePerson: vi.fn(),
  saveOpeningBalances: vi.fn(),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const roger = { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire' as const, postKey: 'et', seat: 1, startedOn: null, active: true };
const balances = { personId: ID, year: 2026, vacationDays: '31', carriedDays: '3', surplusSign: '+', surplus: '12:00' };
const writes = () => [store.addPerson, store.renamePerson, store.placePerson, store.deactivatePerson, store.saveOpeningBalances];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
});

describe('a non-director', () => {
  it('is redirected before anything is read or written', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat: 'paulo-freire:ct:1' })).rejects.toThrow('NEXT_REDIRECT');
    await expect(renamePersonAction('paulo-freire', { personId: ID, fullName: 'X' })).rejects.toThrow('NEXT_REDIRECT');
    await expect(saveBalancesAction('paulo-freire', balances)).rejects.toThrow('NEXT_REDIRECT');
    expect(store.findPerson).not.toHaveBeenCalled();
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });
});

describe('addPersonAction', () => {
  it('adds a person to a vacant seat of the active House', async () => {
    await expect(addPersonAction('paulo-freire', { fullName: 'Carla Ribas Solé', startedOn: '', seat: 'paulo-freire:er:1' })).resolves.toEqual({ ok: true });
    expect(store.addPerson).toHaveBeenCalledWith({}, { fullName: 'Carla Ribas Solé', startedOn: null, seat: { house: 'paulo-freire', postKey: 'er', seat: 1 } });
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/team', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/saldos', 'page');
  });

  it('adds to a shared seat from either House', async () => {
    await expect(addPersonAction('carme-aymerich', { fullName: 'Meritxell Torres Vila', startedOn: '', seat: 'shared:pdg:1' })).resolves.toEqual({ ok: true });
  });

  it('rejects a seat of the other House', async () => {
    const result = await addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat: 'carme-aymerich:ct:1' });
    expect(result.ok).toBe(false);
    expect(store.addPerson).not.toHaveBeenCalled();
  });

  it.each(['paulo-freire:xx:1', 'paulo-freire:er:2'])('rejects the unknown seat %s', async (seat) => {
    await expect(addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat })).resolves.toEqual({ ok: false, message: 'Tria un lloc vacant.' });
    expect(store.addPerson).not.toHaveBeenCalled();
  });

  it('rejects an unknown House', async () => {
    expect((await addPersonAction('nowhere', { fullName: 'X', startedOn: '', seat: 'shared:pdg:1' })).ok).toBe(false);
    expect(store.addPerson).not.toHaveBeenCalled();
  });

  it('names who covers an occupied seat', async () => {
    vi.mocked(store.addPerson).mockRejectedValueOnce(new store.SeatTakenError('Carla Ribas Solé'));
    await expect(addPersonAction('paulo-freire', { fullName: 'X', startedOn: '', seat: 'paulo-freire:er:1' })).resolves.toEqual({
      ok: false,
      message: "Aquest lloc ja l'ocupa Carla Ribas Solé.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('renamePersonAction', () => {
  it('renames a person of the House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(renamePersonAction('paulo-freire', { personId: ID, fullName: 'Roger Beltrán Camps' })).resolves.toEqual({ ok: true });
    expect(store.renamePerson).toHaveBeenCalledWith({}, ID, 'Roger Beltrán Camps');
  });

  it('rejects a person of the other House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    expect((await renamePersonAction('carme-aymerich', { personId: ID, fullName: 'X' })).ok).toBe(false);
    expect(store.renamePerson).not.toHaveBeenCalled();
  });

  it('accepts a shared person from either House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    await expect(renamePersonAction('carme-aymerich', { personId: ID, fullName: 'X' })).resolves.toEqual({ ok: true });
  });

  it('rejects a tampered id', async () => {
    expect((await renamePersonAction('paulo-freire', { personId: 'x', fullName: 'X' })).ok).toBe(false);
    expect(store.findPerson).not.toHaveBeenCalled();
  });
});

describe('movePersonAction', () => {
  it('moves an active person to the other House', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(movePersonAction('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' })).resolves.toEqual({ ok: true });
    expect(store.placePerson).toHaveBeenCalledWith({}, ID, { house: 'carme-aymerich', postKey: 'et', seat: 1 });
  });

  it('refuses to move an inactive person', async () => {
    vi.mocked(store.findPerson).mockResolvedValue({ ...roger, active: false });
    expect((await movePersonAction('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' })).ok).toBe(false);
    expect(store.placePerson).not.toHaveBeenCalled();
  });

  it('names who covers the target seat', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    vi.mocked(store.placePerson).mockRejectedValueOnce(new store.SeatTakenError('Júlia Romero Bosch'));
    await expect(movePersonAction('paulo-freire', { personId: ID, seat: 'carme-aymerich:et:1' })).resolves.toEqual({
      ok: false,
      message: "Aquest lloc ja l'ocupa Júlia Romero Bosch.",
    });
  });
});

describe('deactivate and reactivate', () => {
  it('marks an active person inactive', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(deactivatePersonAction('paulo-freire', { personId: ID })).resolves.toEqual({ ok: true });
    expect(store.deactivatePerson).toHaveBeenCalledWith({}, ID);
  });

  it('reactivates an inactive person into a vacant seat', async () => {
    vi.mocked(store.findPerson).mockResolvedValue({ ...roger, active: false, postKey: 'ct' });
    await expect(reactivatePersonAction('paulo-freire', { personId: ID, seat: 'paulo-freire:ct:1' })).resolves.toEqual({ ok: true });
    expect(store.placePerson).toHaveBeenCalledWith({}, ID, { house: 'paulo-freire', postKey: 'ct', seat: 1 });
  });

  it('does not reactivate someone already active', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    expect((await reactivatePersonAction('paulo-freire', { personId: ID, seat: 'paulo-freire:ct:1' })).ok).toBe(false);
    expect(store.placePerson).not.toHaveBeenCalled();
  });
});

describe('saveBalancesAction', () => {
  it('stores the balances in days and minutes', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    await expect(saveBalancesAction('paulo-freire', { ...balances, surplusSign: '-', surplus: '9:15' })).resolves.toEqual({ ok: true });
    expect(store.saveOpeningBalances).toHaveBeenCalledWith({}, ID, 2026, { vacationDays: 31, carriedDays: 3, surplusMinutes: -555 });
  });

  it('rejects 9:75 without saving', async () => {
    vi.mocked(store.findPerson).mockResolvedValue(roger);
    expect((await saveBalancesAction('paulo-freire', { ...balances, surplus: '9:75' })).ok).toBe(false);
    expect(store.saveOpeningBalances).not.toHaveBeenCalled();
  });
});
