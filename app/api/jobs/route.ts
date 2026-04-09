import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createJobPost, getJobPosts } from '@/lib/db'
import { logActivity } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const userId = (session.user as Record<string, unknown>).userId as string
  const jobs = await getJobPosts(userId)
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

    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    console.error('[api/jobs] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
