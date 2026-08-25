import { test, expect } from '@playwright/test'
import { DASHBOARD_TABS, gotoDashboard, openTab } from '../helpers/dashboard'

const MODULE_GETS = [
  '/api/jobs',
  '/api/candidates?limit=5',
  '/api/clients',
  '/api/submissions?limit=5',
  '/api/interviews?limit=5',
  '/api/offers?limit=5',
  '/api/follow-ups?mine=1',
  '/api/dashboard/insights?days=30',
  '/api/analytics/recruiter/me?days=30',
  '/api/profile',
]

test.describe('Module mapping — APIs, dashboard grid, submit', () => {
  test('core module APIs never 500', async ({ request }) => {
    for (const path of MODULE_GETS) {
      const res = await request.get(path)
      expect(res.status(), `${path} returned ${res.status()}`).toBeLessThan(500)
      expect(res.ok() || res.status() === 403, `${path} ${res.status()}`).toBeTruthy()
    }
  })

  test('POST /api/submissions does not 500; Jobs Applied lists the share', async ({ request }) => {
    test.setTimeout(90_000)
    const jobsRes = await request.get('/api/jobs')
    expect(jobsRes.ok()).toBeTruthy()
    const jobs = (await jobsRes.json()).jobs as Array<{ id: string; title?: string; company?: string | null }>
    test.skip(!jobs?.length, 'Need a job to submit against')

    const candsRes = await request.get('/api/candidates?limit=20')
    expect(candsRes.ok()).toBeTruthy()
    const candsBody = await candsRes.json()
    const candidates = (candsBody.candidates ?? candsBody.resumes ?? []) as Array<{ id: string }>
    test.skip(!candidates.length, 'Need a candidate')

    const job = jobs[0]
    const cand = candidates[0]
    const submit = await request.post('/api/submissions', {
      data: {
        resume_id: cand.id,
        job_post_id: job.id,
        client_name: job.company || 'Demo Client',
        applying_for: job.title || 'Role',
        stage: 'submitted',
        submission_date: new Date().toISOString().slice(0, 10),
      },
    })
    const body = await submit.json().catch(() => ({}))
    expect(submit.status(), JSON.stringify(body)).not.toBe(500)
    expect(submit.ok() || submit.status() === 409, JSON.stringify(body)).toBeTruthy()

    const shares = await request.get(`/api/candidates/${cand.id}/jobs`)
    expect(shares.status()).toBeLessThan(500)
    expect(shares.ok()).toBeTruthy()
    const shareBody = await shares.json()
    expect((shareBody.shares ?? shareBody.jobs ?? []).length).toBeGreaterThan(0)

    const list = await request.get(`/api/submissions?resume_id=${cand.id}&limit=10`)
    expect(list.status()).toBeLessThan(500)
    expect(list.ok()).toBeTruthy()
  })

  test('dashboard KPI grid is a 3×3 (9 cards, 3 columns)', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Dashboard')
    const grid = page.getByTestId('recruiter-kpi-grid')
    await expect(grid).toBeVisible({ timeout: 25_000 })
    const cards = grid.locator('[data-testid^="kpi-card-"]')
    await expect(cards).toHaveCount(9)
    await expect(page.getByText(/^Server error$/i)).toHaveCount(0)

    const first = await cards.nth(0).boundingBox()
    const third = await cards.nth(2).boundingBox()
    const fourth = await cards.nth(3).boundingBox()
    expect(first && third && fourth).toBeTruthy()
    expect(Math.abs(third!.y - first!.y)).toBeLessThan(24)
    expect(fourth!.y).toBeGreaterThan(first!.y + 12)
  })

  for (const { label, heading } of DASHBOARD_TABS.filter(t =>
    ['Dashboard', 'Jobs', 'Candidates', 'Internal Talent Pool', 'Clients', 'Submissions', 'Interviews', 'Follow-ups', 'Offer & Onboarding', 'Documents'].includes(t.label),
  )) {
    test(`${label} tab opens and has no Server error`, async ({ page }) => {
      await gotoDashboard(page)
      const nav = page.locator('aside').locator('nav').first()
      const btn = nav.getByRole('button', {
        name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|\\s|$)`, 'i'),
      })
      const visible = await btn.isVisible().catch(() => false)
      test.skip(!visible, `${label} not in sidebar for this role`)
      await openTab(page, label)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/^Server error$/i)).toHaveCount(0)
    })
  }
})
