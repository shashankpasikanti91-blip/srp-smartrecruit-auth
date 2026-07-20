import { test } from '@playwright/test'
import { DASHBOARD_TABS, gotoDashboard, openTab, expectTabHeading } from '../helpers/dashboard'

test.describe('Authenticated dashboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
  })

  for (const { label, heading } of DASHBOARD_TABS) {
    test(`opens ${label} tab`, async ({ page }) => {
      await openTab(page, label)
      await expectTabHeading(page, heading)
    })
  }
})
