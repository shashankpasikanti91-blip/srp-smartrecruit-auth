import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'

/**
 * Live smoke: open each major nav item and assert primary interactive fields exist.
 * Skips tabs not visible for the current role.
 */
const TAB_FIELDS: Array<{
  label: string
  fields: Array<{ kind: 'placeholder' | 'role' | 'text'; name: string | RegExp }>
}> = [
  {
    label: 'Jobs',
    fields: [
      { kind: 'role', name: /Add Job|New Job|Create Job|Upload/i },
      { kind: 'placeholder', name: /search|job|title|company/i },
    ],
  },
  {
    label: 'Candidates',
    fields: [
      { kind: 'placeholder', name: /RES-ID|skills|search/i },
      { kind: 'role', name: /Add Candidate|New Candidate|Upload/i },
      { kind: 'text', name: 'Stage' },
    ],
  },
  {
    label: 'Submissions',
    fields: [{ kind: 'placeholder', name: /search|candidate|job/i }],
  },
  {
    label: 'Interviews',
    fields: [{ kind: 'placeholder', name: /search|candidate|interview/i }],
  },
  {
    label: 'Offer & Onboarding',
    fields: [{ kind: 'placeholder', name: /search|candidate|offer/i }],
  },
  {
    label: 'AI Hub',
    fields: [
      { kind: 'text', name: /Screen|Boolean|Generate|Bulk|AI|template|Welcome/i },
    ],
  },
  {
    label: 'AI Screening',
    fields: [{ kind: 'text', name: /Screen|Score|Upload|JD|Match/i }],
  },
  {
    label: 'Boolean Search',
    fields: [{ kind: 'text', name: /Boolean|LinkedIn|Naukri|Search/i }],
  },
  {
    label: 'AI Composer',
    fields: [{ kind: 'text', name: /Compose|Email|Draft|Message/i }],
  },
  {
    label: 'JD Writer',
    fields: [{ kind: 'text', name: /JD|Job Description|Writer|Generate/i }],
  },
  {
    label: 'Communications',
    fields: [{ kind: 'text', name: /Template|Connector|Message|Email|Send/i }],
  },
  {
    label: 'Settings',
    fields: [{ kind: 'text', name: /Profile|Account|Team|Billing|Security/i }],
  },
]

test.describe('Authenticated nav fields smoke', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page)
  })

  for (const tab of TAB_FIELDS) {
    test(`${tab.label}: primary fields visible`, async ({ page }) => {
      const nav = page.locator('aside').locator('nav').first()
      const btn = nav.getByRole('button', {
        name: new RegExp(`^${tab.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|\\s|$)`, 'i'),
      })
      const visible = await btn.isVisible().catch(() => false)
      test.skip(!visible, `${tab.label} not in sidebar for this role`)

      await openTab(page, tab.label)
      await page.waitForTimeout(400)

      let matched = 0
      for (const f of tab.fields) {
        let ok = false
        if (f.kind === 'placeholder') {
          ok = await page.getByPlaceholder(f.name).first().isVisible({ timeout: 8_000 }).catch(() => false)
        } else if (f.kind === 'role') {
          ok = await page.getByRole('button', { name: f.name }).first().isVisible({ timeout: 8_000 }).catch(() => false)
        } else {
          ok = await page.getByText(f.name).first().isVisible({ timeout: 8_000 }).catch(() => false)
        }
        if (ok) matched++
      }
      expect(matched, `${tab.label} should show at least one primary field`).toBeGreaterThan(0)
    })
  }

  test('global search opens with Ctrl+K and has search field', async ({ page }) => {
    await page.keyboard.press('Control+K')
    const input = page.getByRole('dialog', { name: /Global search/i }).getByLabel(/Search candidates/i)
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('test')
    await page.keyboard.press('Escape')
  })

  test('notification bell opens panel', async ({ page }) => {
    const bell = page.getByRole('button', { name: /Notifications/i }).first()
    await expect(bell).toBeVisible({ timeout: 10_000 })
    await bell.click()
    await expect(page.getByRole('dialog', { name: /Notifications/i })).toBeVisible({ timeout: 8_000 })
  })
})
