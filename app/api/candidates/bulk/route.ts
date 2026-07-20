import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeEnum, sanitizeText } from '@/lib/validate'
import { LIFECYCLE_STATUSES, lifecycleToPipelineStage } from '@/lib/candidateLifecycle'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => isValidUUID(x)) : []
    if (!ids.length) return NextResponse.json({ error: 'ids array required' }, { status: 400 })
    if (ids.length > 200) return NextResponse.json({ error: 'Max 200 ids' }, { status: 400 })

    const action = body.action as string
    let updated = 0

    if (action === 'assign_recruiter') {
      if (!ctx.permissions.users.manage && ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const userId = body.user_id as string
      if (!isValidUUID(userId)) return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
      const res = await pool.query(
        `UPDATE resumes SET user_id = $1, updated_at = NOW()
         WHERE tenant_id = $2 AND id = ANY($3::uuid[])`,
        [userId, ctx.tenantId, ids]
      )
      updated = res.rowCount ?? 0
    } else if (action === 'change_lifecycle') {
      const life = sanitizeEnum(body.lifecycle_status, LIFECYCLE_STATUSES, null)
      if (!life) return NextResponse.json({ error: 'Invalid lifecycle_status' }, { status: 400 })
      const stage = lifecycleToPipelineStage(life)
      for (const rid of ids) {
        const { rows } = await pool.query<{ candidate_profile: unknown; short_id: string }>(
          'SELECT candidate_profile, short_id FROM resumes WHERE id = $1 AND tenant_id = $2',
          [rid, ctx.tenantId]
        )
        if (!rows[0]) continue
        const prof = typeof rows[0].candidate_profile === 'object' && rows[0].candidate_profile
          ? { ...(rows[0].candidate_profile as object), lifecycle_status: life }
          : { lifecycle_status: life }
        await pool.query(
          `UPDATE resumes SET candidate_profile = $1::jsonb,
           pipeline_stage = COALESCE($2, pipeline_stage), updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [JSON.stringify(prof), stage, rid, ctx.tenantId]
        )
        logAudit({
          userId: ctx.userId, userEmail: ctx.userEmail,
          action: 'lifecycle_changed', resourceType: 'candidate',
          resourceId: rows[0].short_id, details: { status: life }, tenantId: ctx.tenantId,
        })
        updated++
      }
    } else if (action === 'change_stage') {
      const stage = sanitizeText(body.pipeline_stage, 50)
      if (!stage) return NextResponse.json({ error: 'pipeline_stage required' }, { status: 400 })
      const res = await pool.query(
        `UPDATE resumes SET pipeline_stage = $1, updated_at = NOW()
         WHERE tenant_id = $2 AND id = ANY($3::uuid[])`,
        [stage, ctx.tenantId, ids]
      )
      updated = res.rowCount ?? 0
    } else if (action === 'archive') {
      const res = await pool.query(
        `UPDATE resumes SET
           candidate_profile = COALESCE(candidate_profile, '{}'::jsonb) || '{"lifecycle_status":"hold"}'::jsonb,
           pipeline_stage = 'sourced', updated_at = NOW()
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [ctx.tenantId, ids]
      )
      updated = res.rowCount ?? 0
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ updated, action })
  } catch (e) {
    console.error('[candidates/bulk]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
