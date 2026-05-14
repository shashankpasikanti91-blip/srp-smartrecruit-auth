import { test, expect } from '@playwright/test'

test.describe('Authenticated dashboard', () => {
  test('shows workspace sidebar after session loads', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Pipeline' })).toBeVisible({
      timeout: 25_000,
    })
  })

  test('can open Candidates tab', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Candidates' }).click()
    await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible({ timeout: 15_000 })
  })
})
