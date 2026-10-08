import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Real-database tests run with `npm run test:db` (vitest.db.config.ts).
    exclude: [...configDefaults.exclude, '**/*.db.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws unconditionally outside Next's server build
      // (its `react-server` export condition isn't set under Vitest).
      // No-op it here so server-only modules stay unit-testable.
      'server-only': fileURLToPath(new URL('./vitest.server-only-stub.ts', import.meta.url)),
    },
  },
});
