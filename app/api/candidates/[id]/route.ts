import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import {
  isValidUUID,
  sanitizeText,
  sanitizeEmail,
  sanitizeEnum,
  sanitizeStringArray,
  ValidationError,
  sanitizeCandidateProfile,
} from '@/lib/validate'
import { LIFECYCLE_STATUSES, lifecycleToPipelineStage } from '@/lib/candidateLifecycle'
import { fetchCandidateById } from '@/lib/candidateFetch'
import { cleanCandidateName } from '@/lib/nameClean'
import { formatPhoneInternational, sanitizeCandidateEmail, splitGluedPhoneFromEmail } from '@/lib/phoneFormat'
import { scheduleIndexResume } from '@/lib/rag/indexCorpus'

const VALID_STAGES = [
  'sourced', 'applied', 'new', 'screening', 'submitted', 'interview', 'offer',
  'hr_onboarding', 'joined', 'hired', 'employee', 'rejected', 'withdrawn', 'on_hold',
]
const VALID_STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired']

function parseProfile(v: unknown): Record<string, unknown> {
  if (v == null) return {}
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v)
      if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>
    } catch { /* ignore */ }
  }
  return {}
}

/** Tenant-scoped candidate read — never leak cross-tenant data (404 not 405). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { id } = await params
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
    }

    const candidate = await fetchCandidateById(ctx.tenantId, id)
    if (!candidate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Omit raw resume text from list-style GET to reduce PII exposure
    const { raw_text: _omitRaw, ...safe } = candidate
    void _omitRaw
    return NextResponse.json({ candidate: safe })
  } catch (err) {
    console.error('[api/candidates/[id]] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { id } = await params
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
    }

    const body = await req.json()
    const sanitized: Record<string, unknown> = {}
    const auditDetails: Record<string, unknown> = {}

    if (body.candidate_name !== undefined) {
      const name = cleanCandidateName(body.candidate_name, 200) || sanitizeText(body.candidate_name, 200)
      if (!name) return NextResponse.json({ error: 'candidate_name cannot be empty' }, { status: 400 })
      sanitized.candidate_name = name
      auditDetails.name_updated = true
    }

    if (body.candidate_email !== undefined) {
      if (body.candidate_email === null || body.candidate_email === '') {
        sanitized.candidate_email = null
      } else {
        const glued = splitGluedPhoneFromEmail(String(body.candidate_email))
        const email = sanitizeCandidateEmail(glued.email) || sanitizeEmail(glued.email)
        if (!email) return NextResponse.json({ error: 'Invalid candidate_email' }, { status: 400 })
        sanitized.candidate_email = email
        if (glued.phone && body.candidate_phone === undefined) {
          sanitized.candidate_phone = glued.phone.slice(0, 50)
        }
      }
      auditDetails.email_updated = true
    }

    if (body.candidate_phone !== undefined) {
      sanitized.candidate_phone = body.candidate_phone === null || body.candidate_phone === ''
        ? null
        : (formatPhoneInternational(body.candidate_phone) || sanitizeText(body.candidate_phone, 50))
      auditDetails.phone_updated = true
    }

    if (body.ai_skills !== undefined) {
      sanitized.ai_skills = sanitizeStringArray(body.ai_skills, 100, 200)
      auditDetails.skills_updated = true
    }

    if (body.pipeline_stage !== undefined) {
      const stage = sanitizeEnum(body.pipeline_stage, VALID_STAGES, null)
      if (stage === null) {
        return NextResponse.json({ error: `pipeline_stage must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
      }
      sanitized.pipeline_stage = stage
    }

    if (body.status !== undefined) {
      const st = sanitizeEnum(body.status, VALID_STATUSES, null)
      if (st === null) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
      }
      sanitized.status = st
    }

    if (body.reviewer_notes !== undefined) {
      sanitized.reviewer_notes = sanitizeText(body.reviewer_notes, 5000)
    }

    if (body.ai_score !== undefined) {
      const score = typeof body.ai_score === 'number' ? Math.min(100, Math.max(0, Math.round(body.ai_score))) : null
      sanitized.ai_score = score
    }

    if (body.ai_summary !== undefined) {
      sanitized.ai_summary = sanitizeText(body.ai_summary, 5000)
    }

    if (body.raw_text !== undefined) {
      sanitized.raw_text = body.raw_text === null || body.raw_text === ''
        ? null
        : sanitizeText(body.raw_text, 100000)
      auditDetails.raw_text_updated = true
    }

    if (body.job_post_id !== undefined) {
      if (body.job_post_id !== null && !isValidUUID(body.job_post_id)) {
        return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
      }
      if (body.job_post_id !== null) {
        const { rows: jobRows } = await pool.query(
          'SELECT id FROM job_posts WHERE id = $1 AND tenant_id = $2',
          [body.job_post_id, ctx.tenantId]
        )
        if (!jobRows[0]) return NextResponse.json({ error: 'Job post not found' }, { status: 404 })
      }
      sanitized.job_post_id = body.job_post_id
    }

    if (body.candidate_profile !== undefined) {
      if (body.candidate_profile !== null && typeof body.candidate_profile !== 'object') {
        return NextResponse.json({ error: 'candidate_profile must be an object' }, { status: 400 })
      }
      const incoming = sanitizeCandidateProfile(body.candidate_profile)
      // Merge with existing so partial saves do not wipe fields
      const { rows: existingRows } = await pool.query(
        'SELECT candidate_profile FROM resumes WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [id, ctx.tenantId]
      )
      if (!existingRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const prev = parseProfile(existingRows[0].candidate_profile)
      const merged: Record<string, unknown> = { ...prev }
      for (const [k, v] of Object.entries(incoming)) {
        // Only overwrite keys present on the request object (allow explicit clear via null/empty → null)
        if (body.candidate_profile && Object.prototype.hasOwnProperty.call(body.candidate_profile, k)) {
          merged[k] = v
        } else if (v != null && !(k in merged)) {
          merged[k] = v
        }
      }
      // Alias sync
      if (incoming.nric) {
        merged.nric = incoming.nric
        if (!merged.id_document_type) merged.id_document_type = 'NRIC'
        merged.id_document_reference = incoming.nric
      }
      if (incoming.expected_salary) {
        merged.expected_salary = incoming.expected_salary
        merged.salary_expectation = incoming.expected_salary
      }

      // Sync lifecycle → pipeline board when lifecycle changes
      const life = typeof merged.lifecycle_status === 'string' ? merged.lifecycle_status : null
      if (life && (LIFECYCLE_STATUSES as readonly string[]).includes(life) && body.pipeline_stage === undefined) {
        const mapped = lifecycleToPipelineStage(life)
        if (mapped) sanitized.pipeline_stage = mapped
      }

      sanitized.candidate_profile = JSON.stringify(merged)
      auditDetails.profile_edited = true
      if (incoming.nric) auditDetails.nric_updated = true
      if (incoming.visa_type || incoming.visa_expiry) auditDetails.visa_updated = true
      if (incoming.current_salary || incoming.expected_salary) auditDetails.salary_updated = true
      if (incoming.lifecycle_status) auditDetails.status_changed = incoming.lifecycle_status
      if (incoming.client_name) auditDetails.client_changed = incoming.client_name
    }

    if (body.user_id !== undefined) {
      if (!ctx.permissions.users.manage && ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
        return NextResponse.json({ error: 'Only workspace owner/admin can change ownership' }, { status: 403 })
      }
      if (!isValidUUID(body.user_id)) {
        return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
      }
      const { rows: memberRows } = await pool.query(
        `SELECT user_id FROM tenant_members
          WHERE tenant_id = $1 AND user_id = $2 AND invite_accepted = TRUE`,
        [ctx.tenantId, body.user_id]
      )
      if (!memberRows[0]) {
        return NextResponse.json(
          { error: 'Owner must be an accepted member of this workspace' },
          { status: 422 }
        )
      }
      sanitized.user_id = body.user_id
      auditDetails.recruiter_changed = body.user_id
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1
    for (const [key, val] of Object.entries(sanitized)) {
      if (key === 'candidate_profile') {
        sets.push(`candidate_profile = $${idx}::jsonb`)
      } else {
        sets.push(`${key} = $${idx}`)
      }
      values.push(val)
      idx++
    }
    sets.push('updated_at = NOW()')
    values.push(id)
    values.push(ctx.tenantId)

    const { rows } = await pool.query(
      `UPDATE resumes
          SET ${sets.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING id, short_id, candidate_name, candidate_email, candidate_phone,
                  pipeline_stage, status, match_category, ai_score, ai_skills,
                  candidate_profile, job_post_id, user_id, reviewer_notes, updated_at`,
      values
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (sanitized.pipeline_stage) {
      logAudit({
        userId: ctx.userId, userEmail: ctx.userEmail,
        action: 'stage_changed', resourceType: 'candidate',
        resourceId: rows[0].short_id ?? id,
        details: { stage: sanitized.pipeline_stage }, tenantId: ctx.tenantId,
      })
    }
    if (Object.keys(auditDetails).length) {
      logAudit({
        userId: ctx.userId, userEmail: ctx.userEmail,
        action: 'candidate_updated', resourceType: 'candidate',
        resourceId: rows[0].short_id ?? id,
        details: auditDetails, tenantId: ctx.tenantId,
      })
    }

    const cand = rows[0]
    if (cand.candidate_profile && typeof cand.candidate_profile === 'string') {
      try { cand.candidate_profile = JSON.parse(cand.candidate_profile) } catch { /* keep */ }
    }

    if (
      sanitized.raw_text !== undefined ||
      sanitized.ai_skills !== undefined ||
      sanitized.ai_summary !== undefined
    ) {
      scheduleIndexResume({
        tenantId: ctx.tenantId,
        resumeId: id,
        rawText: typeof sanitized.raw_text === 'string' ? sanitized.raw_text : undefined,
        skills: Array.isArray(sanitized.ai_skills) ? (sanitized.ai_skills as string[]) : undefined,
        userId: ctx.userId,
      })
    }

    return NextResponse.json({ candidate: cand })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[api/candidates/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.delete')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { id } = await params
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
    }

    const { rows } = await pool.query(
      'DELETE FROM resumes WHERE id = $1 AND tenant_id = $2 RETURNING id, short_id',
      [id, ctx.tenantId]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail,
      action: 'candidate_deleted', resourceType: 'candidate',
      resourceId: rows[0].short_id ?? id,
      details: {}, tenantId: ctx.tenantId,
    })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[api/candidates/[id]] DELETE error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
