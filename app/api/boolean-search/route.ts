import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

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

async function callAI(prompt: string, user: string): Promise<string> {
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
        { role: 'system', content: prompt },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
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
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

  try {
    const body = await req.json() as Record<string, unknown>
    const { job_title, skills, experience, location, jd_text } = body as {
      job_title?: string
      skills?: string | string[]
      experience?: string
      location?: string
      jd_text?: string
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

    const raw = await callAI(BOOLEAN_SEARCH_PROMPT, userMsg)
    const result = parseJSON(raw)

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

    return NextResponse.json({ id: savedId, ...result })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/boolean-search]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string
  try {
    const { rows } = await pool.query(
      `SELECT id, job_title, short_boolean, created_at
       FROM generated_boolean_searches
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [userId]
    )
    return NextResponse.json({ searches: rows })
  } catch {
    return NextResponse.json({ searches: [] })
  }
}
