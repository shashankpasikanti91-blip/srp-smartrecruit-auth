import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'
import { checkAiScreenLimit } from '@/lib/limits'

export const maxDuration = 120

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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000) // 90s timeout for AI

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://recruit.srpailabs.com',
        'X-Title': 'SRP SmartRecruit',
      },
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`AI API error ${res.status}: ${errText}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { jd_text, resumes, candidate_id, job_post_id } = body as {
      jd_text: string
      resumes: { text: string; filename?: string; id?: string }[]
      candidate_id?: string
      job_post_id?: string
    }

    if (!jd_text?.trim()) return NextResponse.json({ error: 'jd_text required' }, { status: 400 })
    if (!resumes?.length) return NextResponse.json({ error: 'resumes required' }, { status: 400 })

    // Try to get userId from DB — but don't block screening if DB is slow
    let userId: string | undefined
    try {
      const userRes = await pool.query<{ id: string }>('SELECT id FROM auth_users WHERE email = $1', [session.user.email])
      userId = userRes.rows[0]?.id
    } catch (dbErr) {
      console.warn('[api/screen] Could not fetch user from DB, proceeding without DB:', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    // Check monthly AI screen limit (skip if DB unavailable)
    if (userId) {
      try {
        const limit = await checkAiScreenLimit(userId)
        if (!limit.allowed) {
          return NextResponse.json({ error: limit.reason }, { status: 403 })
        }
      } catch (limitErr) {
        console.warn('[api/screen] Could not check limit, allowing:', limitErr instanceof Error ? limitErr.message : limitErr)
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

      // Save to DB — update existing candidate OR insert new one
      // Wrapped in try-catch: DB save failure should NOT block screening results
      if (userId && !parsed.error) {
        try {
          const p = parsed as Record<string, unknown>
          const evalData = p.evaluation as Record<string, unknown> | undefined
          const score = typeof p.score === 'number' ? p.score : null
          const decision = (p.decision as string) ?? ''
          const skills = (evalData?.high_match_skills as string[]) ?? []
          const summary = (evalData?.justification as string) ?? ''
          const stage = decision === 'Shortlisted' ? 'screening' : 'applied'
          const resumeId = resume.id ?? candidate_id

          if (resumeId) {
            // Update existing candidate — note: match_category is a GENERATED column, do NOT set it
            await pool.query(
              `UPDATE resumes SET
                ai_score = $1, ai_summary = $2,
                ai_skills = $3, pipeline_stage = $4,
                candidate_name = COALESCE(NULLIF(candidate_name,''), $5),
                candidate_email = COALESCE(NULLIF(candidate_email,''), $6),
                candidate_phone = COALESCE(NULLIF(candidate_phone,''), $7),
                status = 'reviewed', updated_at = NOW()
              WHERE id = $8 AND user_id = $9`,
              [score, summary, skills, stage,
               p.name ?? null, p.email ?? null, p.contact_number ?? null,
               resumeId, userId]
            )
          } else {
            // Insert new candidate row from AI screening upload
            // match_category is GENERATED from ai_score — do NOT include it
            const insertRes = await pool.query<{ id: string; short_id: string }>(
              `INSERT INTO resumes
                (user_id, job_post_id, candidate_name, candidate_email, candidate_phone,
                 file_name, raw_text, ai_score, ai_summary, ai_skills, pipeline_stage, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'reviewed')
               RETURNING id, short_id`,
              [userId,
               job_post_id || null,
               (p.name as string) || resume.filename || 'Unknown',
               (p.email as string) || null,
               (p.contact_number as string) || null,
               resume.filename || null,
               resume.text,
               score,
               summary,
               skills,
               stage]
            )
            // Attach DB ids to result so client can display them
            parsed = { ...parsed, db_id: insertRes.rows[0]?.id, short_id: insertRes.rows[0]?.short_id }
          }
        } catch (dbSaveErr) {
          console.warn('[api/screen] DB save failed (results still returned):', dbSaveErr instanceof Error ? dbSaveErr.message : dbSaveErr)
          parsed = { ...parsed, db_save_warning: 'Results generated but could not be saved. They will appear next time.' }
        }
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
