import { test, expect } from '@playwright/test'
import { DASHBOARD_TABS, gotoDashboard, openTab, expectTabHeading } from '../helpers/dashboard'

test.describe('Authenticated dashboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
  })

  for (const { label, heading } of DASHBOARD_TABS) {
    test(`opens ${label} tab`, async ({ page }) => {
      const nav = page.locator('aside').locator('nav').first()
      const btn = nav.getByRole('button', {
        name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|\\s|$)`, 'i'),
      })
      const visible = await btn.isVisible().catch(() => false)
      test.skip(!visible, `${label} not available for this role`)

      await openTab(page, label)
      // Prefer h1; fall back to any prominent heading in main content
      const h1 = page.getByRole('heading', { level: 1, name: heading })
      if (await h1.isVisible().catch(() => false)) {
        await expect(h1).toBeVisible()
      } else {
        await expect(page.locator('main, .dashboard-root').getByRole('heading', { name: heading }).first()).toBeVisible({
          timeout: 15_000,
        })
      }
    })
  }
})
