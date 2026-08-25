import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab, expectTabHeading } from '../helpers/dashboard'

test.describe('Ops lists — columns & actions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
  })

  test('Submissions tab shows Cand. ID / Recruiter / Feedback columns', async ({ page }) => {
    await openTab(page, 'Submissions')
    await expectTabHeading(page, /Client Submissions|Submissions/i)
    const table = page.locator('table.ent-table').first()
    await expect(table.getByRole('columnheader', { name: 'Cand. ID' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Sub. ID' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Hire Type' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Recruiter' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Feedback status' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Detail' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Recorded by' })).toBeVisible()
    await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Excel/i })).toBeVisible()
  })

  test('Interviews tab shows 1st/2nd date-time and salary columns', async ({ page }) => {
    await openTab(page, 'Interviews')
    await expectTabHeading(page, /Interview Scheduling|Interviews/i)
    const table = page.locator('table.ent-table').first()
    await expect(table.getByRole('columnheader', { name: 'Cand. ID' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Int. ID' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: '1st Date' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: '2nd Time' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Current Sal.' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Expected Sal.' })).toBeVisible()
  })

  test('Offer & Onboarding Selected & Docs + HR columns + Docs panel', async ({ page }) => {
    await openTab(page, 'Offer & Onboarding')
    await expectTabHeading(page, /Offer & Onboarding/i)
    await page.getByRole('button', { name: 'Selected & Docs' }).click()
    let table = page.locator('table.ent-table').first()
    await expect(table.getByRole('columnheader', { name: /Emp\.?\/Cand\. ID/i })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Docs status' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Slots filled' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Interview feedback' })).toBeVisible()

    await page.getByRole('button', { name: 'HR & Offer' }).click()
    table = page.locator('table.ent-table').first()
    await expect(table.getByRole('columnheader', { name: 'HR discussion' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Budget OK' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Offer letter' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Joined status' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'HR Ops' })).toBeVisible()

    await page.getByRole('button', { name: 'Selected & Docs' }).click()
    const docsBtn = page.getByRole('button', { name: /^Docs$/i }).first()
    if (await docsBtn.isVisible().catch(() => false)) {
      await docsBtn.click()
      await expect(page.getByRole('heading', { name: /Upload docs/i })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText(/Resume \/ CV/i)).toBeVisible()
      await page.getByRole('button').filter({ has: page.locator('svg') }).first().click({ force: true }).catch(() => {})
      // Close via X if still open
      const close = page.locator('button').filter({ has: page.locator('svg.lucide-x, svg') }).first()
      await page.keyboard.press('Escape').catch(() => {})
    }
  })
})
