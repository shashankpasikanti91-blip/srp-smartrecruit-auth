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
    expect(submit.status(), JSON.stringify(submitJson)).not.toBe(500)

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

  test('360 Interviews and Offers tabs do not show share-to-client form', async ({ page, request }) => {
    test.setTimeout(90_000)
    const candsRes = await request.get('/api/candidates?limit=5')
    expect(candsRes.ok()).toBeTruthy()
    const candsBody = await candsRes.json()
    const candidates = (candsBody.candidates ?? candsBody.resumes ?? []) as Array<{
      id: string
      candidate_name?: string
    }>
    test.skip(!candidates.length, 'Need a demo candidate')
    const cand = candidates[0]

    await page.goto(`/dashboard/candidates/${cand.id}`)
    await expect(page.getByRole('heading', { name: new RegExp(cand.candidate_name?.slice(0, 8) || 'Candidate', 'i') }).first()).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('c360-tab-interviews').click()
    await expect(page.getByTestId('candidate-allocate-panel')).toBeVisible()
    await expect(page.getByTestId('allocate-client-select')).toHaveCount(0)
    await expect(page.getByText(/^Share this profile$/i)).toHaveCount(0)

    await page.getByTestId('c360-tab-offers').click()
    await expect(page.getByTestId('candidate-allocate-panel')).toBeVisible()
    await expect(page.getByTestId('allocate-client-select')).toHaveCount(0)
    await expect(page.getByText(/^Share this profile$/i)).toHaveCount(0)

    await page.getByTestId('c360-tab-documents').click()
    await expect(page.getByText(/^Server error$/i)).toHaveCount(0)
    await page.getByTestId('c360-tab-attachments').click()
    await expect(page.getByText(/^Server error$/i)).toHaveCount(0)
  })

  test('shortlist creates interview; reject then re-submit another job', async ({ request }) => {
    test.setTimeout(90_000)
    const jobsRes = await request.get('/api/jobs')
    expect(jobsRes.ok()).toBeTruthy()
    const jobs = (await jobsRes.json()).jobs as Array<{ id: string; title?: string; company?: string | null }>
    test.skip(!jobs?.length, 'Need a job')
    const candsRes = await request.get('/api/candidates?limit=10')
    expect(candsRes.ok()).toBeTruthy()
    const candsBody = await candsRes.json()
    const candidates = (candsBody.candidates ?? candsBody.resumes ?? []) as Array<{ id: string }>
    test.skip(!candidates.length, 'Need a candidate')
    const cand = candidates[0]
    const jobA = jobs[0]

    const submitA = await request.post('/api/submissions', {
      data: {
        resume_id: cand.id,
        job_post_id: jobA.id,
        client_name: jobA.company || 'Demo Client',
        applying_for: jobA.title || 'Role',
        stage: 'submitted',
        submission_date: new Date().toISOString().slice(0, 10),
      },
    })
    expect(submitA.status()).not.toBe(500)
    const bodyA = await submitA.json().catch(() => ({}))
    const subId = bodyA.submission?.id
      || bodyA.existing_submission_id
      || (await request.get(`/api/submissions?resume_id=${cand.id}&limit=5`).then(r => r.json())).submissions?.[0]?.id
    test.skip(!subId, 'Need a submission id')

    const short = await request.patch(`/api/submissions/${subId}`, { data: { stage: 'shortlisted' } })
    expect(short.status(), await short.text()).toBeLessThan(500)
    expect(short.ok()).toBeTruthy()

    const ivs = await request.get(`/api/interviews?resume_id=${cand.id}`)
    expect(ivs.ok()).toBeTruthy()
    const ivBody = await ivs.json()
    expect((ivBody.interviews ?? []).length, JSON.stringify(ivBody)).toBeGreaterThan(0)

    const reject = await request.patch(`/api/submissions/${subId}`, { data: { stage: 'rejected' } })
    expect(reject.ok()).toBeTruthy()

    const stillThere = await request.get(`/api/candidates/${cand.id}`)
    expect(stillThere.ok()).toBeTruthy()

    const jobB = jobs.find(j => j.id !== jobA.id)
    if (jobB) {
      const submitB = await request.post('/api/submissions', {
        data: {
          resume_id: cand.id,
          job_post_id: jobB.id,
          client_name: jobB.company || 'Other Client',
          applying_for: jobB.title || 'Other role',
          stage: 'submitted',
          submission_date: new Date().toISOString().slice(0, 10),
        },
      })
      expect(submitB.status(), await submitB.text()).not.toBe(500)
      expect(submitB.ok() || submitB.status() === 409).toBeTruthy()
    }
  })

  test('interview selected opens an offer case', async ({ request }) => {
    test.setTimeout(90_000)
    const candsRes = await request.get('/api/candidates?limit=10')
    expect(candsRes.ok()).toBeTruthy()
    const candidates = ((await candsRes.json()).candidates ?? []) as Array<{ id: string; candidate_name?: string; candidate_email?: string }>
    test.skip(!candidates.length, 'Need a candidate')
    const cand = candidates[0]
    const ivList = await request.get(`/api/interviews?resume_id=${cand.id}`)
    const interviews = ((await ivList.json()).interviews ?? []) as Array<{ id: string; status: string }>
    let iv = interviews.find(i => !['cancelled', 'rejected', 'no_show'].includes(i.status))
    if (!iv) {
      const created = await request.post('/api/interviews', {
        data: {
          resume_id: cand.id,
          candidate_name: cand.candidate_name || 'Candidate',
          candidate_email: cand.candidate_email || undefined,
        },
      })
      const createdBody = await created.json().catch(() => ({}))
      expect(created.status(), JSON.stringify(createdBody)).not.toBe(500)
      iv = createdBody.interview
    }
    const interviewId = iv?.id
    test.skip(!interviewId, 'Need an interview row')
    if (!interviewId) return
    const sel = await request.patch(`/api/interviews/${interviewId}`, { data: { status: 'selected' } })
    expect(sel.status()).toBeLessThan(500)
    expect(sel.ok()).toBeTruthy()
    const offers = await request.get(`/api/offers?resume_id=${cand.id}`)
    expect(offers.ok()).toBeTruthy()
    expect(((await offers.json()).offers ?? []).length).toBeGreaterThan(0)
  })
})
