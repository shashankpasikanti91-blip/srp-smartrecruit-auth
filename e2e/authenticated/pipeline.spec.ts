import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'
import { waitForCandidatesApi, getPipelineTotalFromStats } from '../helpers/filters'

test.describe('Pipeline board filters', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Pipeline')
    await expect(page.getByRole('heading', { name: 'Pipeline', level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.pipeline-board-scroll')).toBeVisible({ timeout: 20_000 })
  })

  test('renders pipeline stage columns', async ({ page }) => {
    for (const stage of ['Sourced', 'Applied', 'Screening', 'Interview', 'Offer', 'Hired']) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('stage stat navigates to filtered candidates', async ({ page }) => {
    await page.getByRole('button', { name: /Applied/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Candidates', level: 1 })).toBeVisible({ timeout: 15_000 })
    const url = page.url()
    expect(url).toContain('/dashboard')
  })

  test('job filter dropdown is visible above kanban scroll area', async ({ page }) => {
    const jobSelect = page.locator('select').filter({ has: page.locator('option:text("All Jobs")') })
    await expect(jobSelect).toBeVisible()
    await expect(page.locator('.pipeline-board-scroll')).toBeVisible()
  })

  test('job filter changes pipeline candidate counts', async ({ page }) => {
    const jobSelect = page.locator('select').filter({ has: page.locator('option:text("All Jobs")') })
    const options = jobSelect.locator('option')
    const optionCount = await options.count()
    test.skip(optionCount <= 1, 'No jobs to filter pipeline by')

    const allTotal = await getPipelineTotalFromStats(page)
    const firstJobValue = await options.nth(1).getAttribute('value')
    test.skip(!firstJobValue, 'No job option value')

    const [response] = await Promise.all([
      waitForCandidatesApi(page),
      jobSelect.selectOption(firstJobValue!),
    ])
    expect(response.url()).toContain('job_id=')

    const filteredTotal = await getPipelineTotalFromStats(page)
    expect(filteredTotal).toBeLessThanOrEqual(allTotal)
  })

  test('clicking kanban card opens candidate drawer', async ({ page }) => {
    const card = page.locator('.pipeline-column-scroll').locator('.cursor-grab').first()
    test.skip(!(await card.isVisible().catch(() => false)), 'No candidates on pipeline board')

    const nameOnCard = await card.locator('p.text-xs.font-semibold').first().textContent()
    await card.locator('p.text-xs.font-semibold').first().click()

    const drawer = page.locator('.drawer-panel')
    await expect(drawer).toBeVisible({ timeout: 10_000 })
    if (nameOnCard?.trim()) {
      await expect(drawer.getByRole('heading', { level: 2 })).toContainText(nameOnCard.trim())
    }
  })
})
