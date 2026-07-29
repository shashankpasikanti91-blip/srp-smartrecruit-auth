import { Page, expect, Response } from '@playwright/test'

/** Wait for the next GET /api/candidates response (after filter change). */
export async function waitForCandidatesApi(page: Page): Promise<Response> {
  return page.waitForResponse(
    r => r.url().includes('/api/candidates') && r.request().method() === 'GET' && r.ok(),
    { timeout: 20_000 },
  )
}

/** Wait until the candidate table area has rendered, regardless of whether the API call already completed. */
export async function waitForCandidatesView(page: Page) {
  const table = page.locator('.ent-table').first()
  const empty = page.getByText(/No candidates found|Try clearing filters|No candidate rows/i).first()
  // `table` and the empty-state message can be simultaneously present.
  // Avoid `table.or(empty)` since it may match multiple elements and trigger strict-mode violations.
  await Promise.race([
    table.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'table').catch(() => null),
    empty.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'empty').catch(() => null),
  ]).then((v) => {
    // Both branches failed to become visible: surface a clear error.
    if (!v) throw new Error('Candidates view failed to render (table and empty state both not visible)')
  })
}

/** Count data rows in the first visible enterprise table (excludes empty-state row). */
export async function getEntTableRowCount(page: Page): Promise<number> {
  const table = page.locator('.ent-table').first()
  await expect(table).toBeVisible({ timeout: 15_000 })
  const empty = table.locator('tbody tr td[colspan]')
  if (await empty.isVisible().catch(() => false)) return 0
  return table.locator('tbody tr').count()
}

/** Read first short ID badge text matching RES- or JOB- prefix from visible table. */
export async function getFirstShortId(page: Page, prefix: 'RES' | 'JOB'): Promise<string | null> {
  const table = page.locator('.ent-table').first()
  if (!(await table.isVisible().catch(() => false))) return null
  const pattern = new RegExp(`^${prefix}-\\d+`, 'i')
  const badges = table.locator('button').filter({ hasText: pattern })
  const count = await badges.count()
  if (count === 0) return null
  const text = (await badges.first().textContent())?.trim() ?? ''
  const match = text.match(pattern)
  return match ? match[0].toUpperCase() : null
}

/** Select an option in a filter dropdown identified by its label text above the select. */
export async function selectFilterByLabel(page: Page, label: string, optionValue: string) {
  const select = page.locator(`span:text-is("${label}")`).locator('xpath=following-sibling::select[1]')
  await select.selectOption(optionValue)
}

/** Parse "N of M" or "N total" from candidates header subtitle. */
export async function getCandidatesCountText(page: Page): Promise<string> {
  const heading = page.getByRole('heading', { name: 'Candidates', level: 1 })
  const section = heading.locator('xpath=ancestor::div[contains(@class,"dash-section-head")]')
  const subtitle = section.locator('p').first()
  return (await subtitle.textContent()) ?? ''
}

/** Parse jobs count from "X of Y jobs" or "X jobs" subtitle. */
export async function getJobsCountFromSubtitle(page: Page): Promise<{ shown: number; total: number }> {
  const text = await page.locator('h1:text-is("Job Posts")').locator('xpath=following::p[1]').textContent()
  const raw = text ?? ''
  const ofMatch = raw.match(/(\d+)\s+of\s+(\d+)/)
  if (ofMatch) return { shown: parseInt(ofMatch[1], 10), total: parseInt(ofMatch[2], 10) }
  const single = raw.match(/(\d+)\s+job/)
  if (single) return { shown: parseInt(single[1], 10), total: parseInt(single[1], 10) }
  return { shown: 0, total: 0 }
}

/** Sum pipeline stage stat numbers from the 6-column stats bar. */
export async function getPipelineTotalFromStats(page: Page): Promise<number> {
  const stats = page.locator('.grid.grid-cols-6.gap-2.mb-4 button p.text-lg.font-bold')
  const count = await stats.count()
  let sum = 0
  for (let i = 0; i < count; i++) {
    const n = parseInt((await stats.nth(i).textContent()) ?? '0', 10)
    if (!Number.isNaN(n)) sum += n
  }
  return sum
}
