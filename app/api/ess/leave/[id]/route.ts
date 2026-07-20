import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'ess.admin')
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin' && !ctx.permissions.ess?.admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json()
  const status = body.status as string
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `UPDATE leave_requests
        SET status = $1,
            approved_by = $4,
            approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
            updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 RETURNING *`,
    [status, id, ctx.tenantId, ctx.userId]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: `ess.leave.${status}`,
      resourceType: 'leave_request',
      resourceId: id,
      details: { status, target_user_id: rows[0]?.user_id ?? null },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: `ess.leave.${status}`,
      resourceType: 'leave_request',
      resourceId: id,
      tenantId: ctx.tenantId,
      details: { status, target_user_id: rows[0]?.user_id ?? null },
    }),
  ])

  return NextResponse.json({ leave_request: rows[0] })
}
