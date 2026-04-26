import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { createJobPost, getJobPosts, logActivity, pool } from '@/lib/db'
import { checkJobPostLimit } from '@/lib/limits'
import { logAudit } from '@/lib/audit'

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

    const job = await createJobPost({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      title: body.title.trim(),
      company: body.company?.trim() || null,
      location: body.location?.trim() || null,
      type: body.type ?? 'full-time',
      description: body.description?.trim() || null,
      requirements: body.requirements?.trim() || null,
      salary_min: toInt(body.salary_min),
      salary_max: toInt(body.salary_max),
      currency: body.currency ?? 'USD',
      status: body.status ?? 'active',
      ai_generated: body.ai_generated ?? false,
      tags: body.tags ?? [],
    })

    if (!job) {
      return NextResponse.json({ error: 'Failed to create job post' }, { status: 500 })
    }

    await logActivity({
      user_id: ctx.userId,
      event_type: 'job_post_created',
      event_data: { job_id: job.id, title: job.title },
    })
    logAudit({ userId: ctx.userId, userEmail: ctx.userEmail, action: 'job_created',
      resourceType: 'job', resourceId: job.short_id ?? job.id,
      details: { title: job.title }, tenantId: ctx.tenantId })

    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    console.error('[api/jobs] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
