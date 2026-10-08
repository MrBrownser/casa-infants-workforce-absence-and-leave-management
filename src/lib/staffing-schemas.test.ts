import { describe, expect, it } from 'vitest';
import {
  createPersonSchema,
  createPositionSchema,
  editNameSchema,
  handoverRequestSchema,
  transferRequestSchema,
} from './staffing-schemas';

const OP = '6f1c2e7a-0b3d-4c5e-8f90-1a2b3c4d5e6f';
const POS = '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b';

describe('createPersonSchema', () => {
  it('trims the name and turns empty optional fields into null', () => {
    expect(createPersonSchema.parse({ operationId: OP, fullName: '  Ana Puig ', startsOn: '2026-01-01', endsOn: '', positionId: '' })).toEqual({
      operationId: OP, fullName: 'Ana Puig', startsOn: '2026-01-01', endsOn: null, positionId: null,
    });
  });

  it('accepts its own output again (the client sends parsed values)', () => {
    const once = createPersonSchema.parse({ operationId: OP, fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: POS });
    expect(createPersonSchema.parse(once)).toEqual(once);
  });

  it('rejects a blank name, an invalid date and an end before the start', () => {
    const blank = createPersonSchema.safeParse({ operationId: OP, fullName: '   ', startsOn: '2026-01-01', endsOn: '', positionId: '' });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0].message).toBe('Escriu el nom complet.');
    expect(createPersonSchema.safeParse({ operationId: OP, fullName: 'Ana', startsOn: '2026-02-30', endsOn: '', positionId: '' }).success).toBe(false);
    const backwards = createPersonSchema.safeParse({ operationId: OP, fullName: 'Ana', startsOn: '2026-03-01', endsOn: '2026-02-01', positionId: '' });
    expect(backwards.error?.issues[0].path).toEqual(['endsOn']);
  });

  it('rejects non-UUID identifiers', () => {
    expect(createPersonSchema.safeParse({ operationId: 'x', fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: '' }).success).toBe(false);
    expect(createPersonSchema.safeParse({ operationId: OP, fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: 'abc' }).success).toBe(false);
  });

  it('drops permission fields smuggled into the payload (AC-020)', () => {
    const parsed = createPersonSchema.parse({
      operationId: OP, fullName: 'Ana', startsOn: '2026-01-01', endsOn: '', positionId: '',
      role: 'director', clerkUserId: 'user_x', houseId: 'evil',
    });
    expect(Object.keys(parsed).sort()).toEqual(['endsOn', 'fullName', 'operationId', 'positionId', 'startsOn']);
  });
});

describe('createPositionSchema', () => {
  it('accepts catalogue roles only', () => {
    expect(createPositionSchema.safeParse({ operationId: OP, roleCode: 'CT', label: 'CT nit' }).success).toBe(true);
    expect(createPositionSchema.safeParse({ operationId: OP, roleCode: 'director', label: 'X' }).success).toBe(false);
    expect(createPositionSchema.safeParse({ operationId: OP, roleCode: 'CT', label: '  ' }).success).toBe(false);
  });
});

describe('editNameSchema', () => {
  it('needs the loaded version', () => {
    expect(editNameSchema.safeParse({ operationId: OP, employeeId: POS, fullName: 'Anna', expectedUpdatedAt: '2026-10-01T10:00:00.000Z' }).success).toBe(true);
    expect(editNameSchema.safeParse({ operationId: OP, employeeId: POS, fullName: 'Anna', expectedUpdatedAt: 'yesterday' }).success).toBe(false);
  });
});

describe('two-step requests', () => {
  const handover = { operationId: OP, positionId: POS, employeeId: POS, startsOn: '2026-07-01', endsOn: '', from: 'position' };

  it('needs a plan token to confirm', () => {
    expect(handoverRequestSchema.safeParse({ ...handover, intent: 'preview' }).success).toBe(true);
    expect(handoverRequestSchema.safeParse({ ...handover, intent: 'confirm' }).success).toBe(false);
    expect(handoverRequestSchema.safeParse({ ...handover, intent: 'confirm', planToken: 'a'.repeat(64) }).success).toBe(true);
  });

  it('accepts only known Houses as transfer destination', () => {
    const transfer = { operationId: OP, employeeId: POS, toHouseSlug: 'carme-aymerich', startsOn: '2026-07-01', destinationPositionId: '', intent: 'preview' };
    expect(transferRequestSchema.safeParse(transfer).success).toBe(true);
    expect(transferRequestSchema.safeParse({ ...transfer, toHouseSlug: 'evil' }).success).toBe(false);
  });
});
