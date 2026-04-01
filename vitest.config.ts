import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@infra': './infra',
      '@tasks': './tasks',
      '@methods': './methods',
      '@results': './results',
      '@references': './references',
    },
  },
});
