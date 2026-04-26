import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { isValidUUID, sanitizeText, sanitizeEnum, ValidationError } from '@/lib/validate'

// Allowed fields that PATCH may update
const PATCH_ALLOWED = [
  'pipeline_stage',
  'status',
  'reviewer_notes',
  'ai_score',
  'ai_summary',
  'job_post_id',
] as const

const VALID_STAGES   = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']
const VALID_STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { id } = await params

    // Validate route param UUID — prevents injection through path
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
    }

    const body = await req.json()

    // Sanitize & validate each allowed field
    const sanitized: Record<string, unknown> = {}

    if (body.pipeline_stage !== undefined) {
      const stage = sanitizeEnum(body.pipeline_stage, VALID_STAGES, null)
      if (stage === null)
        return NextResponse.json({ error: `pipeline_stage must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
      sanitized.pipeline_stage = stage
    }

    if (body.status !== undefined) {
      const st = sanitizeEnum(body.status, VALID_STATUSES, null)
      if (st === null)
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
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

    if (body.job_post_id !== undefined) {
      if (body.job_post_id !== null && !isValidUUID(body.job_post_id))
        return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
      // Verify job belongs to this tenant before linking
      if (body.job_post_id !== null) {
        const { rows: jobRows } = await pool.query(
          'SELECT id FROM job_posts WHERE id = $1 AND tenant_id = $2',
          [body.job_post_id, ctx.tenantId]
        )
        if (!jobRows[0])
          return NextResponse.json({ error: 'Job post not found' }, { status: 404 })
      }
      sanitized.job_post_id = body.job_post_id
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Build parameterized SET clause — tenant_id guard prevents cross-tenant write
    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1
    for (const [key, val] of Object.entries(sanitized)) {
      sets.push(`${key} = $${idx}`)
      values.push(val)
      idx++
    }
    // Bind id and tenant_id last
    values.push(id)
    values.push(ctx.tenantId)

    const { rows } = await pool.query(
      `UPDATE resumes
          SET ${sets.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING id, short_id, pipeline_stage, status, match_category`,
      values
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Audit trail (fire-and-forget)
    if (sanitized.pipeline_stage) {
      logAudit({
        userId: ctx.userId, userEmail: ctx.userEmail,
        action: 'stage_changed', resourceType: 'candidate',
        resourceId: rows[0].short_id ?? id,
        details: { stage: sanitized.pipeline_stage }, tenantId: ctx.tenantId,
      })
    }

    return NextResponse.json({ candidate: rows[0] })
  } catch (err) {
    if (err instanceof ValidationError)
      return NextResponse.json({ error: err.message }, { status: 400 })
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

    // tenant_id guard — prevents deleting another tenant's candidates
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

