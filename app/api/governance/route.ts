import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'governance.read')
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [logins, failedLogins, activity, dataAccess, activeSessions, auditLogs] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::text AS c FROM login_history
       WHERE tenant_id = $1 AND created_at >= $2 AND success = TRUE`,
      [ctx.tenantId, since.toISOString()]
    ).catch(() => ({ rows: [{ c: '0' }] })),
    pool.query(
      `SELECT COUNT(*)::text AS c FROM login_history
       WHERE tenant_id = $1 AND created_at >= $2 AND success = FALSE`,
      [ctx.tenantId, since.toISOString()]
    ).catch(() => ({ rows: [{ c: '0' }] })),
    pool.query(
      `SELECT action, COUNT(*)::text AS c FROM user_activity_logs
       WHERE tenant_id = $1 AND created_at >= $2 GROUP BY action ORDER BY c DESC LIMIT 20`,
      [ctx.tenantId, since.toISOString()]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT access_type, COUNT(*)::text AS c FROM data_access_logs
       WHERE tenant_id = $1 AND created_at >= $2 GROUP BY access_type ORDER BY c DESC LIMIT 20`,
      [ctx.tenantId, since.toISOString()]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::text AS c FROM user_sessions
       WHERE tenant_id = $1 AND is_active = TRUE`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [{ c: '0' }] })),
    pool.query(
      `SELECT action, resource_type, user_email, created_at, result
       FROM audit_logs
       WHERE tenant_id = $1 AND created_at >= $2
       ORDER BY created_at DESC LIMIT 30`,
      [ctx.tenantId, since.toISOString()]
    ).catch(() => ({ rows: [] })),
  ])

  const recentLogins = await pool.query(
    `SELECT lh.*, u.name, u.email FROM login_history lh
     JOIN auth_users u ON u.id = lh.user_id
     WHERE lh.tenant_id = $1 ORDER BY lh.created_at DESC LIMIT 30`,
    [ctx.tenantId]
  ).catch(() => ({ rows: [] }))

  const [online, topRecruiters, funnel] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS c FROM tenant_members
       WHERE tenant_id = $1 AND invite_accepted = TRUE
         AND last_active_at IS NOT NULL AND last_active_at > NOW() - interval '15 minutes'`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `SELECT u.name, u.email, COUNT(*)::int AS screens
       FROM token_usage tu
       JOIN auth_users u ON u.id = tu.user_id
       WHERE tu.tenant_id = $1 AND tu.created_at >= $2
         AND tu.operation ILIKE '%screen%'
       GROUP BY u.name, u.email
       ORDER BY screens DESC LIMIT 8`,
      [ctx.tenantId, since.toISOString()]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM resumes WHERE tenant_id = $1) AS candidates,
         (SELECT COUNT(*)::int FROM submissions WHERE tenant_id = $1) AS submissions,
         (SELECT COUNT(*)::int FROM interviews WHERE tenant_id = $1) AS interviews,
         (SELECT COUNT(*)::int FROM offer_cases WHERE tenant_id = $1) AS offers`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [{}] })),
  ])

  return NextResponse.json({
    period_days: days,
    logins_count: parseInt(logins.rows[0]?.c ?? '0', 10),
    failed_logins_count: parseInt(failedLogins.rows[0]?.c ?? '0', 10),
    active_sessions: parseInt(activeSessions.rows[0]?.c ?? '0', 10),
    online_now: online.rows[0]?.c ?? 0,
    top_recruiters: topRecruiters.rows,
    funnel: funnel.rows[0] ?? {},
    activity_breakdown: activity.rows,
    data_access_breakdown: dataAccess.rows,
    recent_logins: recentLogins.rows,
    audit_logs: auditLogs.rows,
  })
}
