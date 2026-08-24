import { test, expect, type APIRequestContext } from '@playwright/test'
import { gotoDashboard, openTab } from '../helpers/dashboard'
import { skipIfUnauthed } from '../helpers/login'

const CRASH = /Unexpected token|is not valid JSON|Something went wrong|Internal Server Error|Application error/i

const SAMPLE_JD = `Job Title: Full Stack Developer
Must have: JavaScript, React, Node.js, REST APIs.
Nice to have: PostgreSQL, TypeScript.
Location: Remote. 3+ years experience.`

const SAMPLE_RESUME = `Priya Kumar
Email: priya.kumar.e2e@example.com
Phone: +65 8123 4567
Senior Full Stack Developer at Acme Corp (2021–present)
Built React and Node.js APIs, PostgreSQL, TypeScript.
Skills: JavaScript, React, Node.js, PostgreSQL, TypeScript`

async function ensureDemoJob(request: APIRequestContext) {
  const jobsRes = await request.get('/api/jobs')
  expect(jobsRes.ok()).toBeTruthy()
  const jobsBody = await jobsRes.json()
  const existing = (jobsBody.jobs as Array<{ id: string; title?: string }>)?.[0]
  if (existing?.id) return existing
  const create = await request.post('/api/jobs', {
    data: {
      title: 'E2E Full Stack Developer',
      company: 'Demo Co',
      location: 'Remote',
      type: 'full-time',
      description: SAMPLE_JD,
      requirements: 'JavaScript, React, Node.js',
      raw_jd_text: SAMPLE_JD,
      status: 'active',
    },
  })
  const created = await create.json().catch(() => ({}))
  expect(create.ok(), JSON.stringify(created)).toBeTruthy()
  return created.job as { id: string; title?: string }
}

test.describe('Demo AI + mapping flows', () => {
  test.beforeEach(async ({ page }) => {
    await skipIfUnauthed(page)
  })

  test('Boolean Search generates LinkedIn/Naukri/Indeed strings', async ({ page }) => {
    test.setTimeout(120_000)
    await gotoDashboard(page)
    await openTab(page, 'Boolean Search')
    await expect(page.getByRole('heading', { name: /Boolean Search/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(CRASH)).toHaveCount(0)

    const title = page.getByPlaceholder(/Full Stack Developer/i)
    await title.click()
    await title.fill('')
    await title.pressSequentially('Full Stack Developer', { delay: 10 })
    const skills = page.getByPlaceholder(/React, Node/i)
    if (await skills.isVisible().catch(() => false)) {
      await skills.fill('React, Node.js, TypeScript')
    }
    await page.getByRole('button', { name: /Generate Boolean Strings/i }).click()
    await expect(page.getByText(/Generated Boolean Strings|Last Generated|Freshly generated/i).first()).toBeVisible({
      timeout: 90_000,
    })
    await expect(page.getByText(/LinkedIn Search/i).first()).toBeVisible()
    await expect(page.getByText(/Naukri Search/i).first()).toBeVisible()
    await expect(page.locator('code').first()).not.toBeEmpty()
    await expect(page.getByText(CRASH)).toHaveCount(0)
  })

  test('Job 360 Generate Posts shows channel posts without crash', async ({ page, request }) => {
    test.setTimeout(180_000)
    const job = await ensureDemoJob(request)

    const gen = await request.post('/api/jobs/generate-posts', {
      timeout: 120_000,
      data: {
        job_post_id: job.id,
        platforms: ['linkedin', 'whatsapp', 'email', 'indeed'],
      },
    })
    const genBody = await gen.json().catch(() => ({}))
    expect(gen.ok(), JSON.stringify(genBody).slice(0, 400)).toBeTruthy()
    expect(genBody.posts && Object.keys(genBody.posts).length).toBeGreaterThan(0)

    await page.goto(`/dashboard/jobs/${job.id}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.getByRole('heading', { name: /.+/ }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(CRASH)).toHaveCount(0)

    await page.getByRole('button', { name: /Generate Posts/i }).first().click()
    await expect(page.getByText(/Channel posts|LinkedIn|WhatsApp|Email|Indeed/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Generate failed|AI returned empty posts|Network error while generating/i)).toHaveCount(0)
    await expect(page.getByText(CRASH)).toHaveCount(0)
  })

  test('Job 360 action cards open screening, boolean, and pipeline mapping', async ({ page, request }) => {
    test.setTimeout(90_000)
    const job = await ensureDemoJob(request)

    await page.goto(`/dashboard/jobs/${job.id}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.getByRole('button', { name: /Generate Job Post/i }).first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /Candidate Pipeline/i }).click()
    await expect(page.getByText(/Pipeline|stage|Submitted|Screening|Interview/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(CRASH)).toHaveCount(0)

    await page.getByRole('button', { name: /Strings from this JD/i }).click()
    await expect(page.getByRole('heading', { name: /Boolean Search/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(CRASH)).toHaveCount(0)

    await page.goto(`/dashboard/jobs/${job.id}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.getByRole('button', { name: /Screen CVs with this JD/i }).click()
    await expect(page.getByRole('heading', { name: /AI Screening/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Run AI Screening/i })).toBeVisible()
    await expect(page.getByText(CRASH)).toHaveCount(0)
  })

  test('Single AI screening returns a scored card', async ({ page }) => {
    test.setTimeout(180_000)
    await gotoDashboard(page)
    await openTab(page, 'AI Screening')
    await expect(page.getByRole('heading', { name: /AI Screening/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Single CV/i }).click()

    const jd = page.getByPlaceholder(/Paste the full job description/i)
    await jd.fill(SAMPLE_JD)
    const resume = page.getByPlaceholder(/Paste the candidate's resume/i)
    await resume.fill(SAMPLE_RESUME)

    await page.getByRole('button', { name: /Run AI Screening/i }).click()
    await expect(page.getByText('AI Screening in progress')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('AI Screening in progress')).toHaveCount(0, { timeout: 150_000 })
    await expect(page.getByRole('button', { name: /Save Candidate|Collapse|View Details/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/preview \(Save to keep\)|saved to Candidates/i).first()).toBeVisible()
    await expect(page.getByText(/Unexpected token|is not valid JSON|invalid response from the server/i)).toHaveCount(0)
    await expect(page.getByText(CRASH)).toHaveCount(0)
  })

  test('Bulk CVs mode stays stable and screens two resumes via API', async ({ page, request }) => {
    test.setTimeout(180_000)
    await gotoDashboard(page)
    await openTab(page, 'AI Screening')
    await page.getByRole('button', { name: /Bulk CVs/i }).click()
    await expect(page.getByText(/Upload multiple CVs/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(CRASH)).toHaveCount(0)

    let screenRes
    let raw = ''
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        screenRes = await request.post('/api/screen', {
          timeout: 180_000,
          data: {
            jd_text: SAMPLE_JD,
            persist: false,
            resumes: [
              { text: SAMPLE_RESUME, filename: 'priya.txt' },
              {
                text: 'Alex Tan\nEmail: alex.tan.e2e@example.com\nJunior developer. HTML, CSS.\n',
                filename: 'alex.txt',
              },
            ],
          },
        })
        raw = await screenRes.text()
        break
      } catch (err) {
        if (attempt === 2) throw err
      }
    }
    expect(screenRes!.ok(), raw.slice(0, 500)).toBeTruthy()
    const body = JSON.parse(raw)
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results.length).toBeGreaterThanOrEqual(1)
    const first = body.results[0]
    expect(first).toHaveProperty('score')
    expect(first.error).toBeFalsy()
  })

  test('Candidate 360 mapping tabs open without crash', async ({ page, request }) => {
    test.setTimeout(60_000)
    const candRes = await request.get('/api/candidates?limit=1')
    expect(candRes.ok()).toBeTruthy()
    const candBody = await candRes.json()
    let cand = (candBody.candidates as Array<{ id: string }>)?.[0]
    if (!cand?.id) {
      const create = await request.post('/api/candidates', {
        data: {
          candidate_name: 'E2E Mapping Candidate',
          candidate_email: 'e2e.mapping@example.com',
          raw_text: SAMPLE_RESUME,
        },
      })
      const created = await create.json().catch(() => ({}))
      test.skip(!create.ok(), `Could not create candidate: ${JSON.stringify(created)}`)
      cand = created.candidate
    }
    test.skip(!cand?.id, 'No candidates in demo workspace')

    await page.goto(`/dashboard/candidates/${cand.id}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page).toHaveURL(/\/dashboard\/candidates\//)
    await expect(page.getByText(CRASH)).toHaveCount(0)

    for (const name of [/Overview/i, /Timeline/i, /Notes/i, /Documents/i]) {
      const btn = page.getByRole('button', { name }).or(page.getByRole('tab', { name }))
      if (await btn.first().isVisible().catch(() => false)) {
        await btn.first().click()
        await expect(page.getByText(CRASH)).toHaveCount(0)
      }
    }
  })
})
