import { Page, expect } from '@playwright/test'

/** Sidebar tab labels mapped to expected page headings (h1). */
export const DASHBOARD_TABS: { label: string; heading: string | RegExp }[] = [
  { label: 'Pipeline', heading: 'Pipeline' },
  { label: 'Candidates', heading: 'Candidates' },
  { label: 'AI Screen', heading: 'AI Screening' },
  { label: 'Compose', heading: 'AI Compose' },
  { label: 'Jobs', heading: 'Job Posts' },
  { label: 'Analytics', heading: 'Recruitment Analytics' },
  { label: 'JD Writer', heading: 'JD Intelligence' },
  { label: 'Boolean', heading: 'Boolean Search Generator' },
  { label: 'Import', heading: 'Import Engine' },
  { label: 'Integrations', heading: 'Integrations' },
  { label: 'Comms Hub', heading: 'Communication Hub' },
  { label: 'Settings', heading: 'Account Settings' },
]

export async function gotoDashboard(page: Page) {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
  const nav = page.locator('aside').locator('nav').first()
  await expect(nav.getByRole('button', { name: /Pipeline/i })).toBeVisible({
    timeout: 25_000,
  })
}

export async function openTab(page: Page, tabLabel: string) {
  const escaped = tabLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nav = page.locator('aside').locator('nav').first()
  await nav.getByRole('button', { name: new RegExp(`^${escaped}(\\b|\\s|$)`, 'i') }).click()
}

export async function expectTabHeading(page: Page, heading: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 15_000 })
}
