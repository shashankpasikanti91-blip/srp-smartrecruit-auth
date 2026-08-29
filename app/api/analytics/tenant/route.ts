import { NextRequest, NextResponse } from 'next/server'
import {
  requireTenant,
  checkPermission,
  canAccessRecruitersModule,
  type TenantPermissions,
} from '@/lib/tenant'
import { computeTenantFunnel } from '@/lib/kpiEngine'
import { pool } from '@/lib/db'

function canViewTenantAnalytics(role: string, perms: TenantPermissions): boolean {
  if (role === 'owner' || role === 'admin') return true
  if (role === 'recruitment_head' || role === 'manager') return true
  if (checkPermission(perms, 'analytics.tenant')) return true
  return canAccessRecruitersModule(role, perms)
}

/** GET /api/analytics/tenant — tenant-wide funnel + recruiter leaderboard (managers+). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  if (!canViewTenantAnalytics(ctx.tenantRole, ctx.permissions)) {
    return NextResponse.json(
      { error: 'Forbidden — tenant analytics requires manager or admin' },
      { status: 403 },
    )
  }

  const days = Math.min(365, Math.max(7, parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)))

  try {
    const funnel = await computeTenantFunnel(ctx.tenantId, days)

    const since = new Date()
    since.setDate(since.getDate() - days)

    const topRecruiters = await pool.query(
      `SELECT u.name, u.email, COUNT(*)::int AS screens
       FROM token_usage tu
       JOIN auth_users u ON u.id = tu.user_id
       WHERE tu.tenant_id = $1 AND tu.created_at >= $2
         AND tu.operation ILIKE '%screen%'
       GROUP BY u.name, u.email
       ORDER BY screens DESC LIMIT 12`,
      [ctx.tenantId, since.toISOString()],
    ).catch(() => ({ rows: [] }))

    return NextResponse.json({
      ...funnel,
      top_recruiters: topRecruiters.rows,
    })
  } catch (e) {
    console.error('[analytics/tenant]', e)
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 500 })
  }
}
