/**
 * Logs in with email/password (Credentials provider) and saves storage state
 * for the `chromium-authenticated` project.
 *
 * Skips when credentials are missing or when remote auth is not explicitly allowed.
 */
import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { config as dotenvConfig } from 'dotenv'

export default async function globalSetup() {
  dotenvConfig({ path: path.resolve(__dirname, '..', '.env.e2e.local') })
  dotenvConfig({ path: path.resolve(__dirname, '..', '.env.local') })

  const origin = (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const hostname = (() => {
    try {
      return new URL(origin).hostname
    } catch {
      return ''
    }
  })()
  const isLocalHost = /localhost|127\.0\.0\.1/.test(hostname)

  const email = process.env.E2E_USER_EMAIL?.trim()
  const password = process.env.E2E_USER_PASSWORD
  const allowRemote = process.env.E2E_ALLOW_REMOTE_AUTH === '1'

  if (!email || !password) {
    console.log('[e2e global-setup] No E2E_USER_EMAIL / E2E_USER_PASSWORD — skip auth storage.')
    return
  }

  if (!isLocalHost && !allowRemote) {
    console.log(
      '[e2e global-setup] Skipping login: non-local PLAYWRIGHT_BASE_URL requires E2E_ALLOW_REMOTE_AUTH=1'
    )
    return
  }

  const authDir = path.join(__dirname, '.auth')
  const authFile = path.join(authDir, 'user.json')
  fs.mkdirSync(authDir, { recursive: true })

  console.log(`[e2e global-setup] Signing in as ${email} at ${origin} …`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: origin })
  const page = await context.newPage()

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 })

  const emailTab = page.getByRole('button', { name: 'Email', exact: true })
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.click()
  }

  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()

  try {
    await page.waitForURL(/\/dashboard/, { timeout: 45_000, waitUntil: 'commit' })
  } catch {
    const invalid = await page.locator('text=Invalid email or password').isVisible().catch(() => false)
    await browser.close()
    if (invalid) {
      fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
      console.warn(
        `[e2e global-setup] Login failed for ${email} — authenticated specs will redirect to login. Update .env.e2e.local`
      )
      return
    }
    throw new Error(`[e2e global-setup] Login did not reach /dashboard for ${email}. Current URL: ${page.url()}`)
  }

  await context.storageState({ path: authFile })
  await browser.close()

  console.log(`[e2e global-setup] Saved storage state → ${authFile}`)
}
