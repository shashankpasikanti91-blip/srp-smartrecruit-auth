import { test, expect } from '@playwright/test'

test.describe('Owner panel', () => {
  test('loads for owner or redirects non-owner to dashboard', async ({ page }) => {
    await page.goto('/owner')
    await page.waitForURL(/\/(owner|dashboard|login)/, { timeout: 25_000 })

    const url = page.url()
    if (url.includes('/owner')) {
      await expect(page.getByText(/Owner Dashboard|Overview/i).first()).toBeVisible({ timeout: 15_000 })
    } else if (url.includes('/dashboard')) {
      // Non-owner correctly redirected — check the sidebar is visible
      const nav = page.locator('aside').locator('nav').first()
      await expect(nav.getByRole('button', { name: /Candidates|Jobs|Dashboard/i }).first()).toBeVisible({
        timeout: 15_000,
      })
    }
  })

  test('jobs and resumes tabs show short IDs when owner access granted', async ({ page }) => {
    await page.goto('/owner')
    await page.waitForURL(/\/(owner|dashboard|login)/, { timeout: 25_000 })
    test.skip(!page.url().includes('/owner'), 'User is not platform owner — skip ID column checks')

    for (const tab of ['Job Posts', 'Resumes'] as const) {
      await page.getByRole('button', { name: tab }).click()
      const wrap = page.locator('.owner-table-wrap')
      await expect(wrap).toBeVisible({ timeout: 15_000 })

      const empty = page.getByText('No data yet')
      if (await empty.isVisible().catch(() => false)) continue

      const idCells = wrap.locator('tbody tr td').first()
      const idText = (await idCells.textContent()) ?? ''
      expect(idText.length).toBeGreaterThan(0)
    }
  })
})
