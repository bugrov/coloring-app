import { defineConfig, devices } from '@playwright/test'

const PORT = 3000

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
    command: 'pnpm build && pnpm preview',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
