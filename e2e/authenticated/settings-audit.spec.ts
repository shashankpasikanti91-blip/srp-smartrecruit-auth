import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'

test.describe('Settings and audit trail', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Settings')
    await expect(page.getByRole('heading', { name: 'Account Settings', level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('audit trail section is visible', async ({ page }) => {
    await expect(page.getByText('Audit Trail')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Refresh/i }).first()).toBeVisible()
  })

  test('audit refresh loads ent-table with sticky scroll wrapper', async ({ page }) => {
    const refreshBtn = page.locator('text=Audit Trail').locator('xpath=ancestor::div[contains(@class,"rounded-xl")]').getByRole('button', { name: /Refresh/i })
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/audit') && r.ok(), { timeout: 15_000 }),
      refreshBtn.click(),
    ])
    expect(response.ok()).toBeTruthy()

    const tableWrap = page.locator('.ent-table-wrap').filter({ has: page.locator('thead th:text("Action")') })
    await expect(tableWrap).toBeVisible({ timeout: 15_000 })
    await expect(tableWrap.locator('.ent-table')).toBeVisible()
  })
})
