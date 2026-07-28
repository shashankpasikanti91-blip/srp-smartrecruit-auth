import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'
import {
  ensureDeleteRequestsTable,
  executeResourceDelete,
  type DeleteResourceType,
} from '@/lib/deleteRequests'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can approve delete requests' }, { status: 403 })
  }

  try {
    await ensureDeleteRequestsTable()
    const { id } = await params
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await req.json()
    const status = body.status as 'approved' | 'rejected'
    const reviewNote = sanitizeText(body.review_note, 1000) || null

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
    }

    const { rows: existing } = await pool.query(
      `SELECT * FROM delete_requests
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, ctx.tenantId]
    )
    if (!existing[0]) {
      return NextResponse.json({ error: 'Pending request not found' }, { status: 404 })
    }

    const reqRow = existing[0] as {
      id: string
      resource_type: DeleteResourceType
      resource_id: string
      resource_label: string | null
      requested_by: string
    }

    if (status === 'approved') {
      const result = await executeResourceDelete({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        resourceType: reqRow.resource_type,
        resourceId: reqRow.resource_id,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? 'Delete failed' }, { status: 404 })
      }
    }

    const { rows } = await pool.query(
      `UPDATE delete_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [status, ctx.userId, reviewNote, id, ctx.tenantId]
    )

    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: status === 'approved' ? 'delete_approved' : 'delete_rejected',
      resourceType: reqRow.resource_type,
      resourceId: reqRow.resource_label ?? reqRow.resource_id,
      details: { request_id: id, review_note: reviewNote },
      tenantId: ctx.tenantId,
    })

    await createNotification({
      tenantId: ctx.tenantId,
      userId: reqRow.requested_by,
      category: 'approval',
      title: status === 'approved'
        ? `Delete approved — ${reqRow.resource_label ?? reqRow.resource_type}`
        : `Delete rejected — ${reqRow.resource_label ?? reqRow.resource_type}`,
      body: reviewNote ?? (status === 'approved' ? 'Your delete request was approved.' : 'Your delete request was rejected.'),
      entityType: 'delete_request',
      entityId: id,
    })

    return NextResponse.json({ request: rows[0], executed: status === 'approved' })
  } catch (err) {
    console.error('[api/delete-requests/[id]] PATCH:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
