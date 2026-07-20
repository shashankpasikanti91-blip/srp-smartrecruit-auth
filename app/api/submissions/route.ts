import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { nextYearSeqId } from '@/lib/recruitmentOs'
import { upsertWorkflowInstance } from '@/lib/workflowEngine'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const stage = sanitizeText(searchParams.get('stage'), 50) ?? ''
  const client = sanitizeText(searchParams.get('client'), 200) ?? ''
  const resumeId = searchParams.get('resume_id') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset = (page - 1) * limit

  const conditions = ['s.tenant_id = $1']
  const params: unknown[] = [ctx.tenantId]
  let idx = 2
  if (stage) { conditions.push(`s.stage = $${idx}`); params.push(stage); idx++ }
  if (client) { conditions.push(`s.client_name ILIKE $${idx}`); params.push(`%${client}%`); idx++ }
  if (resumeId && isValidUUID(resumeId)) { conditions.push(`s.resume_id = $${idx}`); params.push(resumeId); idx++ }

  const where = conditions.join(' AND ')
  const { rows } = await pool.query(
    `SELECT s.*, r.candidate_name, r.candidate_email, r.short_id AS candidate_short_id,
            jp.title AS job_title, u.name AS recruiter_name
     FROM submissions s
     JOIN resumes r ON r.id = s.resume_id
     LEFT JOIN job_posts jp ON jp.id = s.job_post_id
     LEFT JOIN auth_users u ON u.id = s.user_id
     WHERE ${where}
     ORDER BY s.updated_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  )

  const count = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM submissions s WHERE ${where}`,
    params
  )

  return NextResponse.json({
    submissions: rows,
    total: parseInt(count.rows[0]?.total ?? '0', 10),
    page,
    limit,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const resume_id = body.resume_id as string
    if (!isValidUUID(resume_id)) return NextResponse.json({ error: 'Invalid resume_id' }, { status: 400 })

    const own = await pool.query(
      'SELECT id, short_id FROM resumes WHERE id = $1 AND tenant_id = $2',
      [resume_id, ctx.tenantId]
    )
    if (!own.rows[0]) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

    let job_post_id = body.job_post_id || null
    if (job_post_id && !isValidUUID(job_post_id)) {
      return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
    }

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
        sanitizeText(body.stage, 50) ?? 'draft',
        sanitizeText(body.lifecycle_status, 60),
        body.submission_date || null,
        sanitizeText(body.notes, 5000),
        JSON.stringify(body.feedback ?? {}),
      ]
    )

    logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail,
      action: 'submission_updated', resourceType: 'candidate',
      resourceId: own.rows[0].short_id,
      details: { submission_id: rows[0].id, stage: rows[0].stage },
      tenantId: ctx.tenantId,
    })

    let slaDays = 3
    if (job_post_id) {
      try {
        const job = await pool.query<{ internal_sla_days: number | null }>(
          'SELECT internal_sla_days FROM job_posts WHERE id = $1 AND tenant_id = $2',
          [job_post_id, ctx.tenantId]
        )
        if (job.rows[0]?.internal_sla_days != null) {
          slaDays = Number(job.rows[0].internal_sla_days) || 3
        }
      } catch { /* ignore */ }
    }
    const slaDueAt = new Date(Date.now() + slaDays * 86400000)
    await upsertWorkflowInstance({
      tenantId: ctx.tenantId,
      entityType: 'submission',
      entityId: rows[0].id,
      stage: rows[0].stage ?? 'draft',
      resumeId: resume_id,
      jobPostId: job_post_id,
      slaDueAt,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      detail: `SLA ${slaDays}d from submission`,
    })

    return NextResponse.json({ submission: rows[0] }, { status: 201 })
  } catch (e) {
    console.error('[submissions POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
