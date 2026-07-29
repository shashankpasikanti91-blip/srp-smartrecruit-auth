import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { chatCompletionWithUsage } from '@/lib/aiClient'
import { recordAiUsage } from '@/lib/aiUsage'

export const maxDuration = 30

const BOOLEAN_SEARCH_PROMPT = `You are an expert sourcing recruiter and boolean search specialist.

Generate precise boolean search strings optimised for multiple job portals.

RULES:
- Use proper boolean operators: AND, OR, NOT (ALL CAPS)
- Use exact quotes "like this" for exact phrases
- Use parentheses for grouping
- Short: <= 120 characters. Advanced: full precision with exclusions.
- Alternate: use synonymous job titles
- Tailor LinkedIn, Naukri, Indeed strings to each portal's syntax

OUTPUT FORMAT — JSON ONLY. No markdown. No extra text.
{
  "job_title": "",
  "short_boolean": "",
  "advanced_boolean": "",
  "alternate_boolean": "",
  "linkedin_search": "",
  "naukri_search": "",
  "indeed_search": "",
  "key_skills": [],
  "alternate_titles": [],
  "exclude_terms": []
}`

async function callAI(prompt: string, user: string) {
  return chatCompletionWithUsage({
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  })
}

function parseJSON(raw: string): Record<string, unknown> {
  let text = raw.trim()
  if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim()
  else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim()
  return JSON.parse(text)
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'boolean_search.use')
  if (ctx instanceof NextResponse) return ctx
  const userId = ctx.userId

  try {
    const body = await req.json() as Record<string, unknown>
    const { job_title, skills, experience, location, jd_text, force } = body as {
      job_title?: string
      skills?: string | string[]
      experience?: string
      location?: string
      jd_text?: string
      force?: boolean
    }

    // Cache: return latest boolean for same title unless force
    if (!force && job_title?.trim() && !jd_text?.trim()) {
      try {
        const { rows } = await pool.query(
          `SELECT id, job_title, short_boolean, advanced_boolean, alternate_boolean,
                  linkedin_search, naukri_search, indeed_search, created_at
           FROM generated_boolean_searches
           WHERE user_id = $1 AND LOWER(job_title) = LOWER($2)
           ORDER BY created_at DESC LIMIT 1`,
          [userId, job_title.trim()],
        )
        if (rows[0]) {
          const r = rows[0]
          return NextResponse.json({
            id: r.id,
            job_title: r.job_title,
            short_boolean: r.short_boolean,
            advanced_boolean: r.advanced_boolean,
            alternate_boolean: r.alternate_boolean,
            linkedin_search: r.linkedin_search,
            naukri_search: r.naukri_search,
            indeed_search: r.indeed_search,
            cached: true,
            generation: {
              status: 'completed',
              generated_at: r.created_at,
            },
          })
        }
      } catch { /* ignore */ }
    }

    let userMsg: string
    if (jd_text?.trim()) {
      userMsg = `Generate boolean search strings from this JD:\n\n${jd_text.substring(0, 8000)}`
    } else if (job_title?.trim()) {
      const skillList = Array.isArray(skills) ? skills.join(', ') : (skills ?? 'Not specified')
      userMsg = [
        `Job Title: ${job_title}`,
        `Skills: ${skillList}`,
        `Experience: ${experience ?? 'Any'}`,
        `Location: ${location ?? 'Any'}`,
      ].join('\n')
    } else {
      return NextResponse.json({ error: 'Provide job_title+skills or jd_text' }, { status: 400 })
    }

    const ai = await callAI(BOOLEAN_SEARCH_PROMPT, userMsg)
    const result = parseJSON(ai.content)

    let savedId: string | null = null
    try {
      const dbRes = await pool.query<{ id: string }>(
        `INSERT INTO generated_boolean_searches
          (user_id, job_title, input_params, short_boolean, advanced_boolean,
           alternate_boolean, linkedin_search, naukri_search, indeed_search)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          userId,
          (result.job_title as string) ?? job_title ?? '',
          JSON.stringify(body),
          result.short_boolean ?? '',
          result.advanced_boolean ?? '',
          result.alternate_boolean ?? '',
          result.linkedin_search ?? '',
          result.naukri_search ?? '',
          result.indeed_search ?? '',
        ]
      )
      savedId = dbRes.rows[0]?.id ?? null
    } catch (dbErr) {
      console.warn('[api/boolean-search] DB save:', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    await recordAiUsage({
      userId,
      tenantId: ctx.tenantId,
      operation: 'boolean_search',
      result: ai,
      metadata: { search_id: savedId, force: Boolean(force) },
    })

    return NextResponse.json({
      id: savedId,
      ...result,
      cached: false,
      generation: {
        status: 'completed',
        generated_at: new Date().toISOString(),
        model: ai.model,
        tokens: ai.total_tokens,
        duration_ms: ai.duration_ms,
      },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/boolean-search]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'boolean_search.use')
  if (ctx instanceof NextResponse) return ctx
  try {
    const { rows } = await pool.query(
      `SELECT id, job_title, short_boolean, created_at
       FROM generated_boolean_searches
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [ctx.userId]
    )
    return NextResponse.json({ searches: rows })
  } catch {
    return NextResponse.json({ searches: [] })
  }
}
