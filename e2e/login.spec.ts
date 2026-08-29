import { test, expect } from '@playwright/test'
import { DEMO_EMAIL, fillCredentials, signInToDashboard } from './helpers/login'

test.describe('Credentials login flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('wrong password stays on login', async ({ page }) => {
    await fillCredentials(page, DEMO_EMAIL, 'WrongPassword999!')
    await page.getByRole('button', { name: /Sign in to SmartRecruit/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })

  test('correct demo credentials redirect to dashboard', async ({ page, request }) => {
    test.setTimeout(90_000)
    const health = await request.get('/api/health')
    const h = await health.json().catch(() => ({}))
    test.skip(!(h.database?.ok ?? h.db?.ok), 'Postgres not available — skip credential login')
    await signInToDashboard(page)
    expect(page.url()).toMatch(/\/dashboard/)
  })

  test('dashboard loads after login', async ({ page, request }) => {
    test.setTimeout(120_000)
    const health = await request.get('/api/health')
    const h = await health.json().catch(() => ({}))
    test.skip(!(h.database?.ok ?? h.db?.ok), 'Postgres not available — skip credential login')
    await signInToDashboard(page)
    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
    await expect(page.locator('text=500')).not.toBeVisible()
  })
})
