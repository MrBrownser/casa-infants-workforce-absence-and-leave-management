// Local Postgres harness.
// A throwaway local Postgres for tests and one-off checks (never Supabase):
// initdb into a temp directory, TCP only on a free localhost port (temp paths
// can be too long for a Unix socket on macOS), then `prisma migrate deploy`.
// Server binaries come from PG_BIN, the directory of the `postgres` binary
// (macOS Homebrew; the first `initdb` on PATH can be libpq's client-only copy),
// or Debian's /usr/lib/postgresql/<version>/bin. Postgres refuses to run as
// root, so in root containers the server tools run as the `postgres` OS user.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type LocalPostgres = { url: string; bin: string; stop: () => void };

const asRoot = process.getuid?.() === 0;

function pgBinDir(): string {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const which = spawnSync('which', ['postgres'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return dirname(realpathSync(which.stdout.trim()));
  const debian = '/usr/lib/postgresql';
  if (existsSync(debian)) {
    const versions = readdirSync(debian)
      .filter((version) => existsSync(join(debian, version, 'bin', 'initdb')))
      .sort((a, b) => Number(b) - Number(a));
    if (versions[0]) return join(debian, versions[0], 'bin');
  }
  throw new Error('Postgres server binaries not found: install PostgreSQL 14 or newer, or set PG_BIN.');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** Runs a server tool (initdb, pg_ctl); as root, as the `postgres` OS user. */
function serverTool(bin: string, tool: string, args: string[]): void {
  const file = join(bin, tool);
  if (asRoot) execFileSync('runuser', ['-u', 'postgres', '--', file, ...args], { stdio: 'pipe' });
  else execFileSync(file, args, { stdio: 'pipe' });
}

export async function startLocalPostgres(database = 'casa_test'): Promise<LocalPostgres> {
  const bin = pgBinDir();
  const dir = mkdtempSync(join(tmpdir(), 'casa-pg-'));
  if (asRoot) execFileSync('chown', ['-R', 'postgres', dir]);
  const data = join(dir, 'data');
  const port = await freePort();

  // en_US.UTF-8 matches Supabase for lower(); minimal containers may only have C.UTF-8.
  const initdb = (locale: string) =>
    serverTool(bin, 'initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', `--locale=${locale}`]);
  try {
    initdb('en_US.UTF-8');
  } catch {
    rmSync(data, { recursive: true, force: true });
    initdb('C.UTF-8');
  }
  serverTool(bin, 'pg_ctl', [
    '-D', data,
    '-o', `-p ${port} -c listen_addresses=localhost -c unix_socket_directories=''`,
    '-l', join(dir, 'postgres.log'),
    '-w', 'start',
  ]);

  const stop = () => {
    try {
      serverTool(bin, 'pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    } catch {
      // Already stopped.
    }
    rmSync(dir, { recursive: true, force: true });
  };

  try {
    execFileSync(join(bin, 'createdb'), ['-h', 'localhost', '-p', String(port), '-U', 'postgres', database], { stdio: 'pipe' });
    const url = `postgresql://postgres@localhost:${port}/${database}`;
    // dotenv in prisma.config.ts does not override variables that are already set.
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
    return { url, bin, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
