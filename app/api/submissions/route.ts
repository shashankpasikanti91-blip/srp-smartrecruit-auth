import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { nextYearSeqId } from '@/lib/recruitmentOs'
import { upsertWorkflowInstance } from '@/lib/workflowEngine'
import { resolveDateFilter, resolveMineScope, stagesForFeedbackBucket, parseSubmissionFeedback } from '@/lib/opsList'
import { advanceFromDomain, submissionStageToLifecycle } from '@/lib/lifecycle'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const stage = sanitizeText(searchParams.get('stage'), 50) ?? ''
  const feedbackBucket = sanitizeText(searchParams.get('feedback'), 40) ?? ''
  const client = sanitizeText(searchParams.get('client'), 200) ?? ''
  const q = sanitizeText(searchParams.get('q'), 200) ?? ''
  const resumeId = searchParams.get('resume_id') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset = (page - 1) * limit
  const dateRange = resolveDateFilter(searchParams)
  const { mine, canToggle } = resolveMineScope(ctx, searchParams.get('mine'))

  const conditions = ['s.tenant_id = $1']
  const params: unknown[] = [ctx.tenantId]
  let idx = 2

  if (stage) {
    conditions.push(`s.stage = $${idx}`)
    params.push(stage)
    idx++
  } else {
    const stages = stagesForFeedbackBucket(feedbackBucket)
    if (stages?.length) {
      conditions.push(`s.stage = ANY($${idx}::text[])`)
      params.push(stages)
      idx++
    }
  }
  if (client) {
    conditions.push(`s.client_name ILIKE $${idx}`)
    params.push(`%${client}%`)
    idx++
  }
  if (q) {
    conditions.push(`(
      r.candidate_name ILIKE $${idx} OR r.candidate_email ILIKE $${idx}
      OR r.short_id ILIKE $${idx} OR s.short_id ILIKE $${idx}
      OR s.client_name ILIKE $${idx} OR COALESCE(s.applying_for,'') ILIKE $${idx}
    )`)
    params.push(`%${q}%`)
    idx++
  }
  if (resumeId && isValidUUID(resumeId)) {
    conditions.push(`s.resume_id = $${idx}`)
    params.push(resumeId)
    idx++
  }
  if (mine && !(resumeId && isValidUUID(resumeId))) {
    conditions.push(`s.user_id = $${idx}`)
    params.push(ctx.userId)
    idx++
  }
  if (dateRange) {
    conditions.push(`COALESCE(s.submission_date, s.updated_at)::date >= $${idx}::date`)
    params.push(dateRange.from)
    idx++
    conditions.push(`COALESCE(s.submission_date, s.updated_at)::date <= $${idx}::date`)
    params.push(dateRange.to)
    idx++
  }

  const where = conditions.join(' AND ')
  try {
  let rows: Record<string, unknown>[]
  try {
    const listed = await pool.query(
      `SELECT s.*, r.candidate_name, r.candidate_email, r.candidate_phone, r.short_id AS candidate_short_id,
              jp.title AS job_title,
              COALESCE(jp.company, s.client_name) AS client_project,
              u.name AS recruiter_name
       FROM submissions s
       JOIN resumes r ON r.id = s.resume_id
       LEFT JOIN job_posts jp ON jp.id = s.job_post_id
       LEFT JOIN auth_users u ON u.id = s.user_id
       WHERE ${where}
       ORDER BY s.updated_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    )
    rows = listed.rows
  } catch {
    const listed = await pool.query(
      `SELECT s.*, r.candidate_name, r.candidate_email, r.candidate_phone, r.short_id AS candidate_short_id,
              jp.title AS job_title,
              COALESCE(jp.company, s.client_name) AS client_project,
              NULL AS recruiter_name
       FROM submissions s
       JOIN resumes r ON r.id = s.resume_id
       LEFT JOIN job_posts jp ON jp.id = s.job_post_id
       WHERE ${where}
       ORDER BY s.updated_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    )
    rows = listed.rows
  }

  const submissions = rows.map((r: Record<string, unknown>) => {
    const fb = parseSubmissionFeedback(r.feedback)
    const decisionStages = ['rejected', 'rejected_by_candidate', 'selected', 'shortlisted', 'offer_declined', 'joined', 'waiting_feedback']
    const stage = String(r.stage ?? '')
    return {
      ...r,
      client_project: r.client_project || r.client_name,
      feedback_detail: fb.detail,
      feedback_recorded_by: fb.recorded_by,
      feedback_date: fb.feedback_date
        || (decisionStages.includes(stage) && r.updated_at ? r.updated_at : null),
    }
  })

  const count = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM submissions s JOIN resumes r ON r.id = s.resume_id WHERE ${where}`,
    params,
  )

  // Counts by feedback bucket (same mine/date/client/q filters, ignore stage/feedback bucket)
  const countConditions = ['s.tenant_id = $1']
  const countParams: unknown[] = [ctx.tenantId]
  let cIdx = 2
  if (client) {
    countConditions.push(`s.client_name ILIKE $${cIdx}`)
    countParams.push(`%${client}%`)
    cIdx++
  }
  if (q) {
    countConditions.push(`(
      r.candidate_name ILIKE $${cIdx} OR r.candidate_email ILIKE $${cIdx}
      OR r.short_id ILIKE $${cIdx} OR s.short_id ILIKE $${cIdx}
      OR s.client_name ILIKE $${cIdx} OR COALESCE(s.applying_for,'') ILIKE $${cIdx}
    )`)
    countParams.push(`%${q}%`)
    cIdx++
  }
  if (mine) {
    countConditions.push(`s.user_id = $${cIdx}`)
    countParams.push(ctx.userId)
    cIdx++
  }
  if (dateRange) {
    countConditions.push(`COALESCE(s.submission_date, s.updated_at)::date >= $${cIdx}::date`)
    countParams.push(dateRange.from)
    cIdx++
    countConditions.push(`COALESCE(s.submission_date, s.updated_at)::date <= $${cIdx}::date`)
    countParams.push(dateRange.to)
    cIdx++
  }
  const countWhere = countConditions.join(' AND ')
  const summaryRes = await pool.query<{ stage: string; c: string }>(
    `SELECT s.stage, COUNT(*)::text AS c
     FROM submissions s
     JOIN resumes r ON r.id = s.resume_id
     WHERE ${countWhere}
     GROUP BY s.stage`,
    countParams,
  )
  const byStage: Record<string, number> = {}
  let allCount = 0
  for (const row of summaryRes.rows) {
    const n = parseInt(row.c, 10)
    byStage[row.stage] = n
    allCount += n
  }
  const bucketCount = (key: string) =>
    (stagesForFeedbackBucket(key) ?? []).reduce((sum, st) => sum + (byStage[st] ?? 0), 0)

  return NextResponse.json({
    submissions,
    total: parseInt(count.rows[0]?.total ?? '0', 10),
    page,
    limit,
    mine,
    can_toggle_mine: canToggle,
    summary: {
      all: allCount,
      awaiting: bucketCount('awaiting'),
      positive: bucketCount('positive'),
      kiv: bucketCount('kiv'),
      rejected: bucketCount('rejected'),
      by_stage: byStage,
    },
  })
  } catch (e) {
    console.error('[submissions GET]', e)
    return NextResponse.json({
      submissions: [],
      total: 0,
      page,
      limit,
      mine,
      can_toggle_mine: canToggle,
      summary: { all: 0, awaiting: 0, positive: 0, kiv: 0, rejected: 0, by_stage: {} },
    })
  }
}

function pgCode(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : ''
}

function pgConstraint(err: unknown): string {
  return err && typeof err === 'object' && 'constraint' in err
    ? String((err as { constraint: string }).constraint)
    : ''
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  const canShare =
    ctx.permissions.candidates.create
    || ctx.permissions.candidates.update
    || ctx.permissions.pipeline.update
  if (!canShare) {
    return NextResponse.json(
      { error: 'Forbidden: you cannot submit candidates in this workspace' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json()
    const resume_id = body.resume_id as string
    if (!isValidUUID(resume_id)) return NextResponse.json({ error: 'Invalid resume_id' }, { status: 400 })

    const own = await pool.query(
      'SELECT id, short_id FROM resumes WHERE id = $1 AND tenant_id = $2',
      [resume_id, ctx.tenantId],
    )
    if (!own.rows[0]) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

    let job_post_id = body.job_post_id || null
    if (job_post_id && !isValidUUID(job_post_id)) {
      return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
    }

    // One open submission per (tenant, candidate, job) unless force_resubmit
    const stageIn = sanitizeText(body.stage, 50) ?? 'draft'
    if (job_post_id && stageIn !== 'draft' && !body.force_resubmit) {
      const dup = await pool.query(
        `SELECT id, short_id, stage FROM submissions
         WHERE tenant_id = $1 AND resume_id = $2 AND job_post_id = $3
           AND stage NOT IN ('rejected','rejected_by_candidate','submission_withdrawn','position_closed','duplicate','joined')
         LIMIT 1`,
        [ctx.tenantId, resume_id, job_post_id],
      )
      if (dup.rows[0]) {
        return NextResponse.json({
          error: 'Open submission already exists for this candidate and job',
          existing_submission_id: dup.rows[0].id,
          existing_short_id: dup.rows[0].short_id,
          existing_stage: dup.rows[0].stage,
        }, { status: 409 })
      }
    }

    let inserted: Record<string, unknown> | null = null
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO submissions
             (tenant_id, resume_id, job_post_id, user_id, short_id, client_name, applying_for,
              hire_type, stage, lifecycle_status, submission_date, notes, feedback)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING *`,
          [
            ctx.tenantId, resume_id, job_post_id, ctx.userId,
            await nextYearSeqId(pool, { tenantId: ctx.tenantId, table: 'submissions', prefix: 'SUB' }),
            sanitizeText(body.client_name, 200),
            sanitizeText(body.applying_for, 200),
            sanitizeText(body.hire_type, 40),
            stageIn,
            sanitizeText(body.lifecycle_status, 60),
            body.submission_date || null,
            sanitizeText(body.notes, 5000),
            JSON.stringify(body.feedback ?? {}),
          ],
        )
        inserted = rows[0] as Record<string, unknown>
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        if (pgCode(e) === '42703') {
          const { rows } = await pool.query(
            `INSERT INTO submissions
               (tenant_id, resume_id, job_post_id, user_id, short_id, client_name, stage, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [
              ctx.tenantId, resume_id, job_post_id, ctx.userId,
              await nextYearSeqId(pool, { tenantId: ctx.tenantId, table: 'submissions', prefix: 'SUB' }),
              sanitizeText(body.client_name, 200),
              stageIn,
              sanitizeText(body.notes, 5000),
            ],
          )
          inserted = rows[0] as Record<string, unknown>
          lastErr = null
          break
        }
        if (pgCode(e) === '23505' && attempt < 3) {
          const c = pgConstraint(e).toLowerCase()
          if (!c || c.includes('short_id')) continue
        }
        throw e
      }
    }
    if (!inserted) throw lastErr ?? new Error('Insert failed')

    logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail,
      action: 'submission_updated', resourceType: 'candidate',
      resourceId: own.rows[0].short_id,
      details: { submission_id: inserted.id, stage: inserted.stage },
      tenantId: ctx.tenantId,
      resumeId: resume_id,
    })

    try {
      const lifeStage = submissionStageToLifecycle(String(inserted.stage ?? ''))
      await advanceFromDomain({
        tenantId: ctx.tenantId,
        resumeId: resume_id,
        toStage: lifeStage,
        jobPostId: job_post_id,
        relatedEntityType: 'submission',
        relatedEntityId: String(inserted.id),
        actorUserId: ctx.userId,
        actorEmail: ctx.userEmail,
        reason: `submission_created:${inserted.stage}`,
        force: true,
      })
    } catch (e) {
      console.error('[submissions POST] lifecycle (share still saved)', e)
    }

    try {
      let slaDays = 3
      if (job_post_id) {
        const job = await pool.query<{ internal_sla_days: number | null }>(
          'SELECT internal_sla_days FROM job_posts WHERE id = $1 AND tenant_id = $2',
          [job_post_id, ctx.tenantId],
        )
        if (job.rows[0]?.internal_sla_days != null) {
          slaDays = Number(job.rows[0].internal_sla_days) || 3
        }
      }
      const slaDueAt = new Date(Date.now() + slaDays * 86400000)
      await upsertWorkflowInstance({
        tenantId: ctx.tenantId,
        entityType: 'submission',
        entityId: String(inserted.id),
        stage: String(inserted.stage ?? 'draft'),
        resumeId: resume_id,
        jobPostId: job_post_id,
        slaDueAt,
        actorUserId: ctx.userId,
        actorEmail: ctx.userEmail,
        detail: `SLA ${slaDays}d from submission`,
      })
    } catch (e) {
      console.error('[submissions POST] workflow (share still saved)', e)
    }

    return NextResponse.json({ submission: inserted }, { status: 201 })
  } catch (e) {
    const code = pgCode(e)
    console.error('[submissions POST]', e)
    if (code === '23505') {
      const constraint = pgConstraint(e).toLowerCase()
      if (constraint.includes('short_id')) {
        return NextResponse.json({ error: 'Could not save submission. Try again.' }, { status: 500 })
      }
      return NextResponse.json({
        error: 'Open submission already exists for this candidate and job',
      }, { status: 409 })
    }
    if (code === '23503') {
      return NextResponse.json({ error: 'Job or candidate is not valid in this workspace' }, { status: 400 })
    }
    if (code === '23514') {
      return NextResponse.json({ error: 'This stage is not allowed until database migrations are applied' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not save submission. Try again.' }, { status: 500 })
  }
}
