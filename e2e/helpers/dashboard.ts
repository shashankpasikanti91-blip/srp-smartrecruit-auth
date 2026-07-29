import { Page, expect } from '@playwright/test'

/** Sidebar tab labels mapped to expected page headings (h1). */
export const DASHBOARD_TABS: { label: string; heading: string | RegExp }[] = [
  { label: 'Dashboard', heading: /Dashboard|Workspace|Recruitment|Overview|My Workspace/i },
  { label: 'Jobs', heading: /Job/i },
  { label: 'Candidates', heading: /Candidates/i },
  { label: 'Clients', heading: /Clients/i },
  { label: 'Submissions', heading: /Client Submissions|Submissions/i },
  { label: 'Interviews', heading: /Interview Scheduling|Interviews/i },
  { label: 'Follow-ups', heading: /Follow-?ups/i },
  { label: 'Offer & Onboarding', heading: /Offer & Onboarding/i },
  { label: 'Documents', heading: /Documents/i },
  { label: 'Reports', heading: /Reports/i },
  { label: 'My Performance', heading: /Performance|My Performance/i },
  { label: 'AI Hub', heading: /AI Assistant|AI Hub|SmartRecruit/i },
  { label: 'Communications', heading: /Communication/i },
  { label: 'ESS', heading: /ESS|Employee/i },
  { label: 'Settings', heading: /Account Settings|Settings/i },
]

export async function gotoDashboard(page: Page) {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
  const nav = page.locator('aside').locator('nav').first()
  await expect(nav.getByRole('button', { name: /Candidates|Jobs|Dashboard/i }).first()).toBeVisible({
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
