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
import { fillCredentials } from './helpers/login'

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

  try {
    const csrfRes = await page.request.get('/api/auth/csrf')
    const csrfJson = await csrfRes.json().catch(() => ({}))
    const csrfToken = csrfJson?.csrfToken as string | undefined
    if (csrfToken) {
      const loginRes = await page.request.post('/api/auth/callback/credentials', {
        form: {
          csrfToken,
          email,
          password,
          json: 'true',
          callbackUrl: `${origin}/dashboard`,
        },
      })
      const sessionRes = await page.request.get('/api/auth/session')
      const session = await sessionRes.json().catch(() => ({}))
      if (sessionRes.ok() && session?.user) {
        await context.storageState({ path: authFile })
        await browser.close()
        console.log(`[e2e global-setup] Saved storage state → ${authFile}`)
        return
      }
      console.warn(
        `[e2e global-setup] Credentials callback ${loginRes.status()}; falling back to UI login.`,
      )
    }

    await fillCredentials(page, email, password)
    await page.getByText('Compiling...').waitFor({ state: 'hidden', timeout: 90_000 }).catch(() => {})
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard/, { timeout: 90_000, waitUntil: 'commit' })
    await context.storageState({ path: authFile })
    await browser.close()
    console.log(`[e2e global-setup] Saved storage state → ${authFile}`)
  } catch {
    const invalid = await page.locator('text=Invalid email or password').isVisible().catch(() => false)
    const enterCreds = await page.getByText(/Please enter your email and password/i).isVisible().catch(() => false)
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 400)
    await page.screenshot({ path: path.join(authDir, 'login-failed.png'), fullPage: true }).catch(() => {})
    await browser.close()
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
    console.warn(
      `[e2e global-setup] Login did not reach /dashboard (invalid=${invalid}, emptyFields=${enterCreds}). ` +
        `Snippet: ${bodyText.replace(/\s+/g, ' ').slice(0, 200)}`,
    )
  }
}
