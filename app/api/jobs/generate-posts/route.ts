import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { upsertJobPostContents } from '@/lib/db'
import { chatCompletion, getAIConfig } from '@/lib/aiClient'
import {
  buildJobPostSystemPrompt,
  normalizePlatforms,
  type JobPostPlatform,
} from '@/lib/jobPostPlatforms'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const canJobs = checkPermission(ctx.permissions, 'jobs.update')
  const canJd = checkPermission(ctx.permissions, 'jd_intel.use')
  if (!canJobs && !canJd) {
    return NextResponse.json(
      { error: "Forbidden: you lack 'jobs.update' or 'jd_intel.use' permission in this workspace" },
      { status: 403 }
    )
  }

  const userId = ctx.userId

  try {
    const body = await req.json() as {
      job_post_id?: string
      title: string
      company?: string
      location?: string
      type?: string
      description?: string
      requirements?: string
      custom_prompt?: string
      platforms?: string[]
    }
    if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const platforms = normalizePlatforms(body.platforms)

    if (!getAIConfig()) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const jobContext = [
      `Job Title: ${body.title}`,
      body.company && `Company: ${body.company}`,
      body.location && `Location: ${body.location}`,
      body.type && `Employment Type: ${body.type}`,
      body.description && `Description: ${body.description}`,
      body.requirements && `Requirements: ${body.requirements}`,
      body.custom_prompt && `Special Instructions: ${body.custom_prompt}`,
      `Selected platforms: ${platforms.join(', ')}`,
    ].filter(Boolean).join('\n')

    const systemPrompt = buildJobPostSystemPrompt(platforms)

    const raw = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate job posts for:\n${jobContext}` },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })
    const parsed = JSON.parse(raw) as Record<string, string>

    const posts: Partial<Record<JobPostPlatform, string>> = {}
    for (const p of platforms) {
      const text = typeof parsed[p] === 'string' ? parsed[p].trim() : ''
      if (text) posts[p] = text
    }

    if (body.job_post_id && canJobs) {
      await upsertJobPostContents({ job_post_id: body.job_post_id, user_id: userId, posts })
    }

    return NextResponse.json({ posts, platforms })
  } catch (err) {
    console.error('[api/jobs/generate-posts]', err)
    return NextResponse.json({ error: 'Could not generate job posts. Please try again.' }, { status: 500 })
  }
}
