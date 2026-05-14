import { test, expect } from '@playwright/test'

test.describe('Dashboard access control', () => {
  test('unauthenticated user is sent away from /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 20_000 })
    expect(page.url()).toMatch(/\/login/)
  })
})
