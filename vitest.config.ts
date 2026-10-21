import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        // Pure TypeScript (shared utils, engine): fast, no Nuxt runtime.
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          // Server tests start PGlite and run every migration; with all test files in parallel that outlasts the default 5 s.
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      await defineVitestProject({
        // Code that needs the Nuxt runtime (composables, components).
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
