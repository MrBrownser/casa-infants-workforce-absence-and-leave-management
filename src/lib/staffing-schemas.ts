// One schema per staffing form, shared by react-hook-form in the browser and
// by the Server Functions. z.object strips unknown keys, so smuggled fields
// (role, clerkUserId, houseId) never reach the store (FR-008, AC-020). Optional
// fields accept '' from inputs and null from already-parsed values, so the
// client can send its parsed output and the server parses it again.
import { z } from 'zod';
import { isIsoDate } from './dates';
import { HOUSES, type HouseSlug } from './houses';
import { ROLE_CODES } from './roles';

const isoDate = z.string().refine(isIsoDate, { message: 'Introdueix una data vàlida.' });
const optionalIsoDate = z.union([isoDate, z.literal(''), z.null()]).transform((value) => value || null);
const id = z.uuid({ message: 'La selecció no és vàlida.' });
const optionalId = z.union([id, z.literal(''), z.null()]).transform((value) => value || null);
const fullName = z.string().trim().min(1, 'Escriu el nom complet.').max(120, 'El nom és massa llarg.');
const label = z.string().trim().min(1, 'Escriu un nom per al lloc.').max(60, 'El nom és massa llarg.');
const planToken = z.string().regex(/^[0-9a-f]{64}$/);
const HOUSE_SLUGS = HOUSES.map((house) => house.slug) as [HouseSlug, ...HouseSlug[]];

const END_BEFORE_START = { message: "La data de final no pot ser anterior a la d'inici.", path: ['endsOn'] };
const endNotBeforeStart = (value: { startsOn: string; endsOn: string | null }) =>
  value.endsOn === null || value.endsOn >= value.startsOn;

export const createPositionSchema = z.object({
  operationId: id,
  roleCode: z.enum(ROLE_CODES, { message: 'Tria un rol.' }),
  label,
});

export const relabelPositionSchema = z.object({ operationId: id, positionId: id, label });

export const createPersonSchema = z
  .object({ operationId: id, fullName, startsOn: isoDate, endsOn: optionalIsoDate, positionId: optionalId })
  .refine(endNotBeforeStart, END_BEFORE_START);

export const addMembershipSchema = z
  .object({ operationId: id, employeeId: id, startsOn: isoDate, endsOn: optionalIsoDate, positionId: optionalId })
  .refine(endNotBeforeStart, END_BEFORE_START);

export const editNameSchema = z.object({
  operationId: id,
  employeeId: id,
  fullName,
  expectedUpdatedAt: z.iso.datetime(),
});

export const handoverSchema = z
  .object({
    operationId: id,
    positionId: id,
    employeeId: id,
    startsOn: isoDate,
    endsOn: optionalIsoDate,
    from: z.enum(['employee', 'position']),
  })
  .refine(endNotBeforeStart, END_BEFORE_START);

export const endAssignmentSchema = z.object({ operationId: id, assignmentId: id, endsOn: isoDate });

export const endMembershipSchema = z.object({ operationId: id, membershipId: id, endsOn: isoDate });

export const transferSchema = z.object({
  operationId: id,
  employeeId: id,
  toHouseSlug: z.enum(HOUSE_SLUGS),
  startsOn: isoDate,
  destinationPositionId: optionalId,
});

// Two-step operations: a preview writes nothing; a confirm must carry the
// preview's plan token (stale check in the store).
const twoStep = { intent: z.enum(['preview', 'confirm']), planToken: planToken.optional() };
const confirmHasToken = (value: { intent: 'preview' | 'confirm'; planToken?: string }) =>
  value.intent === 'preview' || value.planToken !== undefined;
const MISSING_TOKEN = { message: 'Torna a revisar els canvis abans de confirmar.', path: ['planToken'] };

export const handoverRequestSchema = handoverSchema.and(z.object(twoStep)).refine(confirmHasToken, MISSING_TOKEN);
export const endMembershipRequestSchema = endMembershipSchema.extend(twoStep).refine(confirmHasToken, MISSING_TOKEN);
export const transferRequestSchema = transferSchema.extend(twoStep).refine(confirmHasToken, MISSING_TOKEN);

export type FormInput<S extends z.ZodType> = z.input<S>;
export type FormOutput<S extends z.ZodType> = z.output<S>;
