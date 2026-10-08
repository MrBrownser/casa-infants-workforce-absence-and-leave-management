// src/lib/action-state.ts
// Shared between Server Functions (which may export only async functions) and
// client forms: the useActionState shape and the ?done=... success notes.

export type ActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; lines: string[]; planToken: string };

export const IDLE: ActionState = { status: 'idle' };

/** A staffing Server Function after the page has bound its House slug. */
export type StaffingAction = (state: ActionState, input: unknown) => Promise<ActionState>;

export const DONE_MESSAGES = {
  'person-created': 'Persona afegida.',
  'membership-added': 'Període afegit.',
  renamed: 'Nom actualitzat.',
  assigned: 'Lloc assignat.',
  'assignment-ended': 'Lloc finalitzat.',
  'membership-ended': 'Pertinença finalitzada.',
  transferred: 'Trasllat registrat.',
  'position-created': 'Lloc de treball creat.',
  'position-relabelled': 'Nom del lloc actualitzat.',
} as const;

export type DoneKind = keyof typeof DONE_MESSAGES;

export const ALREADY_APPLIED = "Aquesta acció ja s'havia desat. No s'ha duplicat res.";

export function doneHref(path: string, done: DoneKind, status: 'applied' | 'already-applied'): string {
  return `${path}?done=${done}${status === 'already-applied' ? '&repeat=1' : ''}`;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseDone(params: SearchParams): { done: DoneKind | null; repeat: boolean } {
  const done = firstParam(params, 'done');
  if (!done || !(done in DONE_MESSAGES)) return { done: null, repeat: false };
  return { done: done as DoneKind, repeat: firstParam(params, 'repeat') === '1' };
}
