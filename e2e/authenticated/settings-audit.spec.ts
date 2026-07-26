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
    const auditCard = page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Audit Trail' }) })
    await expect(auditCard).toBeVisible({ timeout: 15_000 })
    await auditCard.scrollIntoViewIfNeeded()

    const refreshBtn = auditCard.getByRole('button', { name: /Refresh/i })
    await expect(refreshBtn).toBeEnabled({ timeout: 15_000 })

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/audit') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await refreshBtn.click()
    const response = await responsePromise
    expect(response.ok()).toBeTruthy()

    // Empty tenants show a placeholder; otherwise sticky table wrapper.
    const empty = auditCard.getByText(/No activity recorded yet/i)
    const tableWrap = page.locator('.ent-table-wrap').filter({ has: page.locator('thead th:text("Action")') })
    await expect(empty.or(tableWrap)).toBeVisible({ timeout: 15_000 })
    if (await tableWrap.isVisible().catch(() => false)) {
      await expect(tableWrap.locator('.ent-table')).toBeVisible()
    }
  })
})
