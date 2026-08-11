import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'

/**
 * AI Hub + direct AI Screening sidebar shortcuts (existing tabs only).
 */
async function openAiHub(page: Parameters<typeof openTab>[0]) {
  await gotoDashboard(page)
  await openTab(page, 'AI Hub')
  await expect(page.getByRole('heading', { name: /AI Assistant|AI Hub/i }).first()).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('AI Hub', () => {
  test('opens AI Hub with assistant chat input', async ({ page }) => {
    await openAiHub(page)
    await expect(
      page.getByPlaceholder(/Ask|message|pipeline|role/i).or(page.locator('textarea').first())
    ).toBeVisible({ timeout: 15_000 })
  })

  test('shows AI Hub welcome or templates', async ({ page }) => {
    await openAiHub(page)
    const hubSignal = page.getByText(/AI Hub|Generate JD|Boolean|Screening|template|Welcome/i).first()
    await expect(hubSignal).toBeVisible({ timeout: 15_000 })
  })

  test('AI Screening sidebar shortcut opens existing screening tab', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'AI Screening')
    await expect(page.getByRole('heading', { name: /Screen|Match|AI/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Unexpected token/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Run AI Screening/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Single CV/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bulk CVs/i })).toBeVisible()
  })

  test('Bulk CVs mode shows multi-upload dropzone without parser crash', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'AI Screening')
    await page.getByRole('button', { name: /Bulk CVs/i }).click()
    await expect(page.getByText(/Upload multiple CVs/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Unexpected token/i)).toHaveCount(0)
    await expect(page.getByText(/is not valid JSON/i)).toHaveCount(0)
  })

  test('template chips are interactive when present', async ({ page }) => {
    await openAiHub(page)
    const chip = page.getByRole('button', { name: /Generate JD|Boolean|Email template|Interview/i }).first()
    const visible = await chip.isVisible().catch(() => false)
    test.skip(!visible, 'No template chips in this AI Hub build')
    await expect(chip).toBeEnabled()
    await chip.click({ trial: true })
    await chip.click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
