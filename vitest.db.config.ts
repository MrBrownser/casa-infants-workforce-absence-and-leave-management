import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Real-database tests (`npm run test:db`): test/db/global-setup.ts starts a
// throwaway local Postgres, applies the Prisma migrations and tears it down.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.db.test.ts'],
    globalSetup: ['./test/db/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./vitest.server-only-stub.ts', import.meta.url)),
    },
  },
});
