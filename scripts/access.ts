// scripts/access.ts
//
// Trusted operator procedure for director grants (SPEC-002 §8, design D10).
//   npm run access -- grant <clerkUserId> [--yes]
//   npm run access -- revoke <clerkUserId> [--yes]
//   npm run access -- list
// Restoring a lost director access = run `grant` again for their Clerk user ID.
// Changes apply on the user's next request.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { grantDirector, listGrants, revokeDirector } from '../src/server/access-store';
import { UsageError, confirmOrAbort, parseAccessArgs, targetBanner, verifyClerkUser } from './operator';

config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  const command = parseAccessArgs(process.argv.slice(2));
  console.log(targetBanner(process.env));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
  try {
    if (command.command === 'list') {
      for (const grant of await listGrants(db)) {
        console.log(`${grant.clerkUserId}  ${grant.role}  ${grant.revokedAt ? `revoked ${grant.revokedAt.toISOString()}` : 'enabled'}`);
      }
      return;
    }
    if (command.command === 'grant' && !(await verifyClerkUser(command.clerkUserId, process.env.CLERK_SECRET_KEY))) {
      console.error('No such user in this Clerk instance. Nothing was written.');
      process.exitCode = 1;
      return;
    }
    if (!(await confirmOrAbort(`${command.command} director access for ${command.clerkUserId}?`, command.yes))) {
      console.log('Cancelled. Nothing was written.');
      return;
    }
    if (command.command === 'grant') {
      await grantDirector(db, command.clerkUserId);
      console.log('Director access granted.');
    } else {
      console.log((await revokeDirector(db, command.clerkUserId)) ? 'Director access revoked.' : 'No enabled grant for that user.');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = 1;
});
