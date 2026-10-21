import { defineConfig, devices } from '@playwright/test'

// A port of its own: a dev server on 3000 must neither be reused nor collide.
const PORT = 3100

// Real-database scenarios are opt-in: E2E_WITH_DB=1 pnpm test:e2e
const withDb = process.env.E2E_WITH_DB === '1'

// Secrets of the test server only; real ones live in .env and Vercel.
export const E2E_ADMIN = { login: 'e2e-admin', password: 'e2e-admin-password' }

// WebKit on Windows applies the OS display scaling to the emulated viewport
// (e.g. 750px becomes 600px at 125%), which breaks layout assertions. CI runs
// WebKit on Linux; locally on Windows it is opt-in via PW_WEBKIT=1.
const runWebKit = process.platform !== 'win32' || process.env.PW_WEBKIT === '1'

const webkitProjects = [
  { name: 'iphone-landscape', use: { ...devices['iPhone 13 landscape'] } },
  { name: 'tablet-landscape', use: { ...devices['iPad (gen 7) landscape'] } },
]

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // Landscape phones are the primary target; tablet and desktop must work too.
  projects: [
    ...(runWebKit ? webkitProjects : []),
    { name: 'android-landscape', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // The default run never loads .env, so it cannot reach a real database; only E2E_WITH_DB=1 does.
    command: `pnpm build && node ${withDb ? '--env-file=.env ' : ''}.output/server/index.mjs`,
    url: `http://localhost:${PORT}`,
    // Always a fresh server: a leftover one would not have the test secrets below.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(PORT),
      ADMIN_LOGIN: E2E_ADMIN.login,
      ADMIN_PASSWORD: E2E_ADMIN.password,
      NUXT_SESSION_PASSWORD: 'e2e-session-password-at-least-32-characters-long',
    },
  },
})
