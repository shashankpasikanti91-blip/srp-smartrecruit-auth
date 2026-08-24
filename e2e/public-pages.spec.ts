import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
    await expect(page.getByText(/Welcome back/i)).toBeVisible()
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
      page.getByRole('heading', { name: 'SmartRecruit', exact: true })
    ).toBeVisible({ timeout: 30_000 })
  })

  test('marketing / legal / support pages return 200', async ({ request }) => {
    test.setTimeout(180_000)
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
      // Some marketing paths 308-redirect (e.g. to /#cta); do not follow hash targets.
      const res = await request.get(p, { timeout: 60_000, maxRedirects: 0 })
      expect(
        [200, 201, 204, 301, 302, 307, 308],
        `${p} should be OK or redirect (got ${res.status()})`,
      ).toContain(res.status())
    }
  })
})
