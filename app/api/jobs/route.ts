import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createJobPost, getJobPosts } from '@/lib/db'
import { logActivity, pool } from '@/lib/db'
import { checkJobPostLimit } from '@/lib/limits'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as Record<string, unknown>).userId as string
  const jobs = await getJobPosts(userId)

  // Attach persisted social posts to each job (one query, no N+1)
  if (jobs.length > 0) {
    const jobIds = jobs.map(j => j.id)
    const { rows: contents } = await pool.query(
      `SELECT * FROM job_post_contents WHERE job_post_id = ANY($1::uuid[])`,
      [jobIds]
    )
    const contentMap = new Map(contents.map(c => [c.job_post_id, c]))
    return NextResponse.json({ jobs: jobs.map(j => ({ ...j, post_contents: contentMap.get(j.id) ?? null })) })
  }

  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const userId = (session.user as Record<string, unknown>).userId as string

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Check subscription plan limits
    const limit = await checkJobPostLimit(userId)
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.reason }, { status: 403 })
    }

    const job = await createJobPost({
      user_id: userId,
      title: body.title.trim(),
      company: body.company ?? null,
      location: body.location ?? null,
      type: body.type ?? 'full-time',
      description: body.description ?? null,
      requirements: body.requirements ?? null,
      salary_min: body.salary_min ?? null,
      salary_max: body.salary_max ?? null,
      currency: body.currency ?? 'USD',
      status: body.status ?? 'active',
      ai_generated: body.ai_generated ?? false,
      tags: body.tags ?? [],
    })

    if (!job) {
      return NextResponse.json({ error: 'Failed to create job post' }, { status: 500 })
    }

    await logActivity({
      user_id: userId,
      event_type: 'job_post_created',
      event_data: { job_id: job.id, title: job.title },
    })
    logAudit({ userId, userEmail: session.user.email!, action: 'job_created',
      resourceType: 'job', resourceId: job.short_id ?? job.id,
      details: { title: job.title } })

    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    console.error('[api/jobs] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
