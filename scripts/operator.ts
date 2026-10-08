// scripts/operator.ts
//
// Shared pieces of the trusted operator procedures (SPEC-002 §8, design D10):
// strict argument parsing (Clerk user IDs and employee UUIDs only, never names
// or emails), a banner naming the target Clerk instance and database host, an
// explicit confirmation, and verification that the Clerk user exists.
import { createInterface } from 'node:readline/promises';
import { createClerkClient } from '@clerk/backend';
import { isClerkAPIResponseError } from '@clerk/backend/errors';
import { isUuid } from '../src/lib/ids';

export class UsageError extends Error {}

const CLERK_USER_ID = /^user_[A-Za-z0-9]+$/;

function splitYes(argv: readonly string[]) {
  return { yes: argv.includes('--yes'), args: argv.filter((arg) => arg !== '--yes') };
}

export type AccessCommand =
  | { command: 'grant' | 'revoke'; clerkUserId: string; yes: boolean }
  | { command: 'list'; yes: boolean };

export function parseAccessArgs(argv: readonly string[]): AccessCommand {
  const { yes, args } = splitYes(argv);
  const [command, clerkUserId, ...rest] = args;
  if (command === 'list' && clerkUserId === undefined) return { command, yes };
  if ((command === 'grant' || command === 'revoke') && clerkUserId !== undefined && CLERK_USER_ID.test(clerkUserId) && rest.length === 0) {
    return { command, clerkUserId, yes };
  }
  throw new UsageError('Usage: npm run access -- grant|revoke <clerkUserId> [--yes] | list');
}

export type LinkCommand =
  | { command: 'link'; employeeId: string; clerkUserId: string; yes: boolean }
  | { command: 'unlink'; employeeId: string; yes: boolean };

export function parseLinkArgs(argv: readonly string[]): LinkCommand {
  const { yes, args } = splitYes(argv);
  const [command, employeeId = '', clerkUserId, ...rest] = args;
  if (command === 'link' && isUuid(employeeId) && clerkUserId !== undefined && CLERK_USER_ID.test(clerkUserId) && rest.length === 0) {
    return { command, employeeId, clerkUserId, yes };
  }
  if (command === 'unlink' && isUuid(employeeId) && clerkUserId === undefined) return { command, employeeId, yes };
  throw new UsageError('Usage: npm run account-link -- link <employeeId> <clerkUserId> [--yes] | unlink <employeeId> [--yes]');
}

export function clerkInstance(secretKey?: string): 'development' | 'production' | 'unknown' {
  if (secretKey?.startsWith('sk_test_')) return 'development';
  if (secretKey?.startsWith('sk_live_')) return 'production';
  return 'unknown';
}

export function databaseHost(url?: string): string {
  if (!url) return 'not configured';
  try {
    return new URL(url).host;
  } catch {
    return 'unparseable URL';
  }
}

export function targetBanner(env: Readonly<Record<string, string | undefined>>): string {
  return [
    `Clerk instance: ${clerkInstance(env.CLERK_SECRET_KEY)}`,
    `Database host:  ${databaseHost(env.DIRECT_URL ?? env.DATABASE_URL)}`,
  ].join('\n');
}

async function askYes(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${question} Type "yes" to continue: `)).trim() === 'yes';
  } finally {
    rl.close();
  }
}

export async function confirmOrAbort(question: string, yes: boolean, ask: (question: string) => Promise<boolean> = askYes): Promise<boolean> {
  return yes ? true : ask(question);
}

/** True if the user exists in the Clerk instance of `secretKey`; false on 404. */
export async function verifyClerkUser(clerkUserId: string, secretKey?: string): Promise<boolean> {
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set.');
  try {
    await createClerkClient({ secretKey }).users.getUser(clerkUserId);
    return true;
  } catch (error) {
    if (isClerkAPIResponseError(error) && error.status === 404) return false;
    throw error;
  }
}
