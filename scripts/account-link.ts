// scripts/account-link.ts
//
// Trusted operator procedure for employee account links (SPEC-002 FR-010).
//   npm run account-link -- link <employeeId> <clerkUserId> [--yes]
//   npm run account-link -- unlink <employeeId> [--yes]
// A link never grants or revokes access and never changes staffing history.
// No matching by name or email: both IDs are given explicitly.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { AccountLinkError, linkAccount, unlinkAccount } from '../src/server/access-store';
import { UsageError, confirmOrAbort, parseLinkArgs, targetBanner, verifyClerkUser } from './operator';

config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  const command = parseLinkArgs(process.argv.slice(2));
  console.log(targetBanner(process.env));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
  try {
    if (command.command === 'link' && !(await verifyClerkUser(command.clerkUserId, process.env.CLERK_SECRET_KEY))) {
      console.error('No such user in this Clerk instance. Nothing was written.');
      process.exitCode = 1;
      return;
    }
    const question =
      command.command === 'link'
        ? `Link employee ${command.employeeId} to ${command.clerkUserId}?`
        : `Unlink employee ${command.employeeId}?`;
    if (!(await confirmOrAbort(question, command.yes))) {
      console.log('Cancelled. Nothing was written.');
      return;
    }
    if (command.command === 'link') {
      await linkAccount(db, command.employeeId, command.clerkUserId);
      console.log('Linked. This grants no access.');
    } else {
      console.log((await unlinkAccount(db, command.employeeId)) ? 'Unlinked.' : 'That employee had no link.');
    }
  } catch (error) {
    if (!(error instanceof AccountLinkError)) throw error;
    console.error(
      error.reason === 'already-linked'
        ? 'Rejected: that employee or that account is already linked. Nothing was written.'
        : 'Rejected: no employee with that ID. Nothing was written.',
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = 1;
});
