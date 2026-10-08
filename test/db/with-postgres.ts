// Run a command against a throwaway Postgres.
// Runs one command against a throwaway local Postgres with the migrations
// applied, then deletes it. DATABASE_URL and DIRECT_URL point at it:
//   npx tsx test/db/with-postgres.ts -- <command> [args...]
import { spawnSync } from 'node:child_process';
import { startLocalPostgres } from './local-postgres';

async function main() {
  const separator = process.argv.indexOf('--');
  const [command, ...args] = separator >= 0 ? process.argv.slice(separator + 1) : process.argv.slice(2);
  if (!command) throw new Error('Usage: npx tsx test/db/with-postgres.ts -- <command> [args...]');
  const postgres = await startLocalPostgres('scratch');
  try {
    const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: postgres.url, DIRECT_URL: postgres.url } });
    process.exitCode = result.status ?? 1;
  } finally {
    postgres.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
