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

  test('homepage renders premium hero', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /From hundreds of CVs to a shortlist recruiters can trust/i })
    ).toBeVisible({ timeout: 15_000 })
  })

  test('marketing / legal / support pages return 200', async ({ page }) => {
    const paths = [
      '/',
      '/features',
      '/platform',
      '/solutions',
      '/pricing',
      '/company/about',
      '/company/careers',
      '/company/partners',
      '/company/newsroom',
      '/legal/privacy',
      '/legal/terms',
      '/legal/security',
      '/legal/accessibility',
      '/support/contact',
      '/support/help',
      '/resources/blog',
      '/resources/academy',
    ]
    for (const p of paths) {
      const res = await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      expect(res, `${p} should return a response`).not.toBeNull()
      expect(res!.ok(), `${p} should be HTTP 2xx`).toBeTruthy()
    }
  })
})
