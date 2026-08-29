import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, requireGovernanceAccess } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import {
  canDirectDelete,
  ensureDeleteRequestsTable,
  executeResourceDelete,
  notifyTenantApprovers,
  type DeleteResourceType,
} from '@/lib/deleteRequests'

const VALID_TYPES: DeleteResourceType[] = ['candidate', 'job', 'client']

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const denied = requireGovernanceAccess(ctx)
  if (denied) return denied

  try {
    await ensureDeleteRequestsTable()
    const status = req.nextUrl.searchParams.get('status') || 'pending'
    const { rows } = await pool.query(
      `SELECT dr.*,
              u.email AS requester_email,
              u.name AS requester_name
       FROM delete_requests dr
       LEFT JOIN auth_users u ON u.id = dr.requested_by
       WHERE dr.tenant_id = $1
         AND ($2 = 'all' OR dr.status = $2)
       ORDER BY dr.requested_at DESC
       LIMIT 100`,
      [ctx.tenantId, status]
    )
    return NextResponse.json({ requests: rows })
  } catch (err) {
    console.error('[api/delete-requests] GET:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  try {
    await ensureDeleteRequestsTable()
    const body = await req.json()
    const resourceType = body.resource_type as DeleteResourceType
    const resourceId = body.resource_id as string
    const reason = sanitizeText(body.reason, 1000) || null
    const resourceLabel = sanitizeText(body.resource_label, 200) || null

    if (!VALID_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resource_type' }, { status: 400 })
    }
    if (!isValidUUID(resourceId)) {
      return NextResponse.json({ error: 'Invalid resource_id' }, { status: 400 })
    }

    // Owner/admin delete immediately instead of creating a request
    if (canDirectDelete({ role: ctx.tenantRole, permissions: ctx.permissions, resourceType })) {
      const result = await executeResourceDelete({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        resourceType,
        resourceId,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ deleted: true, direct: true, label: result.label }, { status: 200 })
    }

    // Recruiters / members must request approval
    if (ctx.tenantRole === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot delete or request deletes' }, { status: 403 })
    }

    // Verify resource exists in tenant
    let label = resourceLabel
    if (resourceType === 'candidate') {
      const { rows } = await pool.query(
        `SELECT short_id, candidate_name FROM resumes WHERE id = $1 AND tenant_id = $2`,
        [resourceId, ctx.tenantId]
      )
      if (!rows[0]) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
      label = label || rows[0].short_id || rows[0].candidate_name
    } else if (resourceType === 'job') {
      const { rows } = await pool.query(
        `SELECT short_id, title FROM job_posts WHERE id = $1 AND tenant_id = $2`,
        [resourceId, ctx.tenantId]
      )
      if (!rows[0]) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      label = label || rows[0].short_id || rows[0].title
    } else {
      const { rows } = await pool.query(
        `SELECT name FROM clients WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE`,
        [resourceId, ctx.tenantId]
      )
      if (!rows[0]) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      label = label || rows[0].name
    }

    const pending = await pool.query(
      `SELECT id FROM delete_requests
       WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3 AND status = 'pending'`,
      [ctx.tenantId, resourceType, resourceId]
    )
    if (pending.rows[0]) {
      return NextResponse.json({ error: 'A pending delete request already exists for this item' }, { status: 409 })
    }

    const { rows } = await pool.query(
      `INSERT INTO delete_requests
         (tenant_id, resource_type, resource_id, resource_label, reason, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [ctx.tenantId, resourceType, resourceId, label, reason, ctx.userId]
    )

    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'delete_requested',
      resourceType,
      resourceId: label ?? resourceId,
      details: { request_id: rows[0].id, reason },
      tenantId: ctx.tenantId,
    })

    await notifyTenantApprovers({
      tenantId: ctx.tenantId,
      title: `Delete approval needed — ${resourceType}`,
      body: `${ctx.userEmail} requested delete of “${label}”${reason ? `: ${reason}` : ''}`,
      entityType: 'delete_request',
      entityId: rows[0].id,
    })

    return NextResponse.json({ request: rows[0], pending: true }, { status: 201 })
  } catch (err) {
    console.error('[api/delete-requests] POST:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
