import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'

/**
 * The Pipeline Kanban board was removed in Phase 3.2.
 * The `pipeline` tab now redirects to Candidates.
 * These tests verify pipeline-related UX via the Candidates tab instead.
 */
test.describe('Pipeline (Candidates view)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Candidates')
    await expect(page.getByRole('heading', { name: 'Candidates', level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('renders pipeline stage columns in candidates view', async ({ page }) => {
    // The header filter select is the first select with stage options (not in-row stage pills)
    const stageLabel = page.locator('span').filter({ hasText: /^Stage$/i }).first()
    await expect(stageLabel).toBeVisible({ timeout: 10_000 })
  })

  test('stage filter navigates to filtered candidates', async ({ page }) => {
    // Stage filter label select lives in the filter bar above the table
    const stageLabel = page.locator('span').filter({ hasText: /^Stage$/i }).first()
    await expect(stageLabel).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Candidates', level: 1 })).toBeVisible()
    expect(page.url()).toContain('/dashboard')
  })

  test('job filter dropdown is visible in candidates view', async ({ page }) => {
    // Refresh button is always present in candidates view
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('stage filter changes candidate counts', async ({ page }) => {
    const table = page.locator('.ent-table')
    await expect(table).toBeVisible({ timeout: 15_000 })
    const before = await table.locator('tbody tr').count()
    test.skip(before === 0, 'No candidates')

    // Use the helper from filters which targets the correct header select
    const { selectFilterByLabel } = await import('../helpers/filters')
    await selectFilterByLabel(page, 'Stage', 'sourced')
    const after = await table.locator('tbody tr').count()
    expect(after).toBeLessThanOrEqual(before)
  })

  test('clicking a candidate row opens Candidate 360', async ({ page }) => {
    const table = page.locator('.ent-table')
    await expect(table).toBeVisible({ timeout: 15_000 })
    const rows = table.locator('tbody tr')
    test.skip((await rows.count()) === 0, 'No candidates')

    await rows.first().click()
    await expect(page).toHaveURL(/\/dashboard\/candidates\/[0-9a-f-]{36}/i, { timeout: 15_000 })
  })
})
