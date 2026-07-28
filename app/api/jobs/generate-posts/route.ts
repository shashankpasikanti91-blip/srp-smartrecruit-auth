import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { upsertJobPostContents, pool } from '@/lib/db'
import { chatCompletion, getAIConfig } from '@/lib/aiClient'
import { isValidUUID } from '@/lib/validate'
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
      title?: string
      company?: string
      location?: string
      type?: string
      description?: string
      requirements?: string
      raw_jd_text?: string
      custom_prompt?: string
      platforms?: string[]
    }

    let title = body.title?.trim() || ''
    let company = body.company
    let location = body.location
    let type = body.type
    let description = body.description
    let requirements = body.requirements
    let rawJd = body.raw_jd_text

    // Always load full job row when id provided — never lose raw_jd_text
    if (body.job_post_id && isValidUUID(body.job_post_id)) {
      const { rows } = await pool.query(
        `SELECT title, company, location, type, description, requirements, raw_jd_text
         FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [body.job_post_id, ctx.tenantId],
      )
      const job = rows[0]
      if (job) {
        title = title || job.title || ''
        company = company || job.company
        location = location || job.location
        type = type || job.type
        description = description || job.description
        requirements = requirements || job.requirements
        rawJd = rawJd || job.raw_jd_text
      }
    }

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const platforms = normalizePlatforms(body.platforms)

    if (!getAIConfig()) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const jdBlock = (rawJd || description || '').trim()
    const jobContext = [
      `Job Title: ${title}`,
      company && `Company: ${company}`,
      location && `Location: ${location}`,
      type && `Employment Type: ${type}`,
      jdBlock && `Full Job Description (source of truth):\n${jdBlock.slice(0, 12000)}`,
      requirements && `Requirements:\n${requirements}`,
      body.custom_prompt && `Special Instructions: ${body.custom_prompt}`,
      `Selected platforms: ${platforms.join(', ')}`,
    ].filter(Boolean).join('\n\n')

    const systemPrompt = buildJobPostSystemPrompt(platforms)

    const raw = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate job posts for:\n${jobContext}` },
      ],
      temperature: 0.7,
      max_tokens: 6000,
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
