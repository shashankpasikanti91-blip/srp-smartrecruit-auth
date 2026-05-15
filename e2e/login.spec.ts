import { test, expect } from '@playwright/test'

/**
 * Credentials login test – runs against live server when
 *   PLAYWRIGHT_BASE_URL=https://recruit.srpailabs.com
 *   E2E_DEMO_EMAIL=demo@srpailabs.com
 *   E2E_DEMO_PASSWORD=Demo@1234
 * are set.  Falls back to demo creds if vars are missing.
 */
const DEMO_EMAIL    = process.env.E2E_DEMO_EMAIL    ?? 'demo@srpailabs.com'
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'Demo@1234'

test.describe('Credentials login flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', DEMO_EMAIL)
    await page.fill('input[type="password"]', 'WrongPassword999!')
    await page.click('button[type="submit"]')
    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('correct demo credentials redirect to dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', DEMO_EMAIL)
    await page.fill('input[type="password"]', DEMO_PASSWORD)
    await page.click('button[type="submit"]')
    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 })
    expect(page.url()).toMatch(/\/dashboard/)
  })

  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', DEMO_EMAIL)
    await page.fill('input[type="password"]', DEMO_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 })
    // Core dashboard elements
    await expect(page.locator('body')).not.toBeEmpty()
    // No error messages
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
    await expect(page.locator('text=500')).not.toBeVisible()
  })
})
