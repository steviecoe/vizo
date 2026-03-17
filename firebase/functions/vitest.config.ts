import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/api/**'],
      exclude: [
        'src/**/*.test.*',
        'src/index.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});
