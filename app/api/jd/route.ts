import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

export const maxDuration = 60

const JD_GENERATOR_PROMPT = `You are a senior recruitment consultant and professional JD writer.

Your task is to write a complete, human-quality Job Description based on the inputs provided.

STRICT RULES:
- Write in clear, professional, human tone
- No robotic AI language ("cutting-edge", "dynamic team", "passion for excellence")
- No exaggerated claims or empty buzzwords
- No fake promises about culture or compensation without facts
- Be factual and realistic
- Structure must be complete and scannable

JD STRUCTURE (all sections required):
1. Job Title
2. Role Summary (3–4 sentences about the role purpose)
3. Key Responsibilities (6–10 bullet points, start with action verbs)
4. Required Skills (5–8 must-have items, be specific)
5. Preferred / Nice-to-Have Skills (3–5 items)
6. Experience Required (years + type)
7. Education
8. Employment Type
9. Location
10. Notice Period Preference (if provided)
11. Compensation (only if salary range provided — otherwise omit entirely)
12. About the Company (only if company info provided — otherwise omit)

OUTPUT FORMAT:
Return JSON ONLY. No markdown. No extra text.
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
  "full_jd_text": "Complete formatted JD as a single readable text block"
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

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://recruit.srpailabs.com',
      'X-Title': 'SRP SmartRecruit',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.35,
    }),
  })
  if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function parseJSON(raw: string): Record<string, unknown> {
  let text = raw.trim()
  if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim()
  else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim()
  return JSON.parse(text)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action, ...params } = body as {
      action: 'generate' | 'analyze'
      [key: string]: unknown
    }

    if (!action) {
      return NextResponse.json({ error: 'action required: generate | analyze' }, { status: 400 })
    }

    const userId = (session.user as Record<string, unknown>).userId as string

    if (action === 'generate') {
      const { job_title, skills, experience, education, location,
              employment_type, salary, industry, company_name,
              notice_period, additional_notes } = params as Record<string, string>

      if (!job_title?.trim()) {
        return NextResponse.json({ error: 'job_title is required' }, { status: 400 })
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

      const raw = await callAI(JD_GENERATOR_PROMPT, userMessage)
      const result = parseJSON(raw)

      // Save to DB
      let savedId: string | null = null
      try {
        const dbRes = await pool.query<{ id: string }>(
          `INSERT INTO generated_jds
            (user_id, title, input_params, full_jd_text, structured_data)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [userId, job_title, JSON.stringify(params), result.full_jd_text ?? raw, JSON.stringify(result)]
        )
        savedId = dbRes.rows[0]?.id ?? null
      } catch (dbErr) {
        console.warn('[api/jd] DB save warning:', dbErr instanceof Error ? dbErr.message : dbErr)
      }

      return NextResponse.json({ id: savedId, action: 'generate', ...result })
    }

    if (action === 'analyze') {
      const { jd_text } = params as { jd_text: string }
      if (!jd_text?.trim()) {
        return NextResponse.json({ error: 'jd_text is required for analyze action' }, { status: 400 })
      }
      if (jd_text.length > 20000) {
        return NextResponse.json({ error: 'JD text too long (max 20,000 chars)' }, { status: 400 })
      }

      const raw = await callAI(JD_ANALYZER_PROMPT, `ANALYZE THIS JD:\n\n${jd_text}`)
      const result = parseJSON(raw)

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

      return NextResponse.json({ action: 'analyze', ...result })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/jd]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string
  try {
    const { rows } = await pool.query(
      `SELECT id, title, created_at FROM generated_jds WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [userId]
    )
    return NextResponse.json({ jds: rows })
  } catch {
    return NextResponse.json({ jds: [] })
  }
}
