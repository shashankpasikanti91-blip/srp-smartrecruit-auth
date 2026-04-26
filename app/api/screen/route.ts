import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { checkAiScreenLimit } from '@/lib/limits'
import { logAudit } from '@/lib/audit'

export const maxDuration = 120

// ─────────────────────────────────────────────────────────────────────────────
// SCREENING SYSTEM PROMPT v2 — Senior Recruitment Auditor AI
// Updated: 2025 — covers all industries, strict audit-grade evaluation
// ─────────────────────────────────────────────────────────────────────────────
const SCREENING_SYSTEM_PROMPT = `You are a Senior Recruitment Auditor AI.

You function as a combination of:
- Senior Recruiter
- Hiring Manager
- Background Verification Auditor

You evaluate candidates across ALL industries and roles, including:
- Blue-collar jobs (technicians, drivers, operators)
- Non-technical roles (customer service, BPO, sales, admin)
- IT & software roles (developers, cloud, data, etc.)
- Medical field (nurses, doctors, pharmacists, healthcare staff)
- Leadership roles (managers, directors, CXO level)

---

## CORE MINDSET
- Be strict, analytical, and evidence-based
- Do NOT assume missing information
- If something is not clearly mentioned → treat it as missing
- Focus on RECENT and VERIFIED experience only
- Think like a hiring panel and auditor

---

## CRITICAL RULE: EXPERIENCE ORDER & STRUCTURE
Experience MUST be in DESCENDING ORDER (latest job first, older jobs below).
If NOT in this format → Flag: "INCORRECT EXPERIENCE ORDER"

---

## MANDATORY DATE FORMAT RULE
ALL experience and education entries MUST include Month + Year (e.g., Jan 2022 – Mar 2024).
If ONLY year is mentioned → Flag: "INCOMPLETE DATE FORMAT"
Reason: Year-only format hides actual duration.

---

## EXPERIENCE VALIDATION
1. Extract Claimed Total Experience from resume text
2. Calculate Actual Experience from Month-Year timelines
3. If mismatch → Flag: EXPERIENCE INFLATION, mention exact missing duration

---

## GAP & MISSING TENURE ANALYSIS
Identify: Gaps > 6 months, missing time between jobs, after education → first job, last job → present.
Mark: "UNACCOUNTED TENURE: X months/years"

---

## CURRENT ROLE PRIORITY RULE
The MOST RECENT job carries the HIGHEST weight.
If candidate claims a skill but it is not used in current/recent role → Mark as: "OUTDATED / LOW RELEVANCE SKILL"

---

## ROLE-SPECIFIC ADAPTATION
1. Blue-collar: stability, practical experience, employment continuity
2. Customer service / BPO: communication roles, tenure stability, role consistency
3. IT / Technical: recent tech stack usage, project relevance
4. Medical: certifications, clinical experience, practice continuity
5. Leadership: career progression, team size / impact

---

## SKILL AUTHENTICITY CHECK
Skills must be backed by RECENT experience. If not → "UNVERIFIED SKILL CLAIM"

---

## EDUCATION VALIDATION
Each entry must include degree, institution, year of passout (preferably Month + Year).
If missing → Flag: "INCOMPLETE EDUCATION DETAILS"

---

## EVALUATION WEIGHTAGE
- JD Relevance: 25%
- Recent Role Strength: 20%
- Experience Consistency & Gaps: 20%
- Skill Authenticity: 10%
- Education Completeness: 10%
- Resume Structure & Format: 15%

---

## SCORING SYSTEM
- > 70 → STRONG (Hire-ready)
- 60–70 → KAV (Needs improvement / clarification)
- < 55 → REJECT (High risk / low fit)

---

## FINAL DECISION RULE
- score >= 70 → decision = "Shortlisted", classification = "STRONG", recommendation = "Hire"
- score 60–69 → decision = "Hold", classification = "KAV", recommendation = "Hold"
- score < 60 → decision = "Rejected", classification = "REJECT", recommendation = "Reject"

---

## OUTPUT FORMAT (STRICT — JSON ONLY)
Respond ONLY with valid JSON. No explanations, markdown, or extra text outside the JSON.
Do NOT change field names. All fields are required.

{
  "name": "",
  "email": "",
  "contact_number": "",
  "current_company": "",
  "score": 0,
  "classification": "STRONG",
  "decision": "Shortlisted",
  "recommendation": "Hire",
  "executive_summary": "",
  "experience_audit": {
    "claimed_years": 0,
    "calculated_years": 0,
    "difference_years": 0,
    "verdict": "Match"
  },
  "date_format_check": {
    "month_year_used": true,
    "year_only_entries": []
  },
  "experience_order": {
    "proper_descending": true,
    "flag": ""
  },
  "gap_analysis": {
    "total_missing_months": 0,
    "gaps": []
  },
  "jd_match": {
    "match_percent": 0,
    "matching_skills": [],
    "missing_skills": []
  },
  "skill_authenticity": {
    "verified": [],
    "unverified": [],
    "outdated": []
  },
  "education_check": {
    "passout_year_present": true,
    "month_available": false,
    "flag": ""
  },
  "red_flags": [],
  "required_actions": [],
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
  const ctx = await requireTenant(req, 'ai_screen.use')
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  try {
    const body = await req.json()
    const { jd_text, resumes, candidate_id, job_post_id } = body as {
      jd_text: string
      resumes: { text: string; filename?: string; id?: string }[]
      candidate_id?: string
      job_post_id?: string
    }

    if (!jd_text?.trim()) return NextResponse.json({ error: 'jd_text required' }, { status: 400 })
    if (!Array.isArray(resumes) || !resumes.length) {
      return NextResponse.json({ error: 'resumes array required' }, { status: 400 })
    }
    if (resumes.length > 50) {
      return NextResponse.json({ error: 'Max 50 resumes per batch' }, { status: 400 })
    }

    // Validate job_post_id belongs to this tenant if provided
    if (job_post_id) {
      const jpCheck = await pool.query(
        'SELECT id FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [job_post_id, tenantId]
      )
      if (!jpCheck.rows.length) {
        return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
      }
    }

    // Check monthly AI screen limit
    try {
      const limit = await checkAiScreenLimit(userId)
      if (!limit.allowed) {
        return NextResponse.json({ error: limit.reason }, { status: 403 })
      }
    } catch (limitErr) {
      console.warn('[api/screen] Could not check limit, allowing:', limitErr instanceof Error ? limitErr.message : limitErr)
    }

    const results = []
    for (const resume of resumes) {
      if (!resume.text?.trim()) { results.push({ error: 'empty resume' }); continue }

      const userMessage = `JOB DESCRIPTION:\n${jd_text.trim()}\n\nCANDIDATE RESUME:\n${resume.text.trim()}`
      let raw: string
      try {
        raw = await callAI([
          { role: 'system', content: SCREENING_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ])
      } catch (aiErr) {
        results.push({ error: aiErr instanceof Error ? aiErr.message : 'AI call failed', filename: resume.filename })
        continue
      }

      let parsed: Record<string, unknown>
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch?.[0] ?? raw)
      } catch {
        parsed = { error: 'Failed to parse AI response', raw_preview: raw.slice(0, 200) }
      }

      // Save to DB — update existing candidate OR insert new one
      // DB save failure MUST NOT block returning screening results to the user
      if (!parsed.error) {
        try {
          const p = parsed as Record<string, unknown>
          const evalData = p.evaluation as Record<string, unknown> | undefined
          const jdMatch = p.jd_match as Record<string, unknown> | undefined
          const score = typeof p.score === 'number' ? Math.min(100, Math.max(0, Math.round(p.score))) : null
          const decision = (p.decision as string) ?? ''
          // High match skills from jd_match (new format) with fallback to evaluation block (old)
          const skills: string[] = [
            ...((jdMatch?.matching_skills as string[]) ?? []),
            ...((evalData?.high_match_skills as string[]) ?? []),
          ].filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 50)
          const summary = ((evalData?.justification as string) || (p.executive_summary as string)) ?? ''
          const stage = decision === 'Shortlisted' ? 'screening' : 'applied'
          const resumeId = resume.id ?? candidate_id

          if (resumeId) {
            // Validate resumeId belongs to this tenant before updating
            const existing = await pool.query(
              'SELECT id FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
              [resumeId, tenantId]
            )
            if (existing.rows.length) {
              await pool.query(
                `UPDATE resumes SET
                  ai_score = $1, ai_summary = $2,
                  ai_skills = $3, pipeline_stage = $4,
                  ai_screening_data = $5,
                  candidate_name = COALESCE(NULLIF(candidate_name,''), $6),
                  candidate_email = COALESCE(NULLIF(candidate_email,''), $7),
                  candidate_phone = COALESCE(NULLIF(candidate_phone,''), $8),
                  status = 'reviewed', updated_at = NOW()
                WHERE id = $9 AND tenant_id = $10`,
                [score, summary.slice(0, 2000), skills, stage,
                 JSON.stringify(p),
                 p.name ?? null, p.email ?? null, p.contact_number ?? null,
                 resumeId, tenantId]
              )
              parsed = { ...parsed, db_id: resumeId }
            }
          } else {
            // Duplicate check by email within this tenant before inserting
            const candidateEmail = (p.email as string | null) || null
            let existingId: string | null = null
            if (candidateEmail?.trim()) {
              const dupCheck = await pool.query<{ id: string }>(
                `SELECT id FROM resumes WHERE tenant_id = $1 AND candidate_email = $2 LIMIT 1`,
                [tenantId, candidateEmail.trim().toLowerCase()]
              )
              if (dupCheck.rows.length) {
                existingId = dupCheck.rows[0].id
                // Merge: update existing rather than insert duplicate
                await pool.query(
                  `UPDATE resumes SET
                    ai_score = $1, ai_summary = $2, ai_skills = $3,
                    pipeline_stage = $4, status = 'reviewed',
                    ai_screening_data = $5,
                    candidate_name = COALESCE(NULLIF(candidate_name,''), $6),
                    candidate_phone = COALESCE(NULLIF(candidate_phone,''), $7),
                    updated_at = NOW()
                  WHERE id = $8 AND tenant_id = $9`,
                  [score, summary.slice(0, 2000), skills, stage,
                   JSON.stringify(p),
                   p.name ?? null, p.contact_number ?? null,
                   existingId, tenantId]
                )
                parsed = { ...parsed, db_id: existingId, is_duplicate: true }
              }
            }

            if (!existingId) {
              const insertRes = await pool.query<{ id: string; short_id: string }>(
                `INSERT INTO resumes
                  (tenant_id, user_id, job_post_id, candidate_name, candidate_email, candidate_phone,
                   file_name, raw_text, ai_score, ai_summary, ai_skills, ai_screening_data, pipeline_stage, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'reviewed')
                 RETURNING id, short_id`,
                [tenantId, userId,
                 job_post_id || null,
                 ((p.name as string) || resume.filename || 'Unknown').slice(0, 200),
                 candidateEmail?.toLowerCase() ?? null,
                 (p.contact_number as string | null)?.slice(0, 50) ?? null,
                 resume.filename?.slice(0, 255) || null,
                 resume.text.slice(0, 100000),
                 score,
                 summary.slice(0, 2000),
                 skills,
                 JSON.stringify(p),
                 stage]
              )
              parsed = { ...parsed, db_id: insertRes.rows[0]?.id, short_id: insertRes.rows[0]?.short_id }
            }
          }
        } catch (dbSaveErr) {
          console.warn('[api/screen] DB save failed (results still returned):', dbSaveErr instanceof Error ? dbSaveErr.message : dbSaveErr)
          parsed = { ...parsed, db_save_warning: 'Results generated but could not be saved to database.' }
        }
      }

      results.push({ ...parsed, filename: resume.filename, screened_at: new Date().toISOString() })
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/screen]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
