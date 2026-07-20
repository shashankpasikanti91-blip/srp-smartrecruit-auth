import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { hybridParseResume, type HybridResumeParse } from '@/lib/hybridResumeParse'
import { sanitizeText } from '@/lib/validate'

export const maxDuration = 90

const AI_IMPROVE_PROMPT = `You are a recruitment resume parser. Improve extracted fields from resume text.
Return JSON ONLY:
{
  "name": "",
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "current_title": "",
  "current_company": "",
  "total_experience": "",
  "skills": "",
  "education": "",
  "experience_summary": "",
  "nationality": "",
  "nric": "",
  "passport_number": "",
  "linkedin_url": "",
  "confidence": {
    "name": "HIGH|MEDIUM|LOW",
    "email": "HIGH|MEDIUM|LOW",
    "phone": "HIGH|MEDIUM|LOW",
    "current_title": "HIGH|MEDIUM|LOW",
    "current_company": "HIGH|MEDIUM|LOW",
    "skills": "HIGH|MEDIUM|LOW",
    "education": "HIGH|MEDIUM|LOW"
  }
}
Never invent IC/Passport/DOB. Leave blank if not in resume. Skills as comma-separated.`

async function callAI(user: string): Promise<Record<string, unknown>> {
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
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: AI_IMPROVE_PROMPT },
        { role: 'user', content: user },
      ],
      temperature: 0.15,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || 'AI improve failed')
  const content = data.choices?.[0]?.message?.content ?? '{}'
  return JSON.parse(content)
}

function mergeAi(base: HybridResumeParse, ai: Record<string, unknown>): HybridResumeParse {
  const conf = (ai.confidence ?? {}) as Record<string, string>
  const pick = (key: keyof HybridResumeParse, aiKey: string) => {
    const field = base[key]
    if (typeof field !== 'object' || field === null || !('value' in field)) return field
    const aiVal = typeof ai[aiKey] === 'string' ? (ai[aiKey] as string).trim() : ''
    if (!aiVal) return field
    const c = (conf[aiKey] || 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW'
    return { value: aiVal, confidence: c }
  }
  return {
    ...base,
    parser: 'ai',
    name: pick('name', 'name') as HybridResumeParse['name'],
    first_name: pick('first_name', 'first_name') as HybridResumeParse['first_name'],
    last_name: pick('last_name', 'last_name') as HybridResumeParse['last_name'],
    email: pick('email', 'email') as HybridResumeParse['email'],
    phone: pick('phone', 'phone') as HybridResumeParse['phone'],
    location: pick('location', 'location') as HybridResumeParse['location'],
    current_title: pick('current_title', 'current_title') as HybridResumeParse['current_title'],
    current_company: pick('current_company', 'current_company') as HybridResumeParse['current_company'],
    total_experience: pick('total_experience', 'total_experience') as HybridResumeParse['total_experience'],
    skills: pick('skills', 'skills') as HybridResumeParse['skills'],
    education: pick('education', 'education') as HybridResumeParse['education'],
    experience_summary: pick('experience_summary', 'experience_summary') as HybridResumeParse['experience_summary'],
    nationality: pick('nationality', 'nationality') as HybridResumeParse['nationality'],
    nric: pick('nric', 'nric') as HybridResumeParse['nric'],
    passport_number: pick('passport_number', 'passport_number') as HybridResumeParse['passport_number'],
    linkedin_url: pick('linkedin_url', 'linkedin_url') as HybridResumeParse['linkedin_url'],
    warnings: [
      ...base.warnings.filter(w => !w.includes('Improve with AI')),
      'AI-improved fields — still review low-confidence values before saving.',
    ],
  }
}

/**
 * POST /api/candidates/parse-profile
 * Body JSON: { text, filename?, improve_with_ai? }
 * Or multipart: file + improve_with_ai
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  let text = ''
  let filename: string | null = null
  let improve = false

  const ct = req.headers.get('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    improve = form.get('improve_with_ai') === '1' || form.get('improve_with_ai') === 'true'
    if (file) {
      // Reuse parse pipeline via internal extract
      const fd = new FormData()
      fd.append('file', file)
      const origin = req.nextUrl.origin
      const cookie = req.headers.get('cookie') || ''
      const parseRes = await fetch(`${origin}/api/parse`, {
        method: 'POST',
        headers: { cookie },
        body: fd,
      })
      const parseData = await parseRes.json()
      if (!parseRes.ok) return NextResponse.json(parseData, { status: parseRes.status })
      text = parseData.text || ''
      filename = parseData.filename || file.name
    } else {
      text = String(form.get('text') || '')
    }
  } else {
    const body = await req.json().catch(() => ({}))
    text = sanitizeText(body.text, 100000) || ''
    filename = sanitizeText(body.filename, 255)
    improve = Boolean(body.improve_with_ai)
  }

  if (!text || text.length < 20) {
    return NextResponse.json({ error: 'Resume text too short' }, { status: 400 })
  }

  let result = hybridParseResume(text, filename)

  if (improve) {
    try {
      const ai = await callAI(`Resume text:\n${text.slice(0, 10000)}\n\nCurrent extract:\n${JSON.stringify(result)}`)
      result = mergeAi(result, ai)
    } catch (e) {
      result.warnings.push(
        `AI improve skipped: ${e instanceof Error ? e.message : 'unavailable'}. Hybrid results kept.`
      )
    }
  }

  const lowConfidence = Object.entries(result)
    .filter(([, v]) => v && typeof v === 'object' && 'confidence' in v && (v as { confidence: string | null }).confidence === 'MEDIUM')
    .map(([k]) => k)

  return NextResponse.json({
    text,
    filename,
    fields: result,
    review_required: true,
    low_confidence_fields: lowConfidence,
    message: lowConfidence.length
      ? 'Review required — confirm or correct low-confidence fields before saving.'
      : 'Fields extracted — review below.',
  })
}
