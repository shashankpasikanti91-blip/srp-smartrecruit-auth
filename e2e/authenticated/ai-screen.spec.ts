import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'

/**
 * AI Screening lives inside the "AI Recruit Copilot" sidebar tab.
 * Navigate there, then click the "AI Screen" mode chip to enter the screener.
 */
async function openAiScreen(page: Parameters<typeof openTab>[0]) {
  await gotoDashboard(page)
  await openTab(page, 'AI Recruit Copilot')
  // Wait for the copilot workspace to render
  await expect(page.getByRole('heading', { name: 'AI Recruit Copilot', level: 1 })).toBeVisible({ timeout: 15_000 })
  // Click the AI Screen chip to switch into screening mode
  await page.getByRole('button', { name: 'AI Screen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI Screening', level: 1 })).toBeVisible({ timeout: 15_000 })
}

test.describe('AI Screening', () => {
  test('shows mode switcher buttons', async ({ page }) => {
    await openAiScreen(page)
    await expect(page.getByRole('button', { name: 'Single CV' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bulk CVs' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'From Candidates' })).toBeVisible()
  })

  test('JD textarea is present in single mode', async ({ page }) => {
    await openAiScreen(page)
    await expect(page.getByPlaceholder(/Paste the full job description/i)).toBeVisible()
  })

  test('bulk mode shows upload zone', async ({ page }) => {
    await openAiScreen(page)
    await page.getByRole('button', { name: 'Bulk CVs' }).click()
    await expect(page.getByText(/Upload multiple CVs/i)).toBeVisible({ timeout: 10_000 })
  })

  test('from candidates mode shows picker', async ({ page }) => {
    await openAiScreen(page)
    await page.getByRole('button', { name: 'From Candidates' }).click()
    await expect(page.getByText(/already screened|Select Candidates|token/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('from candidates search filters by RES- ID', async ({ page }) => {
    await openAiScreen(page)
    await page.getByRole('button', { name: 'From Candidates' }).click()

    const pickerRows = page.locator('label').filter({ has: page.locator('input[type="checkbox"]') })
    const rowCount = await pickerRows.count()
    test.skip(rowCount === 0, 'No candidates with CV text in workspace')

    const firstRowText = (await pickerRows.first().textContent()) ?? ''
    const resMatch = firstRowText.match(/RES-\d+/i)
    test.skip(!resMatch, 'No RES- ID visible in picker')

    await page.getByPlaceholder('Search by name / email / ID…').fill(resMatch![0])
    const visibleAfter = await pickerRows.count()
    expect(visibleAfter).toBeGreaterThanOrEqual(1)
    await expect(page.getByText(resMatch![0], { exact: false }).first()).toBeVisible()
  })

  test('skip already screened toggle changes visible picker count', async ({ page }) => {
    await openAiScreen(page)
    await page.getByRole('button', { name: 'From Candidates' }).click()

    const checkbox = page.getByRole('checkbox', { name: /Skip already screened/i })
    await expect(checkbox).toBeVisible()

    const countLabel = page.getByText(/Select all \(\d+\)/)
    test.skip(!(await countLabel.isVisible().catch(() => false)), 'No selectable candidates')

    const withSkip = parseInt(((await countLabel.textContent()) ?? '').match(/\((\d+)\)/)?.[1] ?? '0', 10)

    await checkbox.uncheck()
    const countLabelAfter = page.getByText(/Select all \(\d+\)/)
    const withoutSkip = parseInt(((await countLabelAfter.textContent()) ?? '').match(/\((\d+)\)/)?.[1] ?? '0', 10)
    expect(withoutSkip).toBeGreaterThanOrEqual(withSkip)
  })
})
