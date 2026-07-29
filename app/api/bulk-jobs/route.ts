import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { buildJdFromJobRow } from '@/lib/jobScreeningContext'
import { assertFeatureEnabled, assertNotMaintenance } from '@/lib/featureFlags'

// Allow background bulk screening to run up to ~15 minutes for 20–100 CV batches.
export const maxDuration = 900

type ResumeIn = { text: string; filename?: string; id?: string }

async function processBulkJob(
  bulkJobId: string,
  tenantId: string,
  userId: string,
  userEmail: string,
  jdText: string,
  jobPostId: string | null,
  cookieHeader: string,
  baseUrl: string,
) {
  // Reclaim items stuck in `processing` (e.g. worker crash) back to `pending`.
  await pool.query(
    `UPDATE bulk_screening_items
     SET status = 'pending',
         candidate_id = NULL,
         result_json = NULL,
         error = NULL,
         updated_at = NOW()
     WHERE bulk_job_id = $1
       AND status = 'processing'
       AND updated_at < NOW() - interval '20 minutes'`,
    [bulkJobId],
  )

  const { rows: items } = await pool.query<{
    id: string
    resume_text: string
    file_name: string | null
    retry_count: number | null
  }>(
    `SELECT id, resume_text, file_name, retry_count
     FROM bulk_screening_items
     WHERE bulk_job_id = $1 AND status = 'pending'
     ORDER BY created_at`,
    [bulkJobId],
  )

  const concurrency = 5
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      const item = items[idx]
      if (!item?.resume_text?.trim()) {
        await pool.query(
          `UPDATE bulk_screening_items SET status = 'skipped', updated_at = NOW() WHERE id = $1`,
          [item.id],
        )
        await pool.query(
          `UPDATE bulk_screening_jobs SET skipped = skipped + 1, updated_at = NOW() WHERE id = $1`,
          [bulkJobId],
        )
        continue
      }
      const retryStart = item.retry_count ?? 0
      const maxRetries = 2
      const maxAttempts = 1 + Math.max(0, maxRetries - retryStart)

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          await pool.query(
            `UPDATE bulk_screening_items
             SET status = 'processing',
                 updated_at = NOW()${attempt > 0 ? ', retry_count = retry_count + 1' : ''}
             WHERE id = $1`,
            [item.id],
          )

          const res = await fetch(`${baseUrl}/api/screen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookieHeader,
            },
            body: JSON.stringify({
              jd_text: jdText,
              job_post_id: jobPostId || undefined,
              resumes: [{ text: item.resume_text, filename: item.file_name || 'resume.pdf' }],
            }),
          })
          if (!res.ok) {
            const errText = await res.text()
            throw new Error(errText.slice(0, 300) || `screen ${res.status}`)
          }
          const data = await res.json() as { results?: { db_id?: string }[] }
          const candId = data.results?.[0]?.db_id ?? null
          if (!candId) throw new Error('screen returned no db_id')

          await pool.query(
            `UPDATE bulk_screening_items
             SET status = 'done',
                 candidate_id = $1,
                 result_json = $2::jsonb,
                 updated_at = NOW()
             WHERE id = $3`,
            [candId, JSON.stringify(data.results?.[0] ?? {}), item.id],
          )
          await pool.query(
            `UPDATE bulk_screening_jobs SET completed = completed + 1, updated_at = NOW() WHERE id = $1`,
            [bulkJobId],
          )
          break
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'failed'
          const isFinal = attempt >= maxAttempts - 1
          if (isFinal) {
            await pool.query(
              `UPDATE bulk_screening_items
               SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
              [errMsg, item.id],
            )
            await pool.query(
              `UPDATE bulk_screening_jobs SET failed = failed + 1, updated_at = NOW() WHERE id = $1`,
              [bulkJobId],
            )
          } else {
            // Keep the item retryable without incrementing job-level counters yet.
            await pool.query(
              `UPDATE bulk_screening_items
               SET status = 'processing', error = $1, updated_at = NOW() WHERE id = $2`,
              [errMsg, item.id],
            )
          }
        }
      }
    }
  }

  await pool.query(
    `UPDATE bulk_screening_jobs SET status = 'running', updated_at = NOW() WHERE id = $1`,
    [bulkJobId],
  )
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()))
  const jobSummary = await pool.query<{ failed: string | number | null }>(
    `SELECT failed FROM bulk_screening_jobs WHERE id = $1`,
    [bulkJobId],
  )
  const failedCount = Number(jobSummary.rows[0]?.failed ?? 0) || 0
  await pool.query(
    `UPDATE bulk_screening_jobs
     SET status = 'completed',
         error_summary = CASE
           WHEN $2::int > 0 THEN CONCAT('Bulk screening finished with ', $2::int, ' failed item(s).')
           ELSE NULL
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [bulkJobId, failedCount],
  )
  void userId
  void userEmail
  void tenantId
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ai_screen.use')
  if (ctx instanceof NextResponse) return ctx

  const maintenance = await assertNotMaintenance(ctx.userEmail)
  if (maintenance) return maintenance
  const featureOff = await assertFeatureEnabled('bulk_upload', true)
  if (featureOff) return featureOff

  const body = await req.json() as {
    job_post_id?: string
    jd_text?: string
    resumes?: ResumeIn[]
  }

  const resumes = Array.isArray(body.resumes) ? body.resumes : []
  if (!resumes.length) {
    return NextResponse.json({ error: 'resumes required' }, { status: 400 })
  }
  if (resumes.length > 500) {
    return NextResponse.json({ error: 'Max 500 resumes per bulk job' }, { status: 400 })
  }

  let jdText = (body.jd_text || '').trim()
  let jobPostId = body.job_post_id && isValidUUID(body.job_post_id) ? body.job_post_id : null

  if (jobPostId) {
    const jp = await pool.query(
      `SELECT title, company, client_name, location, type, employment_type,
              experience_min, experience_max, description, requirements,
              optional_requirements, raw_jd_text, skills_mandatory, skills_required, tags, screening_questions
       FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [jobPostId, ctx.tenantId],
    )
    if (!jp.rows[0]) return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
    if (!jdText) jdText = buildJdFromJobRow(jp.rows[0])
  }

  if (!jdText) {
    return NextResponse.json({ error: 'Select a job or provide jd_text' }, { status: 400 })
  }

  const { rows: jobRows } = await pool.query<{ id: string }>(
    `INSERT INTO bulk_screening_jobs (tenant_id, job_post_id, created_by, status, total, eta_seconds)
     VALUES ($1,$2,$3,'queued',$4,$5) RETURNING id`,
    [
      ctx.tenantId,
      jobPostId,
      ctx.userId,
      resumes.length,
      Math.ceil(resumes.length / 5) * 45,
    ],
  )
  const bulkJobId = jobRows[0].id

  for (const r of resumes) {
    await pool.query(
      `INSERT INTO bulk_screening_items (bulk_job_id, tenant_id, file_name, resume_text, status)
       VALUES ($1,$2,$3,$4,'pending')`,
      [bulkJobId, ctx.tenantId, sanitizeText(r.filename, 255), (r.text || '').slice(0, 100000)],
    )
  }

  // Process in background — HTTP returns immediately (no gateway timeout)
  const cookieHeader = req.headers.get('cookie') || ''
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://127.0.0.1:3010'
  after(() =>
    processBulkJob(
      bulkJobId,
      ctx.tenantId,
      ctx.userId,
      ctx.userEmail,
      jdText,
      jobPostId,
      cookieHeader,
      baseUrl,
    ).catch(err => {
      console.error('[bulk-jobs]', err)
      void pool.query(
        `UPDATE bulk_screening_jobs SET status = 'failed', error_summary = $1, updated_at = NOW() WHERE id = $2`,
        [err instanceof Error ? err.message : 'failed', bulkJobId],
      )
    }),
  )

  return NextResponse.json({
    bulk_job_id: bulkJobId,
    status: 'queued',
    total: resumes.length,
    message: 'Bulk screening queued. Poll GET /api/bulk-jobs/{id} for progress.',
  }, { status: 202 })
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ai_screen.use')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !isValidUUID(id)) {
    const { rows } = await pool.query(
      `SELECT id, status, total, completed, failed, skipped, eta_seconds, job_post_id, created_at, updated_at
       FROM bulk_screening_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [ctx.tenantId],
    )
    return NextResponse.json({ jobs: rows })
  }

  const job = await pool.query(
    `SELECT * FROM bulk_screening_jobs WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId],
  )
  if (!job.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // GET polling path also reclaims stuck `processing` rows to recover from worker crashes.
  await pool.query(
    `UPDATE bulk_screening_items
     SET status = 'pending',
         candidate_id = NULL,
         result_json = NULL,
         error = NULL,
         updated_at = NOW()
     WHERE bulk_job_id = $1
       AND status = 'processing'
       AND updated_at < NOW() - interval '20 minutes'`,
    [id],
  )

  const items = await pool.query(
    `SELECT id, file_name, status, candidate_id, error, retry_count, updated_at
     FROM bulk_screening_items WHERE bulk_job_id = $1 ORDER BY created_at`,
    [id],
  )

  return NextResponse.json({ job: job.rows[0], items: items.rows })
}
