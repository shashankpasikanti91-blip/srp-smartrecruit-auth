import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { checkAiScreenLimit } from '@/lib/limits'
import { logAudit } from '@/lib/audit'
import { isValidUUID } from '@/lib/validate'
import { extractResumeFields } from '@/lib/resumeExtract'
import { writeTimeline } from '@/lib/timelineEngine'
import { createNotification } from '@/lib/notificationCenter'
import { chatCompletion } from '@/lib/aiClient'
import { buildJdFromJobRow } from '@/lib/jobScreeningContext'
import { advanceFromDomain } from '@/lib/lifecycle'
import { assertFeatureEnabled, assertNotMaintenance } from '@/lib/featureFlags'

/** AI models sometimes return score as a string — DB ai_score must be numeric for match_category. */
function normalizeScreeningScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)))
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, '').trim())
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, Math.round(n)))
  }
  return null
}

export const maxDuration = 300

const SCREEN_CONCURRENCY = 5
const RESUME_MAX_CHARS = 10_000
const JD_MAX_CHARS = 8_000
const AI_TIMEOUT_MS = 60_000

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
    "missing_skills": [],
    "optional_skills_match": []
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

async function callAI(messages: { role: string; content: string }[], timeoutMs = AI_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await chatCompletion({
      messages,
      temperature: 0.2,
      max_tokens: 2000,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

type ResumeInput = { text: string; filename: string; id?: string }

function normalizeResumeInputs(body: Record<string, unknown>): ResumeInput[] {
  const raw = (body.resumes ?? body.candidates) as unknown
  if (!Array.isArray(raw)) return []

  const out: ResumeInput[] = []
  for (let idx = 0; idx < raw.length; idx++) {
    const item = raw[idx]
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const text = String(row.text ?? row.resume ?? row.content ?? '').trim()
    if (!text) continue
    const filename = String(row.filename ?? row.name ?? `resume_${idx + 1}`).slice(0, 255)
    const id = typeof row.id === 'string' ? row.id : undefined
    out.push({ text, filename, id })
  }
  return out
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

async function processOneResume(
  resume: ResumeInput,
  opts: {
    jdForModel: string
    tenantId: string
    userId: string
    userEmail: string
    jobPostId?: string
    candidateId?: string
  },
): Promise<Record<string, unknown>> {
  if (!resume.text?.trim()) {
    return { error: 'empty resume', filename: resume.filename, screened_at: new Date().toISOString() }
  }

  const resumeText = resume.text.trim().slice(0, RESUME_MAX_CHARS)
  const userMessage = `JOB DESCRIPTION:\n${opts.jdForModel}\n\nCANDIDATE RESUME:\n${resumeText}`
  let raw: string
  try {
    raw = await callAI([
      { role: 'system', content: SCREENING_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ])
  } catch (aiErr) {
    return {
      error: aiErr instanceof Error ? aiErr.message : 'AI call failed',
      filename: resume.filename,
      screened_at: new Date().toISOString(),
    }
  }

  let parsed: Record<string, unknown>
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? raw)
  } catch {
    parsed = { error: 'Failed to parse AI response', raw_preview: raw.slice(0, 200) }
  }

  if (!parsed.error && typeof parsed === 'object' && parsed !== null) {
    const coerced = normalizeScreeningScore(parsed.score)
    if (coerced != null) parsed.score = coerced
  }

  if (!parsed.error) {
    try {
      const p = parsed
      const extracted = extractResumeFields(resumeText, resume.filename)
      if (!(p.name as string)?.trim() && extracted.name) p.name = extracted.name
      if (!(p.email as string)?.trim() && extracted.email) p.email = extracted.email
      if (!(p.contact_number as string)?.trim() && extracted.phone) p.contact_number = extracted.phone

      const evalData = p.evaluation as Record<string, unknown> | undefined
      const jdMatch = p.jd_match as Record<string, unknown> | undefined
      const score = normalizeScreeningScore(p.score)
      const decision = (p.decision as string) ?? ''
      const skills: string[] = [
        ...((jdMatch?.matching_skills as string[]) ?? []),
        ...((evalData?.high_match_skills as string[]) ?? []),
      ].filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 50)
      const summary = ((evalData?.justification as string) || (p.executive_summary as string)) ?? ''
      const stage = decision === 'Shortlisted' ? 'screening' : 'applied'
      const resumeId = resume.id ?? opts.candidateId

      const resolvedName = ((p.name as string)?.trim()
        || extracted.name
        || resume.filename?.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
        || 'Unknown Candidate').slice(0, 200)

      if (resumeId) {
        const existing = await pool.query(
          'SELECT id FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
          [resumeId, opts.tenantId]
        )
        if (existing.rows.length) {
          await pool.query(
            `UPDATE resumes SET
              ai_score = $1, ai_summary = $2,
              ai_skills = $3, pipeline_stage = $4,
              ai_screening_data = $5,
              candidate_name = $6,
              candidate_email = COALESCE(NULLIF($7::text, ''), candidate_email),
              candidate_phone = COALESCE(NULLIF($8::text, ''), candidate_phone),
              job_post_id = COALESCE($9::uuid, job_post_id),
              status = 'reviewed', updated_at = NOW()
            WHERE id = $10 AND tenant_id = $11`,
            [score, summary.slice(0, 2000), skills, stage,
             JSON.stringify(p),
             resolvedName,
             ((p.email as string) || extracted.email || null),
             ((p.contact_number as string) || extracted.phone || null),
             opts.jobPostId && isValidUUID(opts.jobPostId) ? opts.jobPostId : null,
             resumeId, opts.tenantId]
          )
          parsed = { ...parsed, db_id: resumeId }
        }
      } else {
        const candidateEmail = ((p.email as string | null) || extracted.email || null)
        let existingId: string | null = null
        if (candidateEmail?.trim()) {
          const dupCheck = await pool.query<{ id: string }>(
            `SELECT id FROM resumes WHERE tenant_id = $1 AND candidate_email = $2 LIMIT 1`,
            [opts.tenantId, candidateEmail.trim().toLowerCase()]
          )
          if (dupCheck.rows.length) {
            existingId = dupCheck.rows[0].id
            await pool.query(
              `UPDATE resumes SET
                ai_score = $1, ai_summary = $2, ai_skills = $3,
                pipeline_stage = $4, status = 'reviewed',
                ai_screening_data = $5,
                candidate_name = $6,
                candidate_phone = COALESCE(NULLIF($7::text, ''), candidate_phone),
                job_post_id = COALESCE($8::uuid, job_post_id),
                updated_at = NOW()
              WHERE id = $9 AND tenant_id = $10`,
              [score, summary.slice(0, 2000), skills, stage,
               JSON.stringify(p),
               resolvedName,
               ((p.contact_number as string) || extracted.phone || null),
               opts.jobPostId && isValidUUID(opts.jobPostId) ? opts.jobPostId : null,
               existingId, opts.tenantId]
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
            [opts.tenantId, opts.userId,
             opts.jobPostId || null,
             resolvedName,
             candidateEmail?.toLowerCase() ?? null,
             ((p.contact_number as string | null) || extracted.phone)?.slice(0, 50) ?? null,
             resume.filename?.slice(0, 255) || null,
             resumeText.slice(0, 100000),
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

  return { ...parsed, filename: resume.filename, screened_at: new Date().toISOString() }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ai_screen.use')
  if (ctx instanceof NextResponse) return ctx

  const maintenance = await assertNotMaintenance(ctx.userEmail)
  if (maintenance) return maintenance
  const featureOff = await assertFeatureEnabled('ai_screening', true)
  if (featureOff) return featureOff

  const { userId, tenantId } = ctx

  try {
    const body = await req.json()
    const { jd_text, candidate_id, job_post_id } = body as {
      jd_text?: string
      resumes?: ResumeInput[]
      candidates?: ResumeInput[]
      candidate_id?: string
      job_post_id?: string
    }
    const resumes = normalizeResumeInputs(body as Record<string, unknown>)

    // Resolve JD: explicit text and/or full job context (raw_jd_text preferred)
    let jdForModel = (jd_text ?? '').trim()
    if (job_post_id && isValidUUID(job_post_id)) {
      const jp = await pool.query(
        `SELECT title, company, client_name, location, type, employment_type,
                experience_min, experience_max, description, requirements,
                optional_requirements, raw_jd_text, skills_mandatory, skills_required,
                tags, screening_questions
         FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [job_post_id, tenantId],
      )
      const row = jp.rows[0]
      if (!row) {
        return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
      }
      const fromJob = buildJdFromJobRow(row)
      if (!jdForModel) {
        jdForModel = fromJob
      } else if (fromJob) {
        jdForModel = `${jdForModel}\n\n---\n${fromJob}`
      }
    }

    if (!jdForModel.trim()) {
      return NextResponse.json(
        { error: 'Select a job with a JD or provide jd_text' },
        { status: 400 },
      )
    }
    jdForModel = jdForModel.slice(0, JD_MAX_CHARS)

    if (!Array.isArray(resumes) || !resumes.length) {
      return NextResponse.json({ error: 'resumes array required (each item needs text)' }, { status: 400 })
    }
    if (resumes.length > 50) {
      return NextResponse.json({ error: 'Max 50 resumes per batch' }, { status: 400 })
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

    const results = await mapWithConcurrency(resumes, SCREEN_CONCURRENCY, (resume) =>
      processOneResume(resume, {
        jdForModel,
        tenantId,
        userId,
        userEmail: ctx.userEmail,
        jobPostId: job_post_id,
        candidateId: candidate_id,
      }),
    )

    // Advance lifecycle to screening for saved candidates
    for (const row of results as Record<string, unknown>[]) {
      if (typeof row.db_id === 'string') {
        await advanceFromDomain({
          tenantId,
          resumeId: row.db_id,
          toStage: 'screening',
          jobPostId: job_post_id && isValidUUID(job_post_id) ? job_post_id : null,
          relatedEntityType: 'screening',
          relatedEntityId: row.db_id,
          actorUserId: userId,
          actorEmail: ctx.userEmail,
          reason: 'ai_screening',
        })
      }
    }

    const saved = (results as Record<string, unknown>[]).filter(
      (r): r is Record<string, unknown> & { db_id: string } =>
        typeof r.db_id === 'string' && r.db_id.length > 0
    )
    for (const row of saved) {
      const displayName = (row.candidate_name || row.name) as string | undefined
      const score = typeof row.score === 'number' ? row.score : undefined
      const shortId = typeof row.short_id === 'string' ? row.short_id : undefined
      const filename = typeof row.filename === 'string' ? row.filename : undefined
      await writeTimeline({
        tenantId,
        entityType: 'candidate',
        entityId: row.db_id,
        resumeId: row.db_id,
        eventType: 'candidate_screened',
        title: 'AI Screening Completed',
        detail: displayName
          ? `${displayName}${score != null ? ` · score ${score}` : ''}`
          : filename ?? 'Screened',
        actorUserId: userId,
        actorEmail: ctx.userEmail,
        meta: { score, short_id: shortId },
      })
      await logAudit({
        userId,
        userEmail: ctx.userEmail,
        tenantId,
        action: 'candidate_screened',
        resourceType: 'candidate',
        resourceId: shortId ?? row.db_id,
        resumeId: row.db_id,
        details: { score, filename },
      })
    }
    if (saved.length > 0) {
      await createNotification({
        tenantId,
        userId,
        category: 'screening',
        title: `Screening complete — ${saved.length} candidate${saved.length === 1 ? '' : 's'}`,
        body: 'AI screening results saved to Candidate 360',
        entityType: 'candidate',
        entityId: saved[0].db_id,
      })
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/screen]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
