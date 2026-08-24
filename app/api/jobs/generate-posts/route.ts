import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { upsertJobPostContents, pool } from '@/lib/db'
import { chatCompletionWithUsage, getAIConfig } from '@/lib/aiClient'
import { recordAiUsage } from '@/lib/aiUsage'
import { isValidUUID, parseBodySafe, asAiString, sanitizeDbText } from '@/lib/validate'
import { logAiAction, withAiSecurityPolicy, wrapUntrustedData } from '@/lib/aiSecurity'
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
    const bodyRaw = await parseBodySafe(req)
    if (!bodyRaw) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const body = bodyRaw as {
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
      force?: boolean
    }

    const force = Boolean(body.force)
    let title = asAiString(body.title, 200)
    let company = asAiString(body.company, 200) || undefined
    let location = asAiString(body.location, 200) || undefined
    let type = asAiString(body.type, 80) || undefined
    let description = sanitizeDbText(body.description, 50_000) || undefined
    let requirements = sanitizeDbText(body.requirements, 50_000) || undefined
    let rawJd = sanitizeDbText(body.raw_jd_text, 50_000) || undefined

    // Always load full job row when id provided — never lose raw_jd_text
    if (body.job_post_id) {
      if (!isValidUUID(body.job_post_id)) {
        return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
      }
      const { rows } = await pool.query(
        `SELECT title, company, location, type, description, requirements, raw_jd_text
         FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [body.job_post_id, ctx.tenantId],
      )
      const job = rows[0]
      if (!job) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      title = title || job.title || ''
      company = company || job.company
      location = location || job.location
      type = type || job.type
      description = description || job.description
      requirements = requirements || job.requirements
      rawJd = rawJd || job.raw_jd_text
    }

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const platforms = normalizePlatforms(body.platforms)

    // Cache hit: return saved posts without calling AI unless force
    if (!force && body.job_post_id && isValidUUID(body.job_post_id)) {
      const { rows: contentRows } = await pool.query(
        `SELECT jpc.*
         FROM job_post_contents jpc
         JOIN job_posts jp ON jp.id = jpc.job_post_id
         WHERE jpc.job_post_id = $1 AND jp.tenant_id = $2
         LIMIT 1`,
        [body.job_post_id, ctx.tenantId],
      )
      const saved = contentRows[0] as Record<string, unknown> | undefined
      if (saved) {
        const posts: Partial<Record<JobPostPlatform, string>> = {}
        let hitCount = 0
        for (const p of platforms) {
          const text = typeof saved[p] === 'string' ? String(saved[p]).trim() : ''
          if (text) {
            posts[p] = text
            hitCount++
          }
        }
        if (hitCount > 0) {
          let generatedBy: string | null = null
          try {
            const { rows: urows } = await pool.query(
              `SELECT name, email FROM auth_users WHERE id = $1 LIMIT 1`,
              [saved.user_id],
            )
            generatedBy = urows[0]?.name || urows[0]?.email || null
          } catch { /* ignore */ }
          return NextResponse.json({
            posts,
            platforms,
            cached: true,
            generation: {
              status: 'completed',
              generated_at: saved.updated_at || saved.created_at || null,
              generated_by: generatedBy,
              model: null,
              tokens: null,
            },
          })
        }
      }
    }

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
      body.custom_prompt && `Special Instructions: ${asAiString(body.custom_prompt, 2000)}`,
      `Selected platforms: ${platforms.join(', ')}`,
    ].filter(Boolean).join('\n\n')

    const systemPrompt = withAiSecurityPolicy(buildJobPostSystemPrompt(platforms))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 50_000)
    let ai
    try {
      ai = await chatCompletionWithUsage({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate job posts for:\n${wrapUntrustedData('JOB_DESCRIPTION', jobContext)}` },
        ],
        temperature: 0.7,
        max_tokens: 3500,
        response_format: { type: 'json_object' },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    const rawAi = (ai.content || '').trim()
    if (!rawAi) {
      return NextResponse.json({ error: 'AI returned empty content — try again.' }, { status: 502 })
    }
    let parsed: Record<string, unknown> = {}
    try {
      const jsonMatch = rawAi.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] ?? rawAi) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON — try again.' }, { status: 502 })
    }

    const posts: Partial<Record<JobPostPlatform, string>> = {}
    for (const p of platforms) {
      const text = asAiString(parsed[p], 8000)
      if (text) posts[p] = text
    }
    if (!Object.keys(posts).length) {
      return NextResponse.json({ error: 'AI returned empty posts — try again with a clearer JD.' }, { status: 422 })
    }

    if (body.job_post_id && canJobs) {
      await upsertJobPostContents({ job_post_id: body.job_post_id, user_id: userId, posts })
    }

    await recordAiUsage({
      userId,
      tenantId: ctx.tenantId,
      operation: 'generate_posts',
      result: ai,
      metadata: { job_post_id: body.job_post_id ?? null, platforms, force },
    })
    await logAiAction({
      ctx,
      action: 'ai_generate_posts',
      resourceType: 'job_post',
      resourceId: body.job_post_id ?? undefined,
      details: { platforms, cached: false, tokens: ai.total_tokens },
    })

    return NextResponse.json({
      posts,
      platforms,
      cached: false,
      generation: {
        status: 'completed',
        generated_at: new Date().toISOString(),
        generated_by: null,
        model: ai.model,
        tokens: ai.total_tokens,
        duration_ms: ai.duration_ms,
      },
    })
  } catch (err) {
    console.error('[api/jobs/generate-posts]', err)
    return NextResponse.json({ error: 'Could not generate job posts. Please try again.' }, { status: 500 })
  }
}
