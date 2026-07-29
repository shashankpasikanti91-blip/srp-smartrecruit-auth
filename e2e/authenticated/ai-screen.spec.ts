import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'

/**
 * AI Screening lives under AI Hub (coach workspace) after P6 consolidation.
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

  test('template chips are interactive when present', async ({ page }) => {
    await openAiHub(page)
    const chip = page.getByRole('button', { name: /Generate JD|Boolean|Email template|Interview/i }).first()
    const visible = await chip.isVisible().catch(() => false)
    test.skip(!visible, 'No template chips in this AI Hub build')
    await chip.click()
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible()
  })
})
