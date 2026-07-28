import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import {
  LIFECYCLE_STAGES,
  applyTransition,
  normalizeLifecycleStage,
  type LifecycleStage,
} from '@/lib/lifecycle'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  let body: {
    candidate_id?: string
    resume_id?: string
    to_stage?: string
    job_post_id?: string
    related_entity_type?: string
    related_entity_id?: string
    reason?: string
    force?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const resumeId = body.resume_id || body.candidate_id
  if (!resumeId || !isValidUUID(resumeId)) {
    return NextResponse.json({ error: 'resume_id required' }, { status: 400 })
  }

  const toStage = normalizeLifecycleStage(body.to_stage)
  if (!toStage || !LIFECYCLE_STAGES.includes(toStage as LifecycleStage)) {
    return NextResponse.json(
      { error: 'Invalid to_stage', allowed: LIFECYCLE_STAGES },
      { status: 400 },
    )
  }

  if (body.job_post_id && !isValidUUID(body.job_post_id)) {
    return NextResponse.json({ error: 'Invalid job_post_id' }, { status: 400 })
  }
  if (body.related_entity_id && !isValidUUID(body.related_entity_id)) {
    return NextResponse.json({ error: 'Invalid related_entity_id' }, { status: 400 })
  }

  const result = await applyTransition({
    tenantId: ctx.tenantId,
    resumeId,
    toStage,
    jobPostId: body.job_post_id ?? null,
    relatedEntityType: sanitizeText(body.related_entity_type, 40),
    relatedEntityId: body.related_entity_id ?? null,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
    reason: sanitizeText(body.reason, 500),
    force: Boolean(body.force),
    advanceOnly: false,
  })

  if (result.error && !result.skipped && !result.applied) {
    return NextResponse.json({ error: result.error, ...result }, { status: 400 })
  }

  return NextResponse.json(result)
}
