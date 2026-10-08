import type { TestProject } from 'vitest/node';
import { startLocalPostgres } from './local-postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    pgBin: string;
  }
}

/** One throwaway database per `npm run test:db` run, removed afterwards. */
export default async function setup(project: TestProject) {
  const postgres = await startLocalPostgres();
  project.provide('databaseUrl', postgres.url);
  project.provide('pgBin', postgres.bin);
  return postgres.stop;
}
