import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { config as dotenvConfig } from 'dotenv'

// Load local secrets for E2E (never commit .env.e2e.local)
dotenvConfig({ path: path.resolve(__dirname, '.env.e2e.local') })
dotenvConfig({ path: path.resolve(__dirname, '.env.local') })

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const isLocalHost = /localhost|127\.0\.0\.1/.test(new URL(baseURL).hostname)

/** Avoid logging into production by accident — set E2E_ALLOW_REMOTE_AUTH=1 to override. */
const e2eAuthenticated =
  Boolean(process.env.E2E_USER_EMAIL?.trim()) &&
  Boolean(process.env.E2E_USER_PASSWORD) &&
  (isLocalHost || process.env.E2E_ALLOW_REMOTE_AUTH === '1')

const authStoragePath = path.join(__dirname, 'e2e', '.auth', 'user.json')

/**
 * E2E tests — API + browser flows for SmartRecruit (Next.js app).
 *
 * Guest tests: always run (`e2e/*.spec.ts`, excluding `e2e/authenticated/`).
 * Authenticated tests: only when `E2E_USER_EMAIL` + `E2E_USER_PASSWORD` are set
 * and base URL is localhost OR `E2E_ALLOW_REMOTE_AUTH=1`.
 *
 * First-time setup: `npx playwright install chromium`
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  globalSetup: path.join(__dirname, 'e2e', 'global-setup.ts'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/authenticated/**',
    },
    ...(e2eAuthenticated
      ? [
          {
            name: 'chromium-authenticated',
            use: {
              ...devices['Desktop Chrome'],
              storageState: authStoragePath,
            },
            testMatch: '**/authenticated/**/*.spec.ts',
          },
        ]
      : []),
  ],
})
