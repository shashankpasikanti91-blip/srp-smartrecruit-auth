import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { checkAiScreenLimit } from '@/lib/limits'
import { logAudit } from '@/lib/audit'
import { isValidUUID } from '@/lib/validate'
import { extractResumeFields } from '@/lib/resumeExtract'
import { writeTimeline } from '@/lib/timelineEngine'
import { createNotification } from '@/lib/notificationCenter'
import { chatCompletionWithUsage } from '@/lib/aiClient'
import { notifyError } from '@/lib/notifications'
import { recordAiUsage } from '@/lib/aiUsage'
import { buildJdFromJobRow, fetchJobJdSource } from '@/lib/jobScreeningContext'
import { advanceFromDomain } from '@/lib/lifecycle'
import { assertFeatureEnabled, assertNotMaintenance } from '@/lib/featureFlags'
import { normalizeDecisionBands } from '@/lib/screeningTypes'

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
const RESUME_MAX_CHARS = 12_000
const JD_MAX_CHARS = 8_000
const AI_TIMEOUT_MS = 90_000

// ─────────────────────────────────────────────────────────────────────────────
// SCREENING SYSTEM PROMPT v2.0 — Enterprise Recruitment Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────
const SCREENING_SYSTEM_PROMPT = `You are Smart Recruit AI Screening v2.0 — an Enterprise Recruitment Intelligence Engine.

You think as: Senior Recruiter + Hiring Manager + Background Verification Auditor + HR Manager + Technical Interview Panel + Talent Acquisition Lead.

RULES:
- Evidence-based only. Never invent facts not in the JD or resume.
- If information is missing, mark it missing — do not assume.
- First analyse the JD (JD Intelligence), then evaluate the resume against it.
- Recent experience weighting: Current role 40%, Last role 25%, Previous 20%, Older 15%.
- Skills listed only in a Skills section without experience evidence = Unverified.

## SCORING WEIGHTS
- JD Match: 25%
- Recent Experience: 20%
- Mandatory Skills: 20%
- Strong Skills: 10%
- Resume Quality: 10%
- Education: 5%
- Career Stability: 5%
- Projects: 5%

## DECISION BANDS (mandatory)
- score >= 85 → decision "Excellent", classification "EXCELLENT", recommendation "Hire"
- score 70–84 → decision "Shortlisted", classification "STRONG", recommendation "Hire"
- score 60–69 → decision "Hold", classification "KAV", recommendation "Hold"
- score < 60 → decision "Rejected", classification "REJECT", recommendation "Reject"

## RISK
risk_level must be one of: Low | Medium | High | Very High

## REASONING
evaluation.justification AND hiring_reasoning must each be detailed recruiter prose (minimum 250 words combined across both; prefer hiring_reasoning >= 250 words). Cover match reasons, fail reasons, business/technical risks, interview and hiring recommendation, future suitability.

## OUTPUT — JSON ONLY (no markdown). Keep ALL legacy fields AND fill new v2 fields.

{
  "name": "",
  "email": "",
  "contact_number": "",
  "current_company": "",
  "current_designation": "",
  "score": 0,
  "resume_score": 0,
  "interview_probability": 0,
  "offer_probability": 0,
  "classification": "STRONG",
  "decision": "Shortlisted",
  "recommendation": "Hire",
  "executive_summary": "",
  "hiring_reasoning": "",
  "jd_intelligence": {
    "job_summary": "",
    "job_title": "",
    "industry": "",
    "department": "",
    "employment_type": "",
    "seniority": "",
    "minimum_experience": "",
    "education_requirement": "",
    "mandatory": [],
    "strong": [],
    "preferred": [],
    "soft_skills": [],
    "business_responsibilities": []
  },
  "mandatory_requirements": [
    { "name": "", "tier": "mandatory", "status": "matched|missing|partial", "confidence": 0, "evidence": "" }
  ],
  "strong_skills": [],
  "preferred_skills": [],
  "skill_evidence": [
    { "skill": "", "company": "", "role": "", "dates": "", "quote": "", "verified": true }
  ],
  "experience_audit": {
    "claimed_years": 0,
    "calculated_years": 0,
    "difference_years": 0,
    "verdict": "Match|Mismatch",
    "recent": true,
    "chronological": true,
    "current_employer": "",
    "current_role": ""
  },
  "date_format_check": { "month_year_used": true, "year_only_entries": [] },
  "experience_order": { "proper_descending": true, "flag": "" },
  "gap_analysis": { "total_missing_months": 0, "gaps": [] },
  "jd_match": {
    "match_percent": 0,
    "matching_skills": [],
    "missing_skills": [],
    "optional_skills_match": []
  },
  "skill_authenticity": { "verified": [], "unverified": [], "outdated": [] },
  "education_check": {
    "degree_present": true,
    "passout_year_present": true,
    "month_available": false,
    "flag": ""
  },
  "resume_audit": {
    "experience_order_ok": true,
    "date_format_ok": true,
    "grammar_ok": true,
    "formatting_ok": true,
    "education_complete": true,
    "quantified_achievements": false,
    "technical_detail_ok": true,
    "resume_length_ok": true,
    "overall_quality_score": 0,
    "notes": []
  },
  "red_flags": [],
  "required_actions": [],
  "required_improvements": [],
  "recruiter_recommendation": {
    "suitable_roles": [],
    "interview_recommendation": "",
    "hiring_recommendation": "",
    "training_recommendation": ""
  },
  "evaluation": {
    "candidate_strengths": [],
    "high_match_skills": [],
    "medium_match_skills": [],
    "low_or_missing_match_skills": [],
    "candidate_weaknesses": [],
    "risk_level": "Medium",
    "risk_explanation": "",
    "reward_level": "",
    "reward_explanation": "",
    "overall_fit_rating": 0,
    "justification": ""
  }
}`

async function callAI(messages: { role: string; content: string }[], timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await chatCompletionWithUsage({
      messages,
      temperature: 0.2,
      max_tokens: 4500,
      signal: controller.signal,
      response_format: { type: 'json_object' },
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
    force?: boolean
    /** When false, skip INSERT for new candidates (Save/Discard preview). Existing IDs still update. */
    persist?: boolean
  },
): Promise<Record<string, unknown>> {
  if (!resume.text?.trim()) {
    return { error: 'empty resume', filename: resume.filename, screened_at: new Date().toISOString() }
  }

  // Existing candidates always update in place. New uploads persist only when explicitly requested.
  const resumeId = resume.id ?? opts.candidateId
  const persist = Boolean(resumeId) || opts.persist === true

  // Cache hit: return existing screening unless force
  if (!opts.force && resumeId) {
    try {
      const { rows } = await pool.query(
        `SELECT id, short_id, candidate_name, ai_score, ai_summary, ai_skills, ai_screening_data, updated_at, raw_text
         FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [resumeId, opts.tenantId],
      )
      const existing = rows[0]
      if (existing?.ai_screening_data) {
        const data = typeof existing.ai_screening_data === 'object'
          ? existing.ai_screening_data as Record<string, unknown>
          : {}
        return {
          ...data,
          db_id: existing.id,
          short_id: existing.short_id,
          candidate_name: existing.candidate_name,
          score: existing.ai_score ?? data.score,
          filename: resume.filename,
          raw_text: existing.raw_text ?? resume.text,
          cached: true,
          persisted: true,
          draft: false,
          generation: {
            status: 'completed',
            generated_at: existing.updated_at,
          },
          screened_at: existing.updated_at,
        }
      }
    } catch { /* continue to screen */ }
  }

  const resumeText = resume.text.trim().slice(0, RESUME_MAX_CHARS)
  const userMessage = `JOB DESCRIPTION:\n${opts.jdForModel}\n\nCANDIDATE RESUME:\n${resumeText}`
  let ai
  try {
    ai = await callAI([
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

  const raw = ai.content
  let parsed: Record<string, unknown>
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? raw)
  } catch {
    parsed = { error: 'Failed to parse AI response', raw_preview: raw.slice(0, 200) }
  }

  if (!parsed.error && typeof parsed === 'object' && parsed !== null) {
    const coerced = normalizeScreeningScore(parsed.score)
    if (coerced != null) {
      parsed.score = coerced
      const bands = normalizeDecisionBands(coerced)
      if (!parsed.decision) parsed.decision = bands.decision
      if (!parsed.classification) parsed.classification = bands.classification
      if (!parsed.recommendation) parsed.recommendation = bands.recommendation
    }
  }

  await recordAiUsage({
    userId: opts.userId,
    tenantId: opts.tenantId,
    operation: 'ai_screen',
    result: ai,
    metadata: {
      resume_id: resumeId ?? null,
      job_post_id: opts.jobPostId ?? null,
      force: Boolean(opts.force),
      persist,
    },
  })

  // Preview-only for brand-new uploads (no resume id)
  if (!parsed.error && !persist && !resumeId) {
    const extracted = extractResumeFields(resumeText, resume.filename)
    if (!(parsed.name as string)?.trim() && extracted.name) parsed.name = extracted.name
    if (!(parsed.email as string)?.trim() && extracted.email) parsed.email = extracted.email
    if (!(parsed.contact_number as string)?.trim() && extracted.phone) parsed.contact_number = extracted.phone
    return {
      ...parsed,
      filename: resume.filename,
      raw_text: resumeText,
      screened_at: new Date().toISOString(),
      cached: false,
      persisted: false,
      draft: true,
      generation: {
        status: 'completed',
        generated_at: new Date().toISOString(),
        model: ai.model,
        tokens: ai.total_tokens,
        duration_ms: ai.duration_ms,
      },
    }
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
        ...((p.strong_skills as string[]) ?? []),
      ].filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 50)
      const summary = (
        (p.hiring_reasoning as string)
        || (evalData?.justification as string)
        || (p.executive_summary as string)
        || ''
      )
      const stage = decision === 'Shortlisted' || decision === 'Excellent' ? 'screening' : 'applied'
      const resolvedResumeId = resume.id ?? opts.candidateId

      const resolvedName = ((p.name as string)?.trim()
        || extracted.name
        || resume.filename?.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
        || 'Unknown Candidate').slice(0, 200)

      const audit = p.experience_audit as { current_employer?: string; current_role?: string; calculated_years?: number } | undefined
      const profilePatch = {
        current_title: String(p.current_designation || audit?.current_role || '').trim() || null,
        current_company: String(p.current_company || audit?.current_employer || '').trim() || null,
        total_experience: audit?.calculated_years != null ? String(audit.calculated_years) : null,
      }

      if (resolvedResumeId) {
        const existing = await pool.query(
          'SELECT id, candidate_profile FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
          [resolvedResumeId, opts.tenantId]
        )
        if (existing.rows.length) {
          const prevProf = typeof existing.rows[0].candidate_profile === 'object' && existing.rows[0].candidate_profile
            ? existing.rows[0].candidate_profile as Record<string, unknown>
            : {}
          await pool.query(
            `UPDATE resumes SET
              ai_score = $1, ai_summary = $2,
              ai_skills = $3, pipeline_stage = $4,
              ai_screening_data = $5,
              candidate_name = $6,
              candidate_email = COALESCE(NULLIF($7::text, ''), candidate_email),
              candidate_phone = COALESCE(NULLIF($8::text, ''), candidate_phone),
              job_post_id = COALESCE($9::uuid, job_post_id),
              candidate_profile = COALESCE(candidate_profile, '{}'::jsonb) || $12::jsonb,
              status = 'reviewed', updated_at = NOW()
            WHERE id = $10 AND tenant_id = $11`,
            [score, summary.slice(0, 4000), skills, stage,
             JSON.stringify(p),
             resolvedName,
             ((p.email as string) || extracted.email || null),
             ((p.contact_number as string) || extracted.phone || null),
             opts.jobPostId && isValidUUID(opts.jobPostId) ? opts.jobPostId : null,
             resolvedResumeId, opts.tenantId,
             JSON.stringify({ ...prevProf, ...profilePatch })]
          )
          parsed = { ...parsed, db_id: resolvedResumeId, persisted: true, draft: false }
        }
      } else if (persist) {
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
                candidate_profile = COALESCE(candidate_profile, '{}'::jsonb) || $11::jsonb,
                updated_at = NOW()
              WHERE id = $9 AND tenant_id = $10`,
              [score, summary.slice(0, 4000), skills, stage,
               JSON.stringify(p),
               resolvedName,
               ((p.contact_number as string) || extracted.phone || null),
               opts.jobPostId && isValidUUID(opts.jobPostId) ? opts.jobPostId : null,
               existingId, opts.tenantId,
               JSON.stringify(profilePatch)]
            )
            parsed = { ...parsed, db_id: existingId, is_duplicate: true, persisted: true, draft: false }
          }
        }

        if (!existingId) {
          const insertRes = await pool.query<{ id: string; short_id: string }>(
            `INSERT INTO resumes
              (tenant_id, user_id, job_post_id, candidate_name, candidate_email, candidate_phone,
               file_name, raw_text, ai_score, ai_summary, ai_skills, ai_screening_data, candidate_profile,
               pipeline_stage, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'reviewed')
             RETURNING id, short_id`,
            [opts.tenantId, opts.userId,
             opts.jobPostId || null,
             resolvedName,
             candidateEmail?.toLowerCase() ?? null,
             ((p.contact_number as string | null) || extracted.phone)?.slice(0, 50) ?? null,
             resume.filename?.slice(0, 255) || null,
             resumeText.slice(0, 100000),
             score,
             summary.slice(0, 4000),
             skills,
             JSON.stringify(p),
             JSON.stringify(profilePatch),
             stage]
          )
          parsed = {
            ...parsed,
            db_id: insertRes.rows[0]?.id,
            short_id: insertRes.rows[0]?.short_id,
            persisted: true,
            draft: false,
          }
        }
      }
    } catch (dbSaveErr) {
      console.warn('[api/screen] DB save failed (results still returned):', dbSaveErr instanceof Error ? dbSaveErr.message : dbSaveErr)
      parsed = { ...parsed, db_save_warning: 'Results generated but could not be saved to database.' }
    }
  }

  return {
    ...parsed,
    filename: resume.filename,
    raw_text: resumeText,
    screened_at: new Date().toISOString(),
    cached: false,
    persisted: Boolean(parsed.db_id),
    draft: !parsed.db_id,
    generation: {
      status: 'completed',
      generated_at: new Date().toISOString(),
      model: ai.model,
      tokens: ai.total_tokens,
      duration_ms: ai.duration_ms,
    },
  }
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
    const { jd_text, candidate_id, job_post_id, force, persist } = body as {
      jd_text?: string
      resumes?: ResumeInput[]
      candidates?: ResumeInput[]
      candidate_id?: string
      job_post_id?: string
      force?: boolean
      /** Explicit save for new uploads. Existing resume ids always update in place. */
      persist?: boolean
    }
    const resumes = normalizeResumeInputs(body as Record<string, unknown>)

    // Resolve JD: explicit text and/or full job context (raw_jd_text preferred).
    // fetchJobJdSource uses SELECT * so missing optional columns never fail screening.
    let jdForModel = (jd_text ?? '').trim()
    if (job_post_id && isValidUUID(job_post_id)) {
      const row = await fetchJobJdSource(pool, tenantId, job_post_id)
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
        force: Boolean(force),
        persist: persist === true,
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
    void notifyError({
      message: `AI Screening failed: ${msg}`,
      email: undefined,
      severity: 'critical',
    }).catch(() => null)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
