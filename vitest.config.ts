import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Catalog suites load and validate large independent source snapshots.
    // Bound parallelism so CPU contention does not turn validation into timeouts.
    maxWorkers: 2,
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'scripts/**/*.test.mjs',
    ],
  },
});
