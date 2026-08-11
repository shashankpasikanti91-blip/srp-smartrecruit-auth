import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { extractResumeFields } from '@/lib/resumeExtract'
import { writeTimeline } from '@/lib/timelineEngine'
import { logAudit } from '@/lib/audit'
import { advanceFromDomain } from '@/lib/lifecycle'
import { assertFeatureEnabled, assertNotMaintenance } from '@/lib/featureFlags'
import { syncResumeToDocumentSlot } from '@/lib/resumeDocumentSync'
import { normalizeDecisionBands } from '@/lib/screeningTypes'

function normalizeScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)))
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, '').trim())
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, Math.round(n)))
  }
  return null
}

/**
 * Persist a draft screening result (Save Candidate).
 * Accepts JSON or multipart (file + result JSON).
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ai_screen.use')
  if (ctx instanceof NextResponse) return ctx

  const maintenance = await assertNotMaintenance(ctx.userEmail)
  if (maintenance) return maintenance
  const featureOff = await assertFeatureEnabled('ai_screening', true)
  if (featureOff) return featureOff

  let result: Record<string, unknown>
  let rawText = ''
  let filename = 'resume.txt'
  let jobPostId: string | undefined
  let uploadFile: File | null = null

  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const resultRaw = form.get('result')
      if (typeof resultRaw !== 'string') {
        return NextResponse.json({ error: 'result JSON required' }, { status: 400 })
      }
      result = JSON.parse(resultRaw) as Record<string, unknown>
      rawText = String(form.get('raw_text') ?? result.raw_text ?? '')
      filename = String(form.get('filename') ?? result.filename ?? 'resume.txt').slice(0, 255)
      const jp = form.get('job_post_id')
      if (typeof jp === 'string' && isValidUUID(jp)) jobPostId = jp
      const f = form.get('file')
      if (f && typeof f === 'object' && 'arrayBuffer' in f) uploadFile = f as File
    } else {
      const body = await req.json()
      result = (body.result ?? body) as Record<string, unknown>
      rawText = String(body.raw_text ?? result.raw_text ?? '')
      filename = String(body.filename ?? result.filename ?? 'resume.txt').slice(0, 255)
      if (typeof body.job_post_id === 'string' && isValidUUID(body.job_post_id)) {
        jobPostId = body.job_post_id
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!result || typeof result !== 'object' || result.error) {
    return NextResponse.json({ error: 'Valid screening result required' }, { status: 400 })
  }
  if (!rawText.trim()) {
    return NextResponse.json({ error: 'raw_text required to save candidate resume' }, { status: 400 })
  }

  // Already persisted
  if (typeof result.db_id === 'string' && isValidUUID(result.db_id)) {
    return NextResponse.json({
      ok: true,
      db_id: result.db_id,
      short_id: result.short_id,
      already_saved: true,
      result,
    })
  }

  const extracted = extractResumeFields(rawText, filename)
  const p = { ...result }
  if (!(p.name as string)?.trim() && extracted.name) p.name = extracted.name
  if (!(p.email as string)?.trim() && extracted.email) p.email = extracted.email
  if (!(p.contact_number as string)?.trim() && extracted.phone) p.contact_number = extracted.phone

  const score = normalizeScore(p.score)
  if (score != null) {
    p.score = score
    const bands = normalizeDecisionBands(score)
    if (!p.decision) p.decision = bands.decision
    if (!p.classification) p.classification = bands.classification
    if (!p.recommendation) p.recommendation = bands.recommendation
  }

  const evalData = p.evaluation as Record<string, unknown> | undefined
  const jdMatch = p.jd_match as Record<string, unknown> | undefined
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
  const resolvedName = ((p.name as string)?.trim()
    || extracted.name
    || filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
    || 'Unknown Candidate').slice(0, 200)
  const candidateEmail = ((p.email as string | null) || extracted.email || null)?.toLowerCase() ?? null
  const audit = p.experience_audit as { current_employer?: string; current_role?: string; calculated_years?: number } | undefined
  const profilePatch = {
    current_title: String(p.current_designation || audit?.current_role || '').trim() || null,
    current_company: String(p.current_company || audit?.current_employer || '').trim() || null,
    total_experience: audit?.calculated_years != null ? String(audit.calculated_years) : null,
  }

  let dbId: string | undefined
  let shortId: string | undefined
  let isDuplicate = false

  try {
    if (candidateEmail?.trim()) {
      const dup = await pool.query<{ id: string; short_id: string }>(
        `SELECT id, short_id FROM resumes WHERE tenant_id = $1 AND candidate_email = $2 LIMIT 1`,
        [ctx.tenantId, candidateEmail.trim()],
      )
      if (dup.rows[0]) {
        dbId = dup.rows[0].id
        shortId = dup.rows[0].short_id
        isDuplicate = true
        await pool.query(
          `UPDATE resumes SET
            ai_score = $1, ai_summary = $2, ai_skills = $3,
            pipeline_stage = $4, status = 'reviewed',
            ai_screening_data = $5,
            candidate_name = $6,
            candidate_phone = COALESCE(NULLIF($7::text, ''), candidate_phone),
            job_post_id = COALESCE($8::uuid, job_post_id),
            raw_text = COALESCE(NULLIF($9::text, ''), raw_text),
            candidate_profile = COALESCE(candidate_profile, '{}'::jsonb) || $10::jsonb,
            updated_at = NOW()
          WHERE id = $11 AND tenant_id = $12`,
          [
            score, summary.slice(0, 4000), skills, stage,
            JSON.stringify(p), resolvedName,
            ((p.contact_number as string) || extracted.phone || null),
            jobPostId ?? null,
            rawText.slice(0, 100000),
            JSON.stringify(profilePatch),
            dbId, ctx.tenantId,
          ],
        )
      }
    }

    if (!dbId) {
      const insertRes = await pool.query<{ id: string; short_id: string }>(
        `INSERT INTO resumes
          (tenant_id, user_id, job_post_id, candidate_name, candidate_email, candidate_phone,
           file_name, raw_text, ai_score, ai_summary, ai_skills, ai_screening_data, candidate_profile,
           pipeline_stage, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'reviewed')
         RETURNING id, short_id`,
        [
          ctx.tenantId, ctx.userId, jobPostId ?? null,
          resolvedName, candidateEmail,
          ((p.contact_number as string | null) || extracted.phone)?.slice(0, 50) ?? null,
          filename,
          rawText.slice(0, 100000),
          score, summary.slice(0, 4000), skills,
          JSON.stringify(p), JSON.stringify(profilePatch), stage,
        ],
      )
      dbId = insertRes.rows[0]?.id
      shortId = insertRes.rows[0]?.short_id
    }
  } catch (e) {
    console.error('[api/screen/save] DB error', e)
    return NextResponse.json({ error: 'Could not save candidate' }, { status: 500 })
  }

  if (!dbId) {
    return NextResponse.json({ error: 'Could not save candidate' }, { status: 500 })
  }

  // Ensure Resume preview has a file (uploaded original or generated TXT from raw_text)
  try {
    let file = uploadFile
    if (!file) {
      const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' })
      const safeName = filename.toLowerCase().match(/\.(pdf|docx?|txt)$/)
        ? filename.replace(/\.(pdf|docx?)$/i, '.txt')
        : `${filename.replace(/\.[^.]+$/, '') || 'resume'}.txt`
      file = new File([blob], safeName.endsWith('.txt') ? safeName : `${safeName}.txt`, {
        type: 'text/plain',
      })
    }
    await syncResumeToDocumentSlot({
      tenantId: ctx.tenantId,
      resumeId: dbId,
      shortId: shortId || dbId.slice(0, 8),
      userId: ctx.userId,
      storagePath: '',
      fileName: file.name,
      fileSize: file.size,
      file,
    })
  } catch (fileErr) {
    console.warn('[api/screen/save] resume file attach failed:', fileErr instanceof Error ? fileErr.message : fileErr)
  }

  await advanceFromDomain({
    tenantId: ctx.tenantId,
    resumeId: dbId,
    toStage: 'screening',
    jobPostId: jobPostId ?? null,
    relatedEntityType: 'screening',
    relatedEntityId: dbId,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    reason: 'ai_screening_save',
  }).catch(() => null)

  await writeTimeline({
    tenantId: ctx.tenantId,
    entityType: 'candidate',
    entityId: dbId,
    resumeId: dbId,
    eventType: 'candidate_screened',
    title: 'AI Screening Saved',
    detail: `${resolvedName}${score != null ? ` · score ${score}` : ''}`,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    meta: { score, short_id: shortId },
  }).catch(() => null)

  await logAudit({
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    tenantId: ctx.tenantId,
    action: 'ai_screen_saved',
    resourceType: 'candidate',
    resourceId: shortId || dbId,
    details: { score, is_duplicate: isDuplicate },
  }).catch(() => null)

  const saved = {
    ...p,
    db_id: dbId,
    short_id: shortId,
    filename,
    raw_text: rawText,
    persisted: true,
    draft: false,
    is_duplicate: isDuplicate,
    screened_at: new Date().toISOString(),
  }

  return NextResponse.json({ ok: true, db_id: dbId, short_id: shortId, is_duplicate: isDuplicate, result: saved })
}
