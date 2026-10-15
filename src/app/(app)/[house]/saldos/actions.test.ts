import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { requireDirector } from '@/lib/auth';
import * as aps from '@/server/aps-store';
import * as people from '@/server/people-store';
import { addApAction, deleteApAction, restoreApAction } from './actions';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/people-store', () => ({ findPerson: vi.fn(async () => null) }));
vi.mock('@/server/aps-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/aps-store')>()),
  createAp: vi.fn(async () => 'new-ap'),
  deleteAp: vi.fn(),
  findAp: vi.fn(async () => null),
}));

const ID = '0b6f2a52-1c4e-4f7a-9a51-2f3d7c1e8a90';
const AP_ID = '5d1f7c2e-8a3b-4c9d-9e0f-1a2b3c4d5e6f';
const roger = { id: ID, fullName: 'Roger Beltrán Camps', house: 'paulo-freire' as const, postKey: 'et', seat: 1, startedOn: null, active: true };
const form = { personId: ID, kind: 'non_recoverable', year: 2026, date: '20/02/2026', hours: '4:00' };
const stored = { id: AP_ID, personId: ID, house: 'paulo-freire' as const, kind: 'non_recoverable' as const, year: 2026, date: '2026-02-20', minutes: 240 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1', name: 'Marta' });
});

describe('a non-director', () => {
  it('is redirected before anything is read or written', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(addApAction('paulo-freire', form)).rejects.toThrow('NEXT_REDIRECT');
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).rejects.toThrow('NEXT_REDIRECT');
    await expect(restoreApAction('paulo-freire', { ...stored, house: 'paulo-freire' })).rejects.toThrow('NEXT_REDIRECT');
    expect(people.findPerson).not.toHaveBeenCalled();
    expect(aps.createAp).not.toHaveBeenCalled();
    expect(aps.deleteAp).not.toHaveBeenCalled();
  });
});

describe('addApAction', () => {
  it('records an AP in the route House and returns its id', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(addApAction('paulo-freire', form)).resolves.toEqual({ ok: true, data: { id: 'new-ap' } });
    expect(aps.createAp).toHaveBeenCalledWith({}, { personId: ID, house: 'paulo-freire', kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240 });
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/saldos', 'page');
  });

  it('records a shared person from the House the director is in', async () => {
    vi.mocked(people.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    await addApAction('carme-aymerich', form);
    expect(aps.createAp).toHaveBeenCalledWith({}, expect.objectContaining({ house: 'carme-aymerich' }));
  });

  it('rejects a person of the other House', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(addApAction('carme-aymerich', form)).resolves.toEqual({ ok: false, message: "Aquesta persona no és d'aquesta casa." });
    expect(aps.createAp).not.toHaveBeenCalled();
  });

  it('rejects an unknown House and a bad input without reading', async () => {
    expect((await addApAction('nowhere', form)).ok).toBe(false);
    await expect(addApAction('paulo-freire', { ...form, hours: '9:75' })).resolves.toEqual({
      ok: false,
      message: 'Escriu les hores com H:MM, entre 0:01 i 24:00.',
    });
    expect(people.findPerson).not.toHaveBeenCalled();
  });

  it('returns the rule that stopped the write', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    vi.mocked(aps.createAp).mockRejectedValueOnce(new aps.ApRuleError("Ja ha fet servir els 5 dies que permet aquest tipus d'AP."));
    await expect(addApAction('paulo-freire', form)).resolves.toEqual({
      ok: false,
      message: "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteApAction', () => {
  it('deletes and returns what is needed to undo it', async () => {
    vi.mocked(aps.findAp).mockResolvedValue(stored);
    vi.mocked(aps.deleteAp).mockResolvedValue(true);
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).resolves.toEqual({
      ok: true,
      data: { removed: { personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240, house: 'paulo-freire' } },
    });
    expect(aps.deleteAp).toHaveBeenCalledWith({}, AP_ID);
    expect(revalidatePath).toHaveBeenCalledWith('/[house]/saldos', 'page');
  });

  it('lets this House delete an AP recorded in the other House when the person belongs here', async () => {
    vi.mocked(aps.findAp).mockResolvedValue({ ...stored, house: 'carme-aymerich' });
    vi.mocked(aps.deleteAp).mockResolvedValue(true);
    vi.mocked(people.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    const result = await deleteApAction('paulo-freire', { apId: AP_ID });
    expect(result).toMatchObject({ ok: true, data: { removed: { house: 'carme-aymerich' } } });
  });

  it('rejects an AP of a person of the other House', async () => {
    vi.mocked(aps.findAp).mockResolvedValue(stored);
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    expect((await deleteApAction('carme-aymerich', { apId: AP_ID })).ok).toBe(false);
    expect(aps.deleteAp).not.toHaveBeenCalled();
  });

  it('says so when the AP is already gone', async () => {
    vi.mocked(aps.findAp).mockResolvedValue(null);
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).resolves.toEqual({ ok: false, message: 'Aquest AP ja no existeix.' });
    expect(aps.deleteAp).not.toHaveBeenCalled();
  });

  it('says so, with no undo snapshot, when a concurrent delete removed the AP first', async () => {
    vi.mocked(aps.findAp).mockResolvedValue(stored);
    vi.mocked(aps.deleteAp).mockResolvedValue(false);
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    await expect(deleteApAction('paulo-freire', { apId: AP_ID })).resolves.toEqual({ ok: false, message: 'Aquest AP ja no existeix.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('restoreApAction', () => {
  const snapshot = { personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240, house: 'carme-aymerich' };

  it('records the same AP again with its original House', async () => {
    vi.mocked(people.findPerson).mockResolvedValue({ ...roger, house: null, postKey: 'pdg' });
    await expect(restoreApAction('paulo-freire', snapshot)).resolves.toEqual({ ok: true, data: { id: 'new-ap' } });
    expect(aps.createAp).toHaveBeenCalledWith({}, { personId: ID, kind: 'non_recoverable', year: 2026, date: '2026-02-20', minutes: 240, house: 'carme-aymerich' });
  });

  it('fails with the rule when the allowance filled up meanwhile', async () => {
    vi.mocked(people.findPerson).mockResolvedValue(roger);
    vi.mocked(aps.createAp).mockRejectedValueOnce(new aps.ApRuleError("Ja ha fet servir els 5 dies que permet aquest tipus d'AP."));
    await expect(restoreApAction('paulo-freire', { ...snapshot, house: 'paulo-freire' })).resolves.toEqual({
      ok: false,
      message: "Ja ha fet servir els 5 dies que permet aquest tipus d'AP.",
    });
  });

  it('rejects a tampered snapshot', async () => {
    expect((await restoreApAction('paulo-freire', { ...snapshot, minutes: 5000 })).ok).toBe(false);
    expect(aps.createAp).not.toHaveBeenCalled();
  });
});
