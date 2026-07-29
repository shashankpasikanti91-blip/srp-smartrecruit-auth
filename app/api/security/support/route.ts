/**
 * Support access workflow
 * GET/POST /api/security/support
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'

async function expireStaleSessions() {
  await pool.query(
    `UPDATE support_sessions SET is_active = FALSE, ended_at = NOW(), updated_at = NOW()
     WHERE is_active = TRUE AND expires_at < NOW()`
  ).catch(() => {})
  await pool.query(
    `UPDATE support_requests SET status = 'expired', updated_at = NOW()
     WHERE status = 'approved' AND id IN (
       SELECT support_request_id FROM support_sessions
       WHERE is_active = FALSE AND ended_at IS NOT NULL
     ) AND updated_at < NOW() - interval '1 day'`
  ).catch(() => {})
}

export async function GET(req: NextRequest) {
  await expireStaleSessions()
  const view = req.nextUrl.searchParams.get('view')

  // Platform owner: list pending/active across tenants
  if (view === 'owner') {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isPlatformOwnerEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { rows } = await pool.query(
      `SELECT sr.*, t.name AS tenant_name, t.slug AS tenant_slug,
              u.email AS requester_email,
              ss.id AS session_id, ss.expires_at AS session_expires, ss.is_active AS session_active
       FROM support_requests sr
       JOIN tenants t ON t.id = sr.tenant_id
       JOIN auth_users u ON u.id = sr.requested_by
       LEFT JOIN LATERAL (
         SELECT * FROM support_sessions s WHERE s.support_request_id = sr.id
         ORDER BY s.created_at DESC LIMIT 1
       ) ss ON TRUE
       ORDER BY sr.created_at DESC LIMIT 100`
    ).catch(() => ({ rows: [] }))
    return NextResponse.json({ requests: rows })
  }

  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await pool.query(
    `SELECT sr.*, u.email AS requester_email,
            ss.id AS session_id, ss.expires_at AS session_expires, ss.is_active AS session_active
     FROM support_requests sr
     JOIN auth_users u ON u.id = sr.requested_by
     LEFT JOIN LATERAL (
       SELECT * FROM support_sessions s WHERE s.support_request_id = sr.id
       ORDER BY s.created_at DESC LIMIT 1
     ) ss ON TRUE
     WHERE sr.tenant_id = $1
     ORDER BY sr.created_at DESC LIMIT 50`,
    [ctx.tenantId]
  ).catch(() => ({ rows: [] }))

  return NextResponse.json({ requests: rows })
}

export async function POST(req: NextRequest) {
  await expireStaleSessions()
  let body: {
    action?: string
    tenant_id?: string
    reason?: string
    duration_hours?: number
    request_id?: string
    decision_note?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Platform owner requests access
  if (body.action === 'request') {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isPlatformOwnerEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!body.tenant_id || !body.reason) {
      return NextResponse.json({ error: 'tenant_id and reason required' }, { status: 422 })
    }
    const { rows: users } = await pool.query(
      `SELECT id FROM auth_users WHERE email = $1`,
      [session.user.email.toLowerCase()]
    )
    const ownerUserId = users[0]?.id
    if (!ownerUserId) return NextResponse.json({ error: 'Owner user not found' }, { status: 400 })

    const hours = Math.min(72, Math.max(1, body.duration_hours ?? 4))
    const { rows } = await pool.query(
      `INSERT INTO support_requests (tenant_id, requested_by, reason, duration_hours, status)
       VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
      [body.tenant_id, ownerUserId, body.reason, hours]
    )

    // Notify tenant owners/admins
    const { rows: admins } = await pool.query(
      `SELECT user_id FROM tenant_members
       WHERE tenant_id = $1 AND role IN ('owner','admin') AND invite_accepted = TRUE`,
      [body.tenant_id]
    )
    for (const a of admins) {
      await createNotification({
        tenantId: body.tenant_id,
        userId: a.user_id,
        category: 'security',
        title: 'Support access requested',
        body: body.reason,
        link: '/dashboard',
      }).catch(() => {})
    }
    await logAudit({
      userId: ownerUserId, userEmail: session.user.email, tenantId: body.tenant_id,
      action: 'support_access_requested', resourceType: 'support_request',
      resourceId: rows[0]?.id, details: { hours, reason: body.reason }, module: 'security',
    })
    return NextResponse.json({ request: rows[0] })
  }

  // Tenant approve / reject / revoke
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!body.request_id) {
    return NextResponse.json({ error: 'request_id required' }, { status: 422 })
  }

  const { rows: reqRows } = await pool.query(
    `SELECT * FROM support_requests WHERE id = $1 AND tenant_id = $2`,
    [body.request_id, ctx.tenantId]
  )
  const supportReq = reqRows[0]
  if (!supportReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.action === 'approve') {
    const hours = supportReq.duration_hours || 4
    await pool.query(
      `UPDATE support_requests
       SET status = 'approved', decided_by = $1, decided_at = NOW(), decision_note = $2, updated_at = NOW()
       WHERE id = $3`,
      [ctx.userId, body.decision_note ?? null, body.request_id]
    )
    const { rows: sess } = await pool.query(
      `INSERT INTO support_sessions
         (support_request_id, tenant_id, owner_user_id, expires_at, is_active)
       VALUES ($1,$2,$3, NOW() + ($4 || ' hours')::interval, TRUE)
       RETURNING *`,
      [body.request_id, ctx.tenantId, supportReq.requested_by, String(hours)]
    )
    await createNotification({
      tenantId: ctx.tenantId,
      userId: supportReq.requested_by,
      category: 'security',
      title: 'Support access approved',
      body: `Access granted until ${sess[0]?.expires_at}`,
    }).catch(() => {})
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'support_access_approved', resourceType: 'support_session',
      resourceId: sess[0]?.id, module: 'security',
    })
    return NextResponse.json({ ok: true, session: sess[0] })
  }

  if (body.action === 'reject') {
    await pool.query(
      `UPDATE support_requests
       SET status = 'rejected', decided_by = $1, decided_at = NOW(), decision_note = $2, updated_at = NOW()
       WHERE id = $3`,
      [ctx.userId, body.decision_note ?? null, body.request_id]
    )
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'support_access_rejected', resourceType: 'support_request',
      resourceId: body.request_id, module: 'security',
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'revoke') {
    await pool.query(
      `UPDATE support_sessions SET is_active = FALSE, ended_at = NOW(), updated_at = NOW()
       WHERE support_request_id = $1 AND tenant_id = $2 AND is_active = TRUE`,
      [body.request_id, ctx.tenantId]
    )
    await pool.query(
      `UPDATE support_requests SET status = 'revoked', updated_at = NOW() WHERE id = $1`,
      [body.request_id]
    )
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'support_access_revoked', resourceType: 'support_request',
      resourceId: body.request_id, module: 'security',
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 422 })
}

/** Check if platform owner currently has an active support session for a tenant */
export async function hasActiveSupportSession(opts: {
  tenantId: string
  ownerUserId: string
}): Promise<boolean> {
  await expireStaleSessions()
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM support_sessions
       WHERE tenant_id = $1 AND owner_user_id = $2 AND is_active = TRUE AND expires_at > NOW()
       LIMIT 1`,
      [opts.tenantId, opts.ownerUserId]
    )
    return rows.length > 0
  } catch {
    return false
  }
}
