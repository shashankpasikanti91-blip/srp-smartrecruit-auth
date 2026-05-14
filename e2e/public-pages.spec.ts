import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByText('Sign in to continue to SmartRecruit')).toBeVisible()
  })

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup')
    await expect(
      page.getByRole('heading', { name: /Create account|Complete registration/ })
    ).toBeVisible()
  })

  test('accept-invite without token shows error', async ({ page }) => {
    await page.goto('/accept-invite')
    await expect(page.getByText('No invite token found.')).toBeVisible({ timeout: 15_000 })
  })
})
