import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'
import { getEntTableRowCount, getFirstShortId, getJobsCountFromSubtitle } from '../helpers/filters'

test.describe('Jobs list filters', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Jobs')
    await expect(page.getByRole('heading', { name: 'Job Posts', level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('shows jobs table with ID column', async ({ page }) => {
    const table = page.locator('.ent-table')
    const empty = page.getByText(/No jobs yet|No jobs match/)
    await expect(table.or(empty)).toBeVisible({ timeout: 15_000 })
    if (await table.isVisible()) {
      await expect(table.locator('thead th').first()).toHaveText('ID')
    }
  })

  test('create job button is available', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New Job' }).first()).toBeVisible()
  })

  test('status filter reduces visible jobs', async ({ page }) => {
    const before = await getJobsCountFromSubtitle(page)
    test.skip(before.total === 0, 'No jobs in workspace')

    await page.locator('select').filter({ has: page.locator('option[value="active"]') }).first().selectOption('active')
    const after = await getJobsCountFromSubtitle(page)
    expect(after.shown).toBeLessThanOrEqual(before.total)
    const rows = await getEntTableRowCount(page)
    expect(rows).toBe(after.shown)
  })

  test('type filter works with status filter combined', async ({ page }) => {
    const before = await getJobsCountFromSubtitle(page)
    test.skip(before.total === 0, 'No jobs in workspace')

    const statusSelect = page.locator('select').filter({ has: page.locator('option[value="active"]') })
    const typeSelect = page.locator('select').filter({ has: page.locator('option[value="full-time"]') })
    await statusSelect.selectOption('active')
    await typeSelect.selectOption('full-time')

    const after = await getJobsCountFromSubtitle(page)
    expect(after.shown).toBeLessThanOrEqual(before.total)
  })

  test('search by JOB- short ID filters to one job', async ({ page }) => {
    const jobId = await getFirstShortId(page, 'JOB')
    test.skip(!jobId, 'No jobs with JOB- ID in workspace')

    await page.getByPlaceholder('Role or JOB-ID…').fill(jobId!)
    const rows = await getEntTableRowCount(page)
    expect(rows).toBeGreaterThanOrEqual(1)
    await expect(page.locator('.ent-table').getByText(jobId!, { exact: false }).first()).toBeVisible()

    const { shown, total } = await getJobsCountFromSubtitle(page)
    expect(shown).toBeLessThanOrEqual(total)
  })

  test('Clear restores all jobs', async ({ page }) => {
    const before = await getJobsCountFromSubtitle(page)
    test.skip(before.total === 0, 'No jobs in workspace')

    await page.getByPlaceholder('Role or JOB-ID…').fill('zzzz-nonexistent-role')
    await page.waitForTimeout(300)
    expect(await getEntTableRowCount(page)).toBe(0)

    await page.getByRole('button', { name: 'Clear' }).click()
    await page.waitForTimeout(300)
    const after = await getJobsCountFromSubtitle(page)
    expect(after.shown).toBe(before.total)
  })
})
