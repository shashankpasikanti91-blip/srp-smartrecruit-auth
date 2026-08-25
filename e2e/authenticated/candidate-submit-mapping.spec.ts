import { test, expect } from '@playwright/test'
import { skipIfUnauthed } from '../helpers/login'

test.describe('Candidate submit mapping', () => {
  test.beforeEach(async ({ page }) => {
    await skipIfUnauthed(page)
  })

  test('same profile can be submitted to a job; 360 and Jobs Applied show the share', async ({ page, request }) => {
    test.setTimeout(120_000)

    const jobsRes = await request.get('/api/jobs')
    expect(jobsRes.ok()).toBeTruthy()
    const jobs = (await jobsRes.json()).jobs as Array<{ id: string; title?: string; company?: string | null }>
    expect(jobs?.length, 'Need at least one job to submit against').toBeGreaterThan(0)
    const job = jobs[0]

    const candsRes = await request.get('/api/candidates?limit=20')
    expect(candsRes.ok()).toBeTruthy()
    const candsBody = await candsRes.json()
    const candidates = (candsBody.candidates ?? candsBody.resumes ?? []) as Array<{
      id: string
      candidate_name?: string
      candidate_email?: string
    }>
    expect(candidates.length, 'Need a demo candidate').toBeGreaterThan(0)
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
    const submitJson = await submit.json().catch(() => ({}))
    expect(
      submit.ok() || submit.status() === 409,
      JSON.stringify(submitJson),
    ).toBeTruthy()

    const three60 = await request.get(`/api/candidates/${cand.id}/360`)
    expect(three60.ok()).toBeTruthy()
    const payload = await three60.json()
    expect(String(payload.summary?.submission_status ?? '')).not.toMatch(/^None$/i)
    expect(Array.isArray(payload.submissions) && payload.submissions.length).toBeGreaterThan(0)

    const shares = await request.get(`/api/candidates/${cand.id}/jobs`)
    expect(shares.ok()).toBeTruthy()
    const shareBody = await shares.json()
    expect((shareBody.shares ?? shareBody.jobs ?? []).length).toBeGreaterThan(0)

    await page.goto(`/dashboard/candidates/${cand.id}`)
    await expect(page.getByRole('heading', { name: new RegExp(cand.candidate_name?.slice(0, 8) || 'Candidate', 'i') }).first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('submit-to-client-btn').click()
    await expect(page.getByTestId('candidate-allocate-panel')).toBeVisible()
    await expect(page.getByTestId('allocate-client-select')).toBeVisible()
    await expect(page.getByTestId('allocate-job-select')).toBeVisible()
    await page.getByRole('button', { name: /^Jobs Applied$/i }).click()
    await expect(page.getByText(/Client:/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
