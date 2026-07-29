import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { chatCompletionWithUsage } from '@/lib/aiClient'
import { recordAiUsage } from '@/lib/aiUsage'

export const maxDuration = 60

const JD_GENERATOR_PROMPT = `You are a staffing-agency JD writer for recruiters.
Write a SHORT, professional JD — not a long corporate brochure.

STRICT RULES:
- Clear, human, professional tone
- No buzzwords ("cutting-edge", "passion for excellence", "dynamic team")
- No fake culture / benefits unless the user provided them
- Recruiter-ready: role, responsibilities, requirements, skills, location, type, budget

STRUCTURE (keep short):
1. Job Title
2. About the Role (2–4 sentences)
3. Key Responsibilities (4–8 bullets)
4. Requirements (4–8 bullets)
5. Key Skills (5–10)
6. Experience
7. Employment Type (Permanent / Contract / etc.)
8. Location
9. Budget / Compensation (only if provided)

OUTPUT FORMAT — JSON ONLY:
{
  "job_title": "",
  "role_summary": "",
  "responsibilities": [],
  "required_skills": [],
  "preferred_skills": [],
  "experience": "",
  "education": "",
  "employment_type": "",
  "location": "",
  "notice_period": "",
  "compensation": "",
  "about_company": "",
  "full_jd_text": "Formatted JD with sections: About the Role, Key Responsibilities, Requirements, Key Skills, Experience, Employment Type, Location, Budget"
}`

const JD_ANALYZER_PROMPT = `You are a senior recruitment intelligence analyst.

Given a Job Description, extract structured intelligence to help a recruiter:
1. Understand exactly what is required
2. Build effective boolean search strings
3. Screen candidates faster

OUTPUT FORMAT — Return JSON ONLY. No markdown. No extra text.
{
  "job_title": "",
  "seniority_level": "",
  "experience_range": {"min": 0, "max": 0},
  "must_have_skills": [],
  "nice_to_have_skills": [],
  "alternate_titles": [],
  "skill_clusters": {},
  "key_responsibilities": [],
  "suggested_questions": [],
  "must_exclude": [],
  "domain": "",
  "industry_hints": []
}`

async function callAI(systemPrompt: string, userMessage: string) {
  return chatCompletionWithUsage({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.35,
    max_tokens: 2500,
  })
}

function parseJSON(raw: string): Record<string, unknown> {
  let text = raw.trim()
  if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim()
  else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim()
  return JSON.parse(text)
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'jd_intel.use')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const { action, ...params } = body as {
      action: 'generate' | 'analyze'
      [key: string]: unknown
    }

    if (!action) {
      return NextResponse.json({ error: 'action required: generate | analyze' }, { status: 400 })
    }

    const userId = ctx.userId

    if (action === 'generate') {
      const { job_title, skills, experience, education, location,
              employment_type, salary, industry, company_name,
              notice_period, additional_notes, force } = params as Record<string, string> & { force?: boolean }

      if (!job_title?.trim()) {
        return NextResponse.json({ error: 'job_title is required' }, { status: 400 })
      }

      // Return last generated JD for this user+title unless force
      if (!force) {
        try {
          const { rows } = await pool.query(
            `SELECT id, title, full_jd_text, structured_data, created_at
             FROM generated_jds
             WHERE user_id = $1 AND LOWER(title) = LOWER($2)
             ORDER BY created_at DESC LIMIT 1`,
            [userId, job_title.trim()],
          )
          if (rows[0]) {
            const row = rows[0]
            const structured = typeof row.structured_data === 'object' && row.structured_data
              ? row.structured_data as Record<string, unknown>
              : {}
            return NextResponse.json({
              id: row.id,
              action: 'generate',
              cached: true,
              generation: {
                status: 'completed',
                generated_at: row.created_at,
                generated_by: null,
              },
              ...structured,
              full_jd_text: row.full_jd_text ?? structured.full_jd_text,
              job_title: row.title,
            })
          }
        } catch { /* table may vary */ }
      }

      const userMessage = [
        `Job Title: ${job_title}`,
        `Skills Required: ${Array.isArray(skills) ? (skills as string[]).join(', ') : (skills || 'Not specified')}`,
        `Experience: ${experience || 'Not specified'}`,
        `Education: ${education || 'Not specified'}`,
        `Location: ${location || 'Not specified'}`,
        `Employment Type: ${employment_type || 'Full-Time'}`,
        `Salary / Compensation: ${salary || 'Not provided'}`,
        `Industry: ${industry || 'Not specified'}`,
        `Company Name: ${company_name || 'Not provided'}`,
        `Notice Period: ${notice_period || 'Not specified'}`,
        additional_notes ? `\nAdditional Notes:\n${additional_notes}` : '',
      ].filter(Boolean).join('\n')

      const ai = await callAI(JD_GENERATOR_PROMPT, userMessage)
      const result = parseJSON(ai.content)

      // Save to DB
      let savedId: string | null = null
      try {
        const dbRes = await pool.query<{ id: string }>(
          `INSERT INTO generated_jds
            (user_id, title, input_params, full_jd_text, structured_data)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [userId, job_title, JSON.stringify(params), result.full_jd_text ?? ai.content, JSON.stringify(result)]
        )
        savedId = dbRes.rows[0]?.id ?? null
      } catch (dbErr) {
        console.warn('[api/jd] DB save warning:', dbErr instanceof Error ? dbErr.message : dbErr)
      }

      await recordAiUsage({
        userId,
        tenantId: ctx.tenantId,
        operation: 'jd_generate',
        result: ai,
        metadata: { jd_id: savedId, force: Boolean(force) },
      })

      return NextResponse.json({
        id: savedId,
        action: 'generate',
        cached: false,
        generation: {
          status: 'completed',
          generated_at: new Date().toISOString(),
          model: ai.model,
          tokens: ai.total_tokens,
          duration_ms: ai.duration_ms,
        },
        ...result,
      })
    }

    if (action === 'analyze') {
      const { jd_text, force } = params as { jd_text: string; force?: boolean }
      if (!jd_text?.trim()) {
        return NextResponse.json({ error: 'jd_text is required for analyze action' }, { status: 400 })
      }
      if (jd_text.length > 20000) {
        return NextResponse.json({ error: 'JD text too long (max 20,000 chars)' }, { status: 400 })
      }

      const ai = await callAI(JD_ANALYZER_PROMPT, `ANALYZE THIS JD:\n\n${jd_text}`)
      const result = parseJSON(ai.content)

      // Save analysis
      try {
        await pool.query(
          `INSERT INTO jd_analysis_results
            (user_id, source_jd_text, must_have_skills, nice_to_have_skills,
             alternate_titles, skill_clusters, suggested_questions, screening_criteria)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            userId,
            jd_text.substring(0, 10000),
            JSON.stringify(result.must_have_skills ?? []),
            JSON.stringify(result.nice_to_have_skills ?? []),
            JSON.stringify(result.alternate_titles ?? []),
            JSON.stringify(result.skill_clusters ?? {}),
            JSON.stringify(result.suggested_questions ?? []),
            JSON.stringify({ seniority_level: result.seniority_level, domain: result.domain }),
          ]
        )
      } catch (dbErr) {
        console.warn('[api/jd] DB save warning:', dbErr instanceof Error ? dbErr.message : dbErr)
      }

      await recordAiUsage({
        userId,
        tenantId: ctx.tenantId,
        operation: 'jd_analyze',
        result: ai,
        metadata: { force: Boolean(force) },
      })

      return NextResponse.json({
        action: 'analyze',
        cached: false,
        generation: {
          status: 'completed',
          generated_at: new Date().toISOString(),
          model: ai.model,
          tokens: ai.total_tokens,
          duration_ms: ai.duration_ms,
        },
        ...result,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/jd]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'jd_intel.use')
  if (ctx instanceof NextResponse) return ctx
  try {
    const { rows } = await pool.query(
      `SELECT id, title, created_at FROM generated_jds WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [ctx.userId]
    )
    return NextResponse.json({ jds: rows })
  } catch {
    return NextResponse.json({ jds: [] })
  }
}
