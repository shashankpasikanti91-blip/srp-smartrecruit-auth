import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { sanitizeText } from '@/lib/validate'
import { chatCompletionWithUsage } from '@/lib/aiClient'
import { recordAiUsage } from '@/lib/aiUsage'

export const maxDuration = 60

/** Recruiter-focused parse — keep it simple, not a corporate brochure. */
const PARSE_JD_PROMPT = `You are a staffing-agency recruitment assistant.
Extract ONLY what a recruiter needs from a raw Job Description.

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
  "about_role": "",
  "responsibilities": [],
  "requirements": [],
  "skills_mandatory": [],
  "skills_required": [],
  "priority": "medium",
  "headcount": 1,
  "candidate_type": "any",
  "max_budget": null
}

RULES FOR RECRUITERS:
- Keep it short and practical — no marketing fluff, no culture essays, no fake benefits
- about_role: 2–4 plain sentences on what the role is
- responsibilities: 4–8 action bullets (what they will do)
- requirements: 4–8 must-have bullets (experience, education, tools)
- skills_mandatory: top 5–10 hard skills only (e.g. Java, Spring, SQL)
- skills_required: nice-to-have only
- type: Permanent → full-time, Contract → contract, Temporary → contract
- Prefer MYR / Malaysia-SEA when currency or location is unclear
- Do NOT invent salary, budget, or headcount — use null / 1 if missing
- Do NOT invent company name if not in the JD`

function formatRecruiterDescription(about: string, responsibilities: string[]): string {
  const parts: string[] = []
  if (about.trim()) {
    parts.push('About the Role', about.trim())
  }
  const bullets = responsibilities.map(r => r.trim()).filter(Boolean)
  if (bullets.length) {
    parts.push('', 'Key Responsibilities', ...bullets.map(b => `• ${b.replace(/^[•\-–*]\s*/, '')}`))
  }
  return parts.join('\n').trim()
}

function formatRequirements(items: string[]): string {
  return items
    .map(r => r.trim())
    .filter(Boolean)
    .map(b => `• ${b.replace(/^[•\-–*]\s*/, '')}`)
    .join('\n')
}

async function callAI(system: string, user: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    return await chatCompletionWithUsage({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** POST /api/jobs/parse — Parse JD text into simple recruiter job fields. Always keeps raw JD. */
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
        description: '',
        requirements: '',
      },
      message: 'Raw JD saved. Fill About the Role, Responsibilities, Requirements, and Skills yourself.',
    })
  }

  try {
    const ai = await callAI(PARSE_JD_PROMPT, `Parse this JD for a recruiter:\n\n${text.slice(0, 12000)}`)
    await recordAiUsage({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      operation: 'jd_parse',
      result: ai,
    })
    const raw = ai.content
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : {}
    }

    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 20) : []

    const about = String(parsed.about_role ?? parsed.description ?? '').trim()
    const responsibilities = arr(parsed.responsibilities)
    const reqList = arr(parsed.requirements)
    // Back-compat if model returns requirements as a string
    const requirementsText = reqList.length
      ? formatRequirements(reqList)
      : String(parsed.requirements ?? '').trim()

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
      description: formatRecruiterDescription(about, responsibilities) || about,
      requirements: requirementsText,
      optional_requirements: String(parsed.optional_requirements ?? '').trim(),
      skills_mandatory: arr(parsed.skills_mandatory),
      skills_required: arr(parsed.skills_required),
      priority: ['low', 'medium', 'high'].includes(String(parsed.priority).toLowerCase())
        ? String(parsed.priority).toLowerCase()
        : 'medium',
      headcount: Number(parsed.headcount) || 1,
      candidate_type: String(parsed.candidate_type ?? 'any'),
      max_budget: parsed.max_budget != null && parsed.max_budget !== '' ? Number(parsed.max_budget) : null,
      // Always preserve the original uploaded/pasted JD
      raw_jd_text: text,
    }

    return NextResponse.json({
      mode: 'ai',
      fields,
      message: 'Parsed for recruiters: About Role, Responsibilities, Requirements, Skills, Location, Type & Budget. Raw JD kept.',
    })
  } catch (e) {
    const aborted = e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))
    const msg = aborted
      ? 'JD parse timed out. Retry Parse with AI, or fill fields from the raw JD.'
      : e instanceof Error ? e.message : 'Parse failed'
    return NextResponse.json({
      mode: 'fallback',
      error: msg,
      fields: {
        raw_jd_text: text,
        description: '',
        requirements: '',
      },
      message: 'AI unavailable — raw JD kept. Fill recruiter fields manually or retry Parse with AI.',
    }, { status: msg.includes('not configured') ? 503 : 200 })
  }
}
