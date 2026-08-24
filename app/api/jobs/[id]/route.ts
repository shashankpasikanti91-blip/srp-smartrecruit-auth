import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { isValidUUID, sanitizeText, sanitizeEnum } from '@/lib/validate'
import { scheduleIndexJob } from '@/lib/rag/indexCorpus'

const VALID_STATUSES = ['active', 'closed', 'draft', 'archived'] as const
const VALID_TYPES = ['full-time', 'part-time', 'contract', 'remote', 'internship'] as const
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const

function asStringArray(v: unknown, max = 40): string[] | null {
  if (!Array.isArray(v)) return null
  return v
    .map(x => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, max)
}

function asNullableNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'jobs.update')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  // Verify job belongs to this tenant
  const { rows: existing } = await pool.query(
    'SELECT id, title FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [id, ctx.tenantId]
  )
  if (!existing[0]) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const body = await req.json()
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = $${idx++}`)
    vals.push(value)
  }

  if (body.status !== undefined) {
    const st = sanitizeEnum(body.status, VALID_STATUSES, null)
    if (!st) return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    push('status', st)
  }
  if (body.title !== undefined) {
    const t = sanitizeText(body.title, 200)
    if (!t) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    push('title', t)
  }
  if (body.description !== undefined) {
    push('description', sanitizeText(body.description, 20000))
  }
  if (body.requirements !== undefined) {
    push('requirements', sanitizeText(body.requirements, 8000))
  }
  if (body.optional_requirements !== undefined) {
    push('optional_requirements', sanitizeText(body.optional_requirements, 8000))
  }
  if (body.raw_jd_text !== undefined) {
    push('raw_jd_text', sanitizeText(body.raw_jd_text, 50000))
  }
  if (body.location !== undefined) {
    push('location', sanitizeText(body.location, 200))
  }
  if (body.company !== undefined) {
    push('company', sanitizeText(body.company, 200))
  }
  if (body.department !== undefined) {
    push('department', sanitizeText(body.department, 200))
  }
  if (body.type !== undefined) {
    const t = sanitizeEnum(body.type, VALID_TYPES, null)
    if (t) push('type', t)
  }
  if (body.contract_duration !== undefined) {
    push('contract_duration', sanitizeText(body.contract_duration, 120))
  }
  if (body.currency !== undefined) {
    push('currency', sanitizeText(String(body.currency || 'MYR'), 8) || 'MYR')
  }
  if (body.priority !== undefined) {
    const p = sanitizeEnum(body.priority, VALID_PRIORITIES, null)
    if (p) push('priority', p)
  }
  if (body.hiring_manager !== undefined) {
    push('hiring_manager', sanitizeText(body.hiring_manager, 200))
  }

  for (const [key, col] of [
    ['experience_min', 'experience_min'],
    ['experience_max', 'experience_max'],
    ['salary_min', 'salary_min'],
    ['salary_max', 'salary_max'],
    ['max_budget', 'max_budget'],
    ['headcount', 'headcount'],
  ] as const) {
    const n = asNullableNumber(body[key])
    if (n !== undefined) push(col, n)
  }

  const skillsMand = asStringArray(body.skills_mandatory)
  if (skillsMand) push('skills_mandatory', skillsMand)
  const skillsReq = asStringArray(body.skills_required)
  if (skillsReq) push('skills_required', skillsReq)
  const tags = asStringArray(body.tags)
  if (tags) push('tags', tags)

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  sets.push(`updated_at = NOW()`)
  vals.push(id, ctx.tenantId)

  try {
    const { rows } = await pool.query(
      `UPDATE job_posts SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      vals
    )
    logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail,
      action: 'job_updated', resourceType: 'job', resourceId: id,
      details: { fields: Object.keys(body) }, tenantId: ctx.tenantId,
    })
    if (
      body.raw_jd_text !== undefined ||
      body.description !== undefined ||
      body.requirements !== undefined
    ) {
      scheduleIndexJob({
        tenantId: ctx.tenantId,
        jobId: id,
        userId: ctx.userId,
      })
    }
    return NextResponse.json({ job: rows[0] })
  } catch (e) {
    console.error('[api/jobs PATCH]', e)
    // Retry with core columns only if enriched columns missing on older schemas
    const coreSets: string[] = []
    const coreVals: unknown[] = []
    let cidx = 1
    const corePush = (col: string, value: unknown) => {
      coreSets.push(`${col} = $${cidx++}`)
      coreVals.push(value)
    }
    if (body.title !== undefined) corePush('title', sanitizeText(body.title, 200))
    if (body.description !== undefined) corePush('description', sanitizeText(body.description, 20000))
    if (body.requirements !== undefined) corePush('requirements', sanitizeText(body.requirements, 8000))
    if (body.location !== undefined) corePush('location', sanitizeText(body.location, 200))
    if (body.company !== undefined) corePush('company', sanitizeText(body.company, 200))
    if (body.type !== undefined) {
      const t = sanitizeEnum(body.type, VALID_TYPES, null)
      if (t) corePush('type', t)
    }
    const tags2 = asStringArray(body.tags)
    if (tags2) corePush('tags', tags2)
    if (coreSets.length === 0) {
      return NextResponse.json({ error: 'Could not update job fields on this schema' }, { status: 500 })
    }
    coreSets.push('updated_at = NOW()')
    coreVals.push(id, ctx.tenantId)
    const { rows } = await pool.query(
      `UPDATE job_posts SET ${coreSets.join(', ')} WHERE id = $${cidx++} AND tenant_id = $${cidx} RETURNING *`,
      coreVals
    )
    return NextResponse.json({ job: rows[0], warning: 'Some enriched fields could not be saved on this schema' })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'jobs.delete')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  // Soft-delete: set status to archived (tenant-scoped)
  const { rows } = await pool.query(
    `UPDATE job_posts SET status = 'archived', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [id, ctx.tenantId]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  logAudit({
    userId: ctx.userId, userEmail: ctx.userEmail,
    action: 'job_archived', resourceType: 'job', resourceId: id,
    details: {}, tenantId: ctx.tenantId,
  })

  return NextResponse.json({ ok: true })
}
