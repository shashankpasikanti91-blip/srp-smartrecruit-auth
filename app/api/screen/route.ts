import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'
import { checkAiScreenLimit } from '@/lib/limits'

export const maxDuration = 60

const SCREENING_SYSTEM_PROMPT = `You are an expert recruiter with experience hiring across:
- Technology & Software roles
- Executive leadership roles (CEO, COO, CTO, CFO)
- Business roles (Business Analyst, Business Development, Sales)
- Finance & Accounting roles
- Operations, Admin, and Blue-Collar roles

You understand that screening criteria vary by role type and seniority.

You will receive:
1) A Job Description
2) A Candidate Resume

Your task is to:
- Analyze how well the candidate matches the job requirements
- Extract key candidate details from the resume
- Provide a structured, realistic screening evaluation

IMPORTANT RULES:
- Base your evaluation STRICTLY on the provided Job Description and Resume
- Do NOT assume or infer missing information
- Do NOT hallucinate skills, experience, or reasons
- If a detail is not found, return "Not Found"

EXTRACT THE FOLLOWING DETAILS FROM THE RESUME:
- Full Name
- Email ID
- Contact Number
- Current Company (or Most Recent Employer)

ROLE-AWARE SCREENING LOGIC (CRITICAL):
1) IDENTIFY ROLE CATEGORY FROM JOB DESCRIPTION
Classify the role into ONE of: Executive/Leadership, Technical/IT/Engineering, Business/Sales/BA/BD, Finance/Accounts, Operations/Admin, Blue-Collar/Skilled/Support

2) CURRENT EXPERIENCE PRIORITY (ALL ROLES)
- Give highest priority to skills, responsibilities, and domain used in the CURRENT or MOST RECENT role
- If the candidate has not worked in the JD-related role/domain in the last 8 months: treat as historical, reduce suitability score

3) PREVIOUS EXPERIENCE VALIDATION
A) Technical Roles: Previous experience counts ONLY if recent and continuous. If switched technology/domain for >8 months: mark core JD skills as NOT CURRENT
B) Executive/Leadership: Prior leadership roles ARE valid but must match company size, scope, function
C) Business/Sales/BA/BD: Valid if same function and similar industry
D) Finance/Accounts: Current hands-on work preferred, gaps reduce suitability
E) Blue-Collar/Operations: Practical hands-on experience matters most

4) EXPERIENCE DURATION MATCHING
- Compare JD-required years vs ACTUAL relevant years
- Count only years actively working in JD-related role

5) ROLE CHANGE & RECENCY RULE
- Role change <6 months → previous role still relevant
- Role change 6-8 months → medium risk
- Role change >8 months → previous role considered outdated

6) CAREER GAP ANALYSIS
- ≤1 year → Low risk
- 1-3 years → Medium risk
- 3-4 years → High risk
- >4 years → Very high risk (likely rejection)

SCORING RULES:
- Score must be between 0 and 100
- 75+ → Strong fit
- 60-74 → Moderate fit
- <60 → Weak fit

FINAL DECISION RULE:
If score >= 70 → Decision = "Shortlisted"
If score < 70 → Decision = "Rejected"

OUTPUT FORMAT (STRICT – JSON ONLY):
Respond ONLY with valid JSON. No explanations, markdown, or extra text. Do NOT change field names.

{
  "name": "",
  "email": "",
  "contact_number": "",
  "current_company": "",
  "score": 0,
  "decision": "",
  "evaluation": {
    "candidate_strengths": [],
    "high_match_skills": [],
    "medium_match_skills": [],
    "low_or_missing_match_skills": [],
    "candidate_weaknesses": [],
    "risk_level": "",
    "risk_explanation": "",
    "reward_level": "",
    "reward_explanation": "",
    "overall_fit_rating": 0,
    "justification": ""
  }
}`

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
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
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI API error ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { jd_text, resumes, candidate_id } = body as {
      jd_text: string
      resumes: { text: string; filename?: string; id?: string }[]
      candidate_id?: string
    }

    if (!jd_text?.trim()) return NextResponse.json({ error: 'jd_text required' }, { status: 400 })
    if (!resumes?.length) return NextResponse.json({ error: 'resumes required' }, { status: 400 })

    const userRes = await pool.query<{ id: string }>('SELECT id FROM auth_users WHERE email = $1', [session.user.email])
    const userId = userRes.rows[0]?.id

    // Check monthly AI screen limit
    if (userId) {
      const limit = await checkAiScreenLimit(userId)
      if (!limit.allowed) {
        return NextResponse.json({ error: limit.reason }, { status: 403 })
      }
    }

    const results = []
    for (const resume of resumes) {
      if (!resume.text?.trim()) { results.push({ error: 'empty resume' }); continue }

      const userMessage = `JOB DESCRIPTION:\n${jd_text}\n\nCANDIDATE RESUME:\n${resume.text}`
      const raw = await callAI([
        { role: 'system', content: SCREENING_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ])

      let parsed: Record<string, unknown>
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch?.[0] ?? raw)
      } catch {
        parsed = { error: 'Failed to parse AI response', raw }
      }

      // Save to DB if we have a candidate/resume id
      const resumeId = resume.id ?? candidate_id
      if (resumeId && userId && !parsed.error) {
        const p = parsed as Record<string, unknown>
        const evalData = p.evaluation as Record<string, unknown> | undefined
        const score = typeof p.score === 'number' ? p.score : null
        const category = score != null ? (score >= 75 ? 'best' : score >= 60 ? 'good' : score >= 45 ? 'partial' : 'poor') : null
        const decision = (p.decision as string) ?? ''
        const skills = (evalData?.high_match_skills as string[]) ?? []
        const summary = (evalData?.justification as string) ?? ''
        const stage = decision === 'Shortlisted' ? 'screening' : 'applied'

        await pool.query(
          `UPDATE resumes SET
            ai_score = $1, match_category = $2, ai_summary = $3,
            ai_skills = $4, pipeline_stage = $5,
            candidate_name = COALESCE(NULLIF(candidate_name,''), $6),
            candidate_email = COALESCE(NULLIF(candidate_email,''), $7),
            candidate_phone = COALESCE(NULLIF(candidate_phone,''), $8),
            status = 'reviewed', updated_at = NOW()
          WHERE id = $9 AND user_id = $10`,
          [score, category, summary, JSON.stringify(skills), stage,
           p.name ?? null, p.email ?? null, p.contact_number ?? null,
           resumeId, userId]
        )
      }

      results.push({ ...parsed, filename: resume.filename })
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/screen]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
