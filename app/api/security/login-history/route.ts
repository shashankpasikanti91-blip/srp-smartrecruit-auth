/**
 * GET /api/security/login-history — search/filter login_history
 * GET /api/security/login-history?export=csv — CSV export + audit
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const success = sp.get('success') // 'true' | 'false' | ''
  const days = Math.min(365, parseInt(sp.get('days') ?? '30', 10) || 30)
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10) || 100)
  const doExport = sp.get('export') === 'csv'
  const scope = sp.get('scope') === 'tenant' ? 'tenant' : 'mine'

  const isAdmin = ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin'
  if (scope === 'tenant' && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)

  const params: unknown[] = []
  const where: string[] = [`lh.created_at >= $${params.push(since.toISOString())}`]

  if (scope === 'tenant') {
    where.push(`lh.tenant_id = $${params.push(ctx.tenantId)}`)
  } else {
    where.push(`lh.user_id = $${params.push(ctx.userId)}`)
  }

  if (success === 'true') where.push('lh.success = TRUE')
  if (success === 'false') where.push('lh.success = FALSE')

  if (q) {
    const i = params.push(`%${q}%`)
    where.push(`(lh.email ILIKE $${i} OR lh.ip_address ILIKE $${i} OR lh.failure_reason ILIKE $${i} OR COALESCE(u.name,'') ILIKE $${i})`)
  }

  const sql = `
    SELECT lh.id, lh.email, lh.success, lh.ip_address, lh.user_agent, lh.failure_reason,
           lh.created_at, lh.browser, lh.os, lh.device_name, lh.role,
           u.name AS user_name
    FROM login_history lh
    LEFT JOIN auth_users u ON u.id = lh.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY lh.created_at DESC
    LIMIT $${params.push(doExport ? 5000 : limit)}`

  const { rows } = await pool.query(sql, params).catch(() => ({ rows: [] as Record<string, unknown>[] }))

  if (doExport) {
    await logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      tenantId: ctx.tenantId,
      action: 'login_history_export',
      resourceType: 'login_history',
      details: { scope, days, rows: rows.length },
      module: 'security',
    })

    const header = 'created_at,email,user_name,success,ip_address,browser,os,device_name,failure_reason,role'
    const lines = rows.map(r => {
      const vals = [
        r.created_at, r.email, r.user_name, r.success, r.ip_address,
        r.browser, r.os, r.device_name, r.failure_reason, r.role,
      ].map(v => {
        const s = v == null ? '' : String(v)
        return `"${s.replace(/"/g, '""')}"`
      })
      return vals.join(',')
    })
    const csv = [header, ...lines].join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="login-history-${scope}-${days}d.csv"`,
      },
    })
  }

  return NextResponse.json({ rows, scope, days })
}
