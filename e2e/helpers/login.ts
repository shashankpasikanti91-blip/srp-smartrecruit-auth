import { expect, type Page } from '@playwright/test'

export const DEMO_EMAIL =
  process.env.E2E_USER_EMAIL?.trim() ||
  process.env.E2E_DEMO_EMAIL?.trim() ||
  'demo@srpailabs.com'

export const DEMO_PASSWORD =
  process.env.E2E_USER_PASSWORD ||
  process.env.E2E_DEMO_PASSWORD ||
  'Demo@1234'

/** Controlled React inputs: type so onChange updates state. Wait out Turbopack "Compiling…". */
export async function fillCredentials(
  page: Page,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('srp_remember_email') } catch { /* ignore */ }
  })
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByText('Compiling...').waitFor({ state: 'hidden', timeout: 90_000 }).catch(() => {})
  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible({ timeout: 20_000 })
  const emailInput = page.getByTestId('login-email')
  const passwordInput = page.getByTestId('login-password')
  await emailInput.waitFor({ state: 'visible' })
  await emailInput.click()
  await emailInput.fill('')
  await emailInput.fill(email)
  // React controlled inputs can drop the first fill under Turbopack — retry once
  if ((await emailInput.inputValue()) !== email) {
    await emailInput.fill(email)
  }
  await passwordInput.click()
  await passwordInput.fill('')
  await passwordInput.fill(password)
  if ((await passwordInput.inputValue()) !== password) {
    await passwordInput.fill(password)
  }
  await expect(emailInput).toHaveValue(email)
  await expect(passwordInput).toHaveValue(password)
}

export async function signInToDashboard(page: Page) {
  await fillCredentials(page)
  await page.getByRole('button', { name: /Sign in to SmartRecruit/i }).click()
  const empty = page.getByText(/Please enter your email and password/i)
  if (await empty.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await fillCredentials(page)
    await page.getByRole('button', { name: /Sign in to SmartRecruit/i }).click()
  }
  await page.waitForURL(/\/dashboard/, { timeout: 90_000, waitUntil: 'commit' })
}

export async function skipIfUnauthed(page: Page) {
  const res = await page.request.get('/api/profile')
  if (!res.ok()) {
    throw new Error(`Authenticated session missing (GET /api/profile → ${res.status()}). Login global-setup failed.`)
  }
}
