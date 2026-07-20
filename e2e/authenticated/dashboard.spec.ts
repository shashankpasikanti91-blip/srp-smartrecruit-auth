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
})
