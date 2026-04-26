import { NextRequest, NextResponse } from 'next/server'
import { requireTenant }            from '@/lib/tenant'
import { pool }                     from '@/lib/db'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  // Within a tenant: owners/admins see all members' logs, others see own
  const isAdmin = ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin'

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'))
  const action = url.searchParams.get('action') ?? ''
  const resource = url.searchParams.get('resource') ?? ''
  const offset = (page - 1) * limit

  try {
    const conditions: string[] = ['tenant_id = $1']
    const params: (string | number)[] = [ctx.tenantId]
    let idx = 2

    if (!isAdmin) {
      conditions.push(`user_id = $${idx++}`)
      params.push(ctx.userId)
    }
    if (action) {
      conditions.push(`action ILIKE $${idx++}`)
      params.push(`%${action}%`)
    }
    if (resource) {
      conditions.push(`resource_type ILIKE $${idx++}`)
      params.push(`%${resource}%`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const { rows } = await pool.query(
      `SELECT id, user_id, user_email, action, resource_type, resource_id,
              details, ip_address, user_agent, result, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0].count as string)

    return NextResponse.json({
      logs: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Internal write endpoint for audit events from frontend actions
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json() as {
      action: string
      resource_type: string
      resource_id?: string
      details?: Record<string, unknown>
      result?: string
    }

    const { action, resource_type, resource_id, details, result } = body
    if (!action || !resource_type) {
      return NextResponse.json({ error: 'action and resource_type required' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    const ua = req.headers.get('user-agent') ?? null

    await pool.query(
      `INSERT INTO audit_logs
         (user_id, user_email, action, resource_type, resource_id, details, ip_address, user_agent, result, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10)`,
      [
        ctx.userId, ctx.userEmail, action, resource_type,
        resource_id ?? null, JSON.stringify(details ?? {}),
        ip, ua, result ?? 'success', ctx.tenantId,
      ]
    )
    return NextResponse.json({ status: 'logged' })
  } catch (err: unknown) {
    // Audit log failures must never break the caller
    console.warn('[audit] write failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ status: 'skipped' })
  }
}
