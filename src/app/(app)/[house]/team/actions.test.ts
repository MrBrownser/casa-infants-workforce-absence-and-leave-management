// src/app/(app)/[house]/team/actions.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDirector } from '@/lib/auth';
import { IDLE } from '@/lib/action-state';
import { StaffingError } from '@/lib/staffing-error';
import { getHouseBySlug } from '@/server/houses';
import * as store from '@/server/staffing-store';
import {
  createPersonAction,
  createPositionAction,
  editNameAction,
  endAssignmentAction,
  handoverAction,
  transferAction,
} from './actions';

vi.mock('@/lib/auth', () => ({ requireDirector: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { tag: 'prisma' } }));
vi.mock('@/server/houses', () => ({ getHouseBySlug: vi.fn() }));
vi.mock('@/server/staffing-store', () => ({
  createPosition: vi.fn(),
  relabelPosition: vi.fn(),
  createEmployee: vi.fn(),
  addMembership: vi.fn(),
  editEmployeeName: vi.fn(),
  previewHandover: vi.fn(),
  handover: vi.fn(),
  endAssignment: vi.fn(),
  previewEndMembership: vi.fn(),
  endMembership: vi.fn(),
  previewTransfer: vi.fn(),
  transfer: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const OP = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';
const E1 = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';
const P1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PF = { id: 'pf-id', slug: 'paulo-freire', name: 'Paulo Freire' };
const CA = { id: 'ca-id', slug: 'carme-aymerich', name: 'Carme Aymerich' };
const person = { operationId: OP, fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: '', positionId: '' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDirector).mockResolvedValue({ userId: 'user_1' });
  vi.mocked(getHouseBySlug).mockImplementation(async (slug) => (slug === 'paulo-freire' ? PF : slug === 'carme-aymerich' ? CA : null) as never);
});

describe('access (AC-018)', () => {
  it('stops before reading the House or touching the store', async () => {
    vi.mocked(requireDirector).mockRejectedValue(new Error('NEXT_REDIRECT /no-access'));
    await expect(createPersonAction('paulo-freire', IDLE, person)).rejects.toThrow('NEXT_REDIRECT /no-access');
    expect(getHouseBySlug).not.toHaveBeenCalled();
    expect(store.createEmployee).not.toHaveBeenCalled();
  });

  it('404s an unknown House slug', async () => {
    await expect(createPersonAction('casa-inexistent', IDLE, person)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(store.createEmployee).not.toHaveBeenCalled();
  });
});

describe('createPersonAction', () => {
  it('scopes to the route House, drops smuggled fields and redirects (AC-020)', async () => {
    vi.mocked(store.createEmployee).mockResolvedValue({ status: 'applied', result: { employeeId: E1, membershipId: 'm', assignmentId: null } });
    await expect(
      createPersonAction('paulo-freire', IDLE, { ...person, houseId: 'ca-id', role: 'director', clerkUserId: 'user_evil' }),
    ).rejects.toThrow(`NEXT_REDIRECT /paulo-freire/team/${E1}?done=person-created`);
    expect(store.createEmployee).toHaveBeenCalledWith({ tag: 'prisma' }, { operationId: OP, actor: 'user_1' }, 'pf-id', {
      fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: null,
    });
  });

  it('says when a retry was already applied (AC-023)', async () => {
    vi.mocked(store.createEmployee).mockResolvedValue({ status: 'already-applied', result: { employeeId: E1, membershipId: 'm', assignmentId: null } });
    await expect(createPersonAction('paulo-freire', IDLE, person)).rejects.toThrow('&repeat=1');
  });

  it('returns Catalan messages for rule failures, invalid input and unexpected errors', async () => {
    vi.mocked(store.createEmployee).mockRejectedValueOnce(new StaffingError('position-occupied'));
    await expect(createPersonAction('paulo-freire', IDLE, person)).resolves.toEqual({
      status: 'error', message: 'Aquest lloc ja està ocupat en aquestes dates.',
    });
    await expect(createPersonAction('paulo-freire', IDLE, { ...person, fullName: '' })).resolves.toMatchObject({ status: 'error' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(store.createEmployee).mockRejectedValueOnce(new Error('duplicate key value ... Ana Puig'));
    await expect(createPersonAction('paulo-freire', IDLE, person)).resolves.toMatchObject({ status: 'error' });
    expect(log).toHaveBeenCalledWith('[staffing] create-employee failed: unexpected');
    log.mockRestore();
  });
});

describe('createPositionAction', () => {
  it('creates in the route House and returns to the positions page', async () => {
    vi.mocked(store.createPosition).mockResolvedValue({ status: 'applied', result: { positionId: P1 } });
    await expect(createPositionAction('carme-aymerich', IDLE, { operationId: OP, roleCode: 'CT', label: 'CT nit' })).rejects.toThrow(
      'NEXT_REDIRECT /carme-aymerich/team/positions?done=position-created',
    );
    expect(store.createPosition).toHaveBeenCalledWith({ tag: 'prisma' }, { operationId: OP, actor: 'user_1' }, 'ca-id', { roleCode: 'CT', label: 'CT nit' });
  });
});

describe('editNameAction', () => {
  it('passes the loaded version for the stale check', async () => {
    vi.mocked(store.editEmployeeName).mockResolvedValue({ status: 'applied', result: { employeeId: E1 } });
    const input = { operationId: OP, employeeId: E1, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' };
    await expect(editNameAction('paulo-freire', IDLE, input)).rejects.toThrow(`/paulo-freire/team/${E1}?done=renamed`);
    expect(store.editEmployeeName).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'pf-id', {
      employeeId: E1, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z',
    });
  });
});

describe('handoverAction', () => {
  const handover = { operationId: OP, positionId: P1, employeeId: E1, startsOn: '2026-07-01', endsOn: '', from: 'position' };

  it('previews without writing', async () => {
    vi.mocked(store.previewHandover).mockResolvedValue({
      plan: { closes: [], opens: [{ kind: 'assignment', employeeId: E1, positionId: P1, houseId: 'pf-id', startsOn: '2026-07-01', endsOn: null }] },
      planToken: 'a'.repeat(64),
      names: { employees: { [E1]: 'Ana Puig' }, positions: { [P1]: 'ER 1' }, houses: { 'pf-id': 'Paulo Freire' } },
    });
    await expect(handoverAction('paulo-freire', IDLE, { ...handover, intent: 'preview' })).resolves.toEqual({
      status: 'preview',
      lines: ['Ana Puig: lloc ER 1 a Paulo Freire comença el 1 de juliol del 2026.'],
      planToken: 'a'.repeat(64),
    });
    expect(store.handover).not.toHaveBeenCalled();
  });

  it('confirms with the token and returns to the position page', async () => {
    vi.mocked(store.handover).mockResolvedValue({ status: 'applied', result: { positionId: P1, employeeId: E1, assignmentId: 'a' } });
    await expect(handoverAction('paulo-freire', IDLE, { ...handover, intent: 'confirm', planToken: 'b'.repeat(64) })).rejects.toThrow(
      `/paulo-freire/team/positions/${P1}?done=assigned`,
    );
    expect(store.handover).toHaveBeenCalledWith(expect.anything(), { operationId: OP, actor: 'user_1' }, 'pf-id', {
      positionId: P1, employeeId: E1, startsOn: '2026-07-01', endsOn: null, planToken: 'b'.repeat(64),
    });
  });

  it('reports a stale confirm', async () => {
    vi.mocked(store.handover).mockRejectedValue(new StaffingError('stale'));
    await expect(handoverAction('paulo-freire', IDLE, { ...handover, intent: 'confirm', planToken: 'b'.repeat(64) })).resolves.toEqual({
      status: 'error', message: 'Les dades han canviat mentrestant. Torna a carregar la pàgina.',
    });
  });
});

describe('endAssignmentAction', () => {
  it('returns to the employee page', async () => {
    vi.mocked(store.endAssignment).mockResolvedValue({ status: 'applied', result: { assignmentId: P1, employeeId: E1 } });
    await expect(endAssignmentAction('paulo-freire', IDLE, { operationId: OP, assignmentId: P1, endsOn: '2026-08-31' })).rejects.toThrow(
      `/paulo-freire/team/${E1}?done=assignment-ended`,
    );
  });
});

describe('transferAction', () => {
  it('resolves the destination House by slug and keeps the route House as source', async () => {
    vi.mocked(store.previewTransfer).mockResolvedValue({ plan: { closes: [], opens: [] }, planToken: 'c'.repeat(64), names: { employees: {}, positions: {}, houses: {} } });
    const input = { operationId: OP, employeeId: E1, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: '', intent: 'preview' };
    await transferAction('paulo-freire', IDLE, input);
    expect(store.previewTransfer).toHaveBeenCalledWith(expect.anything(), 'pf-id', {
      employeeId: E1, toHouseId: 'ca-id', startsOn: '2026-07-01', destinationPositionId: null,
    });
  });
});

describe('tampered and malformed IDs (AC-020)', () => {
  const NOT_FOUND = { status: 'error', message: 'No hem trobat aquest registre en aquesta casa.' };
  const OTHER_HOUSE_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

  it('answers not-found for an ID of the other House or a nonexistent one, bound to the route House', async () => {
    vi.mocked(store.editEmployeeName).mockRejectedValue(new StaffingError('not-found'));
    const input = { operationId: OP, employeeId: OTHER_HOUSE_ID, fullName: 'Anna Puig', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' };
    await expect(editNameAction('paulo-freire', IDLE, input)).resolves.toEqual(NOT_FOUND);
    expect(store.editEmployeeName).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'pf-id', expect.objectContaining({ employeeId: OTHER_HOUSE_ID }));

    vi.mocked(store.previewHandover).mockRejectedValue(new StaffingError('not-found'));
    await expect(
      handoverAction('paulo-freire', IDLE, { operationId: OP, positionId: OTHER_HOUSE_ID, employeeId: E1, startsOn: '2026-07-01', endsOn: '', from: 'position', intent: 'preview' }),
    ).resolves.toEqual(NOT_FOUND);
    expect(store.handover).not.toHaveBeenCalled();
  });

  it.each([
    ['editNameAction', editNameAction, { operationId: OP, employeeId: 'abc', fullName: 'Anna', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' }],
    ['handoverAction', handoverAction, { operationId: OP, positionId: 'x', employeeId: E1, startsOn: '2026-07-01', endsOn: '', from: 'position', intent: 'preview' }],
    ['endAssignmentAction', endAssignmentAction, { operationId: OP, assignmentId: 'nope', endsOn: '2026-08-31' }],
    ['createPersonAction (optional positionId)', createPersonAction, { ...person, positionId: 'x' }],
    ['transferAction (destination)', transferAction, { operationId: OP, employeeId: E1, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: '12', intent: 'preview' }],
  ] as const)('answers not-found for a malformed ID in %s without touching the store', async (_name, action, input) => {
    await expect(action('paulo-freire', IDLE, input)).resolves.toEqual(NOT_FOUND);
    for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
  });

  it('keeps the invalid-form message for genuine input errors even with a valid ID', async () => {
    await expect(
      endAssignmentAction('paulo-freire', IDLE, { operationId: OP, assignmentId: P1, endsOn: '2026-02-30' }),
    ).resolves.toEqual({ status: 'error', message: 'Revisa les dades del formulari.' });
  });
});
