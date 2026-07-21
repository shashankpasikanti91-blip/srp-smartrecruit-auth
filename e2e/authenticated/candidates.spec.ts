import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'
import {
  waitForCandidatesApi,
  waitForCandidatesView,
  getEntTableRowCount,
  getFirstShortId,
  selectFilterByLabel,
} from '../helpers/filters'

test.describe('Candidates tracker filters', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Candidates')
    await expect(page.getByRole('heading', { name: 'Candidates', level: 1 })).toBeVisible({ timeout: 15_000 })
    await waitForCandidatesView(page)
  })

  test('shows ID column in table', async ({ page }) => {
    const table = page.locator('.ent-table')
    await expect(table).toBeVisible({ timeout: 15_000 })
    await expect(table.getByRole('columnheader', { name: 'ID' })).toBeVisible()
  })

  test('search input accepts RES-ID placeholder hint', async ({ page }) => {
    await expect(page.getByPlaceholder(/RES-ID|skills/i)).toBeVisible()
  })

  test('filter controls are visible', async ({ page }) => {
    await expect(page.getByText('Stage', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('search by RES- short ID filters to matching row', async ({ page }) => {
    const resId = await getFirstShortId(page, 'RES')
    test.skip(!resId, 'No candidates with RES- ID in workspace')

    const baseline = await getEntTableRowCount(page)
    test.skip(baseline === 0, 'No candidate rows')

    const apiPromise = waitForCandidatesApi(page)
    await page.getByPlaceholder(/RES-ID|skills/i).fill(resId!)
    await apiPromise

    const rows = await getEntTableRowCount(page)
    expect(rows).toBeGreaterThanOrEqual(1)
    await expect(page.locator('.ent-table').getByText(resId!, { exact: false }).first()).toBeVisible()
  })

  test('stage filter sends stage param and changes results', async ({ page }) => {
    const baseline = await getEntTableRowCount(page)
    test.skip(baseline === 0, 'No candidates to filter')

    const [response] = await Promise.all([
      waitForCandidatesApi(page),
      selectFilterByLabel(page, 'Stage', 'applied'),
    ])
    expect(response.url()).toContain('stage=applied')

    const filtered = await getEntTableRowCount(page)
    expect(filtered).toBeLessThanOrEqual(baseline)
  })

  test('match filter sends match param to API', async ({ page }) => {
    const [response] = await Promise.all([
      waitForCandidatesApi(page),
      selectFilterByLabel(page, 'Match', 'best'),
    ])
    expect(response.url()).toContain('match=best')
  })

  test('combined stage and skill filters send both params', async ({ page }) => {
    await selectFilterByLabel(page, 'Stage', 'screening')
    const stageResponse = await waitForCandidatesApi(page)
    expect(stageResponse.url()).toContain('stage=screening')

    const skillResponse = await Promise.all([
      waitForCandidatesApi(page),
      page.locator('input[list="skill-suggestions"]').fill('React'),
    ]).then(([r]) => r)
    expect(skillResponse.url()).toContain('skill=React')
    expect(skillResponse.url()).toContain('stage=screening')
  })

  test('Clear restores unfiltered candidate list', async ({ page }) => {
    const baseline = await getEntTableRowCount(page)

    await selectFilterByLabel(page, 'Stage', 'applied')
    await waitForCandidatesApi(page)

    await page.getByRole('button', { name: 'Clear' }).click()
    await waitForCandidatesApi(page)

    const restored = await getEntTableRowCount(page)
    expect(restored).toBe(baseline)
    await expect(page.getByRole('button', { name: 'Clear' })).not.toBeVisible()
  })

  test('column picker toggles table columns', async ({ page }) => {
    const table = page.locator('.ent-table')
    await expect(table.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    await page.locator('button').filter({ hasText: 'Columns' }).click()
    await page.getByLabel('Email').uncheck()
    await expect(table.getByRole('columnheader', { name: 'Email' })).not.toBeVisible()
  })

  test('candidate drawer shows Documents and Timeline tabs', async ({ page }) => {
    const baseline = await getEntTableRowCount(page)
    test.skip(baseline === 0, 'No candidates')

    // Click the first candidate row (the tr itself opens the drawer)
    await page.locator('.ent-table tbody tr').first().click()
    // Wait for the drawer to open
    const drawer = page.locator('.drawer-panel').first()
    await expect(drawer).toBeVisible({ timeout: 10_000 })
    // Documents tab should be available in the 360 tab bar (scope to drawer to avoid sidebar conflict)
    const docsBtn = drawer.getByRole('button', { name: 'Documents' })
    await expect(docsBtn).toBeVisible({ timeout: 10_000 })
    await docsBtn.click()
    // After clicking Documents, the drawer should still be visible
    await expect(drawer).toBeVisible({ timeout: 10_000 })
    const timelineBtn = drawer.getByRole('button', { name: 'Timeline' })
    await expect(timelineBtn).toBeVisible({ timeout: 10_000 })
    await timelineBtn.click()
    await expect(drawer).toBeVisible({ timeout: 10_000 })
  })
})
