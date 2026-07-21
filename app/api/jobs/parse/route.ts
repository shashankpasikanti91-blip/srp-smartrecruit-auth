import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { sanitizeText } from '@/lib/validate'

export const maxDuration = 60

const PARSE_JD_PROMPT = `You are a senior recruitment OS parser. Extract structured fields from a raw Job Description.

Return JSON ONLY (no markdown):
{
  "title": "",
  "company": "",
  "location": "",
  "department": "",
  "type": "full-time|part-time|contract|remote|internship",
  "contract_duration": "",
  "experience_min": 0,
  "experience_max": 0,
  "salary_min": null,
  "salary_max": null,
  "currency": "MYR",
  "description": "",
  "requirements": "",
  "optional_requirements": "",
  "skills_mandatory": [],
  "skills_required": [],
  "priority": "medium",
  "headcount": 1,
  "candidate_type": "any",
  "max_budget": null
}

Rules:
- Prefer Malaysia/SEA context when currency/location unclear → MYR
- skills_mandatory = must-have; skills_required = nice-to-have/all listed
- description = role summary + responsibilities (readable text)
- requirements = must-have skills/experience as text
- Do not invent salary or budget — leave null if not in JD
- type: map Permanent→full-time, Contract→contract`

async function callAI(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
  const baseUrl = (process.env.OPENAI_BASE_URL || (
    process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  )).replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL || (
    baseUrl.includes('openrouter.ai') ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'
  )
  if (!apiKey) throw new Error('AI not configured')

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://recruit.srpailabs.com',
      'X-Title': 'SRP SmartRecruit JD Parse',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || 'AI parse failed')
  return data.choices?.[0]?.message?.content ?? '{}'
}

/** POST /api/jobs/parse — Parse JD text into job form fields. */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'jobs.create')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const text = sanitizeText(body.text ?? body.jd_text ?? body.raw_jd, 50000)
  const mode = body.mode === 'manual' ? 'manual' : 'ai'

  if (!text || text.length < 40) {
    return NextResponse.json({ error: 'Paste a fuller JD (at least ~40 characters)' }, { status: 400 })
  }

  // Manual path: keep raw text only — recruiter fills fields themselves
  if (mode === 'manual') {
    return NextResponse.json({
      mode: 'manual',
      fields: {
        raw_jd_text: text,
        description: text.slice(0, 8000),
      },
      message: 'Text kept without AI. Fill location, experience, salary, and skills yourself.',
    })
  }

  try {
    const raw = await callAI(PARSE_JD_PROMPT, `Parse this JD:\n\n${text.slice(0, 12000)}`)
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : {}
    }

    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 30) : []

    const fields = {
      title: String(parsed.title ?? '').trim(),
      company: String(parsed.company ?? '').trim(),
      location: String(parsed.location ?? '').trim(),
      department: String(parsed.department ?? '').trim(),
      type: String(parsed.type ?? 'full-time').trim() || 'full-time',
      contract_duration: String(parsed.contract_duration ?? '').trim(),
      experience_min: parsed.experience_min != null ? Number(parsed.experience_min) || 0 : 0,
      experience_max: parsed.experience_max != null ? Number(parsed.experience_max) || 0 : 0,
      salary_min: parsed.salary_min != null && parsed.salary_min !== '' ? Number(parsed.salary_min) : null,
      salary_max: parsed.salary_max != null && parsed.salary_max !== '' ? Number(parsed.salary_max) : null,
      currency: String(parsed.currency ?? 'MYR').trim() || 'MYR',
      description: String(parsed.description ?? '').trim() || text.slice(0, 4000),
      requirements: String(parsed.requirements ?? '').trim(),
      optional_requirements: String(parsed.optional_requirements ?? '').trim(),
      skills_mandatory: arr(parsed.skills_mandatory),
      skills_required: arr(parsed.skills_required),
      priority: ['low', 'medium', 'high'].includes(String(parsed.priority).toLowerCase())
        ? String(parsed.priority).toLowerCase()
        : 'medium',
      headcount: Number(parsed.headcount) || 1,
      candidate_type: String(parsed.candidate_type ?? 'any'),
      max_budget: parsed.max_budget != null && parsed.max_budget !== '' ? Number(parsed.max_budget) : null,
      raw_jd_text: text,
    }

    return NextResponse.json({
      mode: 'ai',
      fields,
      message: 'Parse with AI filled title, skills, experience, and salary when possible. Review before creating.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Parse failed'
    // Fallback: keep text so recruiter can continue manually
    return NextResponse.json({
      mode: 'fallback',
      error: msg,
      fields: {
        raw_jd_text: text,
        description: text.slice(0, 8000),
      },
      message: 'AI unavailable — text kept. Fill fields manually or retry Parse with AI.',
    }, { status: msg.includes('not configured') ? 503 : 200 })
  }
}
