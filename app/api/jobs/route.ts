import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { createJobPost, getJobPosts, logActivity, pool } from '@/lib/db'
import { checkJobPostLimit } from '@/lib/limits'
import { logAudit } from '@/lib/audit'
import { writeTimeline } from '@/lib/timelineEngine'
import { createNotification } from '@/lib/notificationCenter'
import { scheduleIndexJob } from '@/lib/rag/indexCorpus'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'jobs.read')
  if (ctx instanceof NextResponse) return ctx

  // Fetch jobs scoped to tenant
  const { rows: jobs } = await pool.query(
    `SELECT j.*, j.short_id FROM job_posts j
     WHERE j.tenant_id = $1 AND j.status != 'archived'
     ORDER BY j.created_at DESC`,
    [ctx.tenantId]
  )

  // Attach persisted social posts (no N+1)
  if (jobs.length > 0) {
    const jobIds = jobs.map((j: { id: string }) => j.id)
    const { rows: contents } = await pool.query(
      `SELECT * FROM job_post_contents WHERE job_post_id = ANY($1::uuid[])`,
      [jobIds]
    )
    const contentMap = new Map(contents.map(c => [c.job_post_id, c]))
    return NextResponse.json({ jobs: jobs.map((j: { id: string }) => ({ ...j, post_contents: contentMap.get(j.id) ?? null })) })
  }

  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'jobs.create')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Check subscription plan limits
    const limit = await checkJobPostLimit(ctx.userId)
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.reason }, { status: 403 })
    }

    const toInt = (v: unknown) => (v === '' || v === null || v === undefined) ? null : Number(v) || null
    const toArr = (v: unknown) =>
      Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean)
        : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []

    const job = await createJobPost({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      title: body.title.trim(),
      company: body.company?.trim() || null,
      location: body.location?.trim() || null,
      type: body.type ?? 'full-time',
      description: body.description?.trim() || null,
      requirements: body.requirements?.trim() || null,
      optional_requirements: typeof body.optional_requirements === 'string' ? body.optional_requirements.trim().slice(0, 8000) || null : null,
      salary_min: toInt(body.salary_min),
      salary_max: toInt(body.salary_max),
      currency: body.currency ?? 'MYR',
      status: body.status ?? 'active',
      ai_generated: body.ai_generated ?? false,
      tags: body.tags ?? toArr(body.skills_mandatory),
      department: body.department?.trim() || null,
      experience_min: toInt(body.experience_min),
      experience_max: toInt(body.experience_max),
      client_id: body.client_id || null,
      headcount: toInt(body.headcount) ?? 1,
      candidate_type: body.candidate_type || 'any',
      jd_received_date: body.jd_received_date || null,
      priority: body.priority || 'medium',
      target_cv_submissions: toInt(body.target_cv_submissions),
      internal_sla_days: toInt(body.internal_sla_days) ?? 10,
      target_submission_date: body.target_submission_date || null,
      share_jd_with_client: Boolean(body.share_jd_with_client),
      raw_jd_text: body.raw_jd_text || null,
      contract_duration: body.contract_duration || null,
      max_budget: toInt(body.max_budget),
      client_jr_no: body.client_jr_no || null,
      skills_mandatory: toArr(body.skills_mandatory),
      skills_required: toArr(body.skills_required),
      assigned_recruiter_ids: Array.isArray(body.assigned_recruiter_ids) ? body.assigned_recruiter_ids : [],
      assign_all_team: Boolean(body.assign_all_team),
      job_meta: typeof body.job_meta === 'object' && body.job_meta ? body.job_meta : {},
    })

    if (!job) {
      return NextResponse.json({
        error: 'Failed to create job post. Database schema may be missing required columns — contact support.',
      }, { status: 500 })
    }

    await logActivity({
      user_id: ctx.userId,
      event_type: 'job_post_created',
      event_data: { job_id: job.id, title: job.title },
    })
    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'job_created',
      resourceType: 'job',
      resourceId: job.short_id ?? job.id,
      details: { title: job.title },
      tenantId: ctx.tenantId,
    })
    await writeTimeline({
      tenantId: ctx.tenantId,
      entityType: 'job',
      entityId: job.id,
      eventType: 'job_created',
      title: 'Job Created',
      detail: job.title,
      actorUserId: ctx.userId,
      actorEmail: ctx.userEmail,
      meta: { short_id: job.short_id, company: job.company },
    })
    await createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      category: 'job',
      title: `Job created — ${job.title}`,
      body: job.short_id ? `${job.short_id}` : undefined,
      entityType: 'job',
      entityId: job.id,
    })

    scheduleIndexJob({
      tenantId: ctx.tenantId,
      jobId: String(job.id),
      jdText: body.raw_jd_text || body.description || null,
      userId: ctx.userId,
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    console.error('[api/jobs] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
