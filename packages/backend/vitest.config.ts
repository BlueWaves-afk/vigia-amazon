import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'functions/**/*.test.ts'],
    // Allow top-level await in test files (used for dynamic import after env stubs)
    pool: 'forks',
  },
});
