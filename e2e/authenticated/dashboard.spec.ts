import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab, expectTabHeading } from '../helpers/dashboard'

test.describe('Authenticated dashboard', () => {
  test('shows workspace sidebar after session loads', async ({ page }) => {
    await gotoDashboard(page)
  })

  test('can open Candidates tab', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Candidates')
    await expectTabHeading(page, 'Candidates')
  })

  test('KPI strip shows live recruiter cards', async ({ page }) => {
    await gotoDashboard(page)
    const grid = page.getByTestId('recruiter-kpi-grid')
    await expect(grid).toBeVisible({ timeout: 25_000 })
    // Phase D live strip: 10 recruiter cards (management KPIs render in a separate team strip)
    await expect(grid.locator('[data-testid^="kpi-card-"]')).toHaveCount(10)
  })
})
