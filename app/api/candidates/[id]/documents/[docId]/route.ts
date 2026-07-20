import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { writeTimeline } from '@/lib/timelineEngine'
import { createNotification } from '@/lib/notificationCenter'

const STATUSES = [
  'pending_verification',
  'verified',
  'rejected',
  'expired',
  'replacement_requested',
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx
  const { id, docId } = await params
  if (!isValidUUID(id) || !isValidUUID(docId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const status = sanitizeText(body.status, 40)
  const notes = sanitizeText(body.notes, 2000)

  if (!status || !STATUSES.includes(status as typeof STATUSES[number])) {
    return NextResponse.json({
      error: `status must be one of: ${STATUSES.join(', ')}`,
    }, { status: 400 })
  }

  const prev = await pool.query<{
    id: string
    verification_status: string | null
    slot_type: string
    resume_id: string
  }>(
    `SELECT id, verification_status, slot_type, resume_id
     FROM candidate_documents
     WHERE id = $1 AND tenant_id = $2 AND resume_id = $3`,
    [docId, ctx.tenantId, id]
  )
  if (!prev.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const oldStatus = prev.rows[0].verification_status || 'pending_verification'

  const { rows } = await pool.query(
    `UPDATE candidate_documents SET
       verification_status = $1,
       verified_by = $2,
       verified_at = NOW(),
       updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4
     RETURNING *`,
    [status, ctx.userId, docId, ctx.tenantId]
  )

  try {
    await pool.query(
      `INSERT INTO document_verification_history
         (tenant_id, document_id, resume_id, user_id, user_email, old_status, new_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ctx.tenantId, docId, id, ctx.userId, ctx.userEmail, oldStatus, status, notes]
    )
  } catch (e) {
    console.warn('[doc verify history]', e instanceof Error ? e.message : e)
  }

  await logAudit({
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    tenantId: ctx.tenantId,
    action: 'document_verification',
    resourceType: 'document',
    resourceId: docId,
    resumeId: id,
    module: 'documents',
    oldValue: oldStatus,
    newValue: status,
    reason: notes,
    details: { slot_type: prev.rows[0].slot_type },
  })

  await writeTimeline({
    tenantId: ctx.tenantId,
    entityType: 'document',
    entityId: docId,
    resumeId: id,
    eventType: 'document_verification',
    title: `Document ${status.replace(/_/g, ' ')}`,
    detail: `${prev.rows[0].slot_type}${notes ? ` — ${notes}` : ''}`,
    actorUserId: ctx.userId,
    actorEmail: ctx.userEmail,
  })

  const owner = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM resumes WHERE id = $1',
    [id]
  )
  if (owner.rows[0]?.user_id) {
    await createNotification({
      tenantId: ctx.tenantId,
      userId: owner.rows[0].user_id,
      category: 'documents',
      title: `Document ${status.replace(/_/g, ' ')}`,
      body: `${prev.rows[0].slot_type}${notes ? `: ${notes}` : ''}`,
      resumeId: id,
      entityType: 'document',
      entityId: docId,
    })
  }

  let history: unknown[] = []
  try {
    const h = await pool.query(
      `SELECT * FROM document_verification_history
       WHERE document_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [docId]
    )
    history = h.rows
  } catch { /* ignore */ }

  return NextResponse.json({ document: rows[0], history })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id, docId } = await params
  if (!isValidUUID(id) || !isValidUUID(docId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM document_verification_history
       WHERE tenant_id = $1 AND document_id = $2 AND resume_id = $3
       ORDER BY created_at DESC LIMIT 50`,
      [ctx.tenantId, docId, id]
    )
    return NextResponse.json({ history: rows })
  } catch {
    return NextResponse.json({ history: [] })
  }
}
