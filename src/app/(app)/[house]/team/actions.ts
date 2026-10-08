// src/app/(app)/[house]/team/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import type { z } from 'zod';
import { doneHref, type ActionState, type DoneKind } from '@/lib/action-state';
import { requireDirector } from '@/lib/auth';
import { findHouseBySlug } from '@/lib/houses';
import { prisma } from '@/lib/prisma';
import { StaffingError } from '@/lib/staffing-error';
import { INVALID_FORM, UNEXPECTED_ERROR, describePlan, errorMessage } from '@/lib/staffing-messages';
import {
  addMembershipSchema,
  createPersonSchema,
  createPositionSchema,
  editNameSchema,
  endAssignmentSchema,
  endMembershipRequestSchema,
  handoverRequestSchema,
  relabelPositionSchema,
  transferRequestSchema,
} from '@/lib/staffing-schemas';
import { getHouseBySlug } from '@/server/houses';
import * as store from '@/server/staffing-store';

// Every Server Function: requireDirector() first, then the House from the
// bound route slug (never a cookie or a form field), then zod (which drops
// unknown fields such as role or clerkUserId), then the store. Success
// redirects with ?done=...; failures return a Catalan message. Logs carry
// the operation kind and, for known rejections, the fixed reason only.

const INVALID: ActionState = { status: 'error', message: INVALID_FORM };
const NOT_FOUND: ActionState = { status: 'error', message: errorMessage('not-found') };

// Fields that carry a record ID. A bad value here is a tampered or stale link,
// answered as "not found" (never the generic form message, never a database error).
const RECORD_ID_FIELDS = new Set([
  'employeeId',
  'positionId',
  'membershipId',
  'assignmentId',
  'destinationPositionId',
]);

function invalidInput(error: z.ZodError): ActionState {
  const badRecordId = error.issues.some((issue) => RECORD_ID_FIELDS.has(String(issue.path[issue.path.length - 1])));
  return badRecordId ? NOT_FOUND : INVALID;
}

function parse<S extends z.ZodType>(schema: S, input: unknown): { ok: true; data: z.output<S> } | { ok: false; state: ActionState } {
  const parsed = schema.safeParse(input);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, state: invalidInput(parsed.error) };
}

async function houseFor(slug: string) {
  if (!findHouseBySlug(slug)) notFound();
  const house = await getHouseBySlug(slug);
  if (!house) notFound();
  return house;
}

function failure(kind: string, error: unknown): ActionState {
  if (error instanceof StaffingError) {
    // The reason is a fixed vocabulary; never log the error message, names or IDs.
    console.warn(`[staffing] ${kind} rejected: ${error.reason}`);
    return { status: 'error', message: errorMessage(error.reason) };
  }
  console.error(`[staffing] ${kind} failed: unexpected`);
  return { status: 'error', message: UNEXPECTED_ERROR };
}

async function attempt<T>(kind: string, run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; state: ActionState }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, state: failure(kind, error) };
  }
}

async function preview(kind: string, run: () => Promise<store.Preview>): Promise<ActionState> {
  const result = await attempt(kind, run);
  if (!result.ok) return result.state;
  return { status: 'preview', lines: describePlan(result.value.plan, result.value.names), planToken: result.value.planToken };
}

function finish(slug: string, path: string, done: DoneKind, status: 'applied' | 'already-applied'): never {
  revalidatePath(`/${slug}/team`, 'layout');
  redirect(doneHref(path, done, status));
}

export async function createPositionAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(createPositionSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('create-position', () => store.createPosition(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/positions`, 'position-created', result.value.status);
}

export async function relabelPositionAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(relabelPositionSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('relabel-position', () => store.relabelPosition(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/positions/${data.positionId}`, 'position-relabelled', result.value.status);
}

export async function createPersonAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(createPersonSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('create-employee', () => store.createEmployee(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${result.value.result.employeeId}`, 'person-created', result.value.status);
}

export async function addMembershipAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(addMembershipSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('add-membership', () => store.addMembership(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${data.employeeId}`, 'membership-added', result.value.status);
}

export async function editNameAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(editNameSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('edit-name', () => store.editEmployeeName(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${data.employeeId}`, 'renamed', result.value.status);
}

export async function handoverAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(handoverRequestSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, intent, planToken, from, ...request } = parsed.data;
  if (intent === 'preview') return preview('handover', () => store.previewHandover(prisma, house.id, request));
  const result = await attempt('handover', () =>
    store.handover(prisma, { operationId, actor: userId }, house.id, { ...request, planToken: planToken ?? '' }),
  );
  if (!result.ok) return result.state;
  const path = from === 'position' ? `/${slug}/team/positions/${request.positionId}` : `/${slug}/team/${request.employeeId}`;
  finish(slug, path, 'assigned', result.value.status);
}

export async function endAssignmentAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(endAssignmentSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, ...data } = parsed.data;
  const result = await attempt('end-assignment', () => store.endAssignment(prisma, { operationId, actor: userId }, house.id, data));
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${result.value.result.employeeId}`, 'assignment-ended', result.value.status);
}

export async function endMembershipAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(endMembershipRequestSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, intent, planToken, ...request } = parsed.data;
  if (intent === 'preview') return preview('end-membership', () => store.previewEndMembership(prisma, house.id, request));
  const result = await attempt('end-membership', () =>
    store.endMembership(prisma, { operationId, actor: userId }, house.id, { ...request, planToken: planToken ?? '' }),
  );
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${result.value.result.employeeId}`, 'membership-ended', result.value.status);
}

export async function transferAction(slug: string, _state: ActionState, input: unknown): Promise<ActionState> {
  const { userId } = await requireDirector();
  const house = await houseFor(slug);
  const parsed = parse(transferRequestSchema, input);
  if (!parsed.ok) return parsed.state;
  const { operationId, intent, planToken, toHouseSlug, ...rest } = parsed.data;
  const toHouse = await getHouseBySlug(toHouseSlug);
  if (!toHouse) return INVALID;
  const request = { ...rest, toHouseId: toHouse.id };
  if (intent === 'preview') return preview('transfer', () => store.previewTransfer(prisma, house.id, request));
  const result = await attempt('transfer', () =>
    store.transfer(prisma, { operationId, actor: userId }, house.id, { ...request, planToken: planToken ?? '' }),
  );
  if (!result.ok) return result.state;
  finish(slug, `/${slug}/team/${request.employeeId}`, 'transferred', result.value.status);
}
