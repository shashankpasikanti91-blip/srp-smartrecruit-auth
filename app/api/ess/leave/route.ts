import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const leave_type = sanitizeText(body.leave_type, 40) ?? 'annual'
  const start_date = body.start_date as string
  const end_date = body.end_date as string
  const days = parseFloat(String(body.days ?? '1'))
  const reason = sanitizeText(body.reason, 1000)
  const start = start_date ? parseDateOnly(start_date) : null
  const end = end_date ? parseDateOnly(end_date) : null

  if (!start_date || !end_date || !Number.isFinite(days)) {
    return NextResponse.json({ error: 'start_date, end_date, and days required' }, { status: 400 })
  }
  if (!start || !end) {
    return NextResponse.json({ error: 'Dates must be valid YYYY-MM-DD values' }, { status: 400 })
  }
  if (end < start) {
    return NextResponse.json({ error: 'end_date must be on or after start_date' }, { status: 400 })
  }
  if (days <= 0 || days > 365) {
    return NextResponse.json({ error: 'days must be between 0.5 and 365' }, { status: 400 })
  }

  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  if (days > spanDays) {
    return NextResponse.json({ error: 'days cannot exceed the selected date range' }, { status: 400 })
  }

  const overlap = await pool.query<{ id: string }>(
    `SELECT id FROM leave_requests
     WHERE tenant_id = $1 AND user_id = $2
       AND status IN ('pending','approved')
       AND daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
     LIMIT 1`,
    [ctx.tenantId, ctx.userId, start_date, end_date]
  )
  if (overlap.rows[0]) {
    return NextResponse.json({ error: 'Overlapping leave request already exists' }, { status: 400 })
  }

  const { rows: tenantRow } = await pool.query<{ settings: unknown }>(
    'SELECT settings FROM tenants WHERE id = $1',
    [ctx.tenantId]
  )
  const settings = (tenantRow[0]?.settings ?? {}) as Record<string, unknown>
  const annualBalance = typeof settings.annual_leave_balance === 'number' ? settings.annual_leave_balance : 14
  if (leave_type === 'annual') {
    const approvedDays = await pool.query<{ c: string }>(
      `SELECT COALESCE(SUM(days), 0)::text AS c FROM leave_requests
       WHERE tenant_id = $1 AND user_id = $2 AND leave_type = 'annual' AND status = 'approved'`,
      [ctx.tenantId, ctx.userId]
    )
    const used = parseFloat(approvedDays.rows[0]?.c ?? '0')
    if (used + days > annualBalance) {
      return NextResponse.json({ error: 'Annual leave balance exceeded' }, { status: 400 })
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO leave_requests
       (tenant_id, user_id, leave_type, start_date, end_date, days, reason, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
     RETURNING *`,
    [ctx.tenantId, ctx.userId, leave_type, start_date, end_date, days, reason]
  )

  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.leave.request',
      resourceType: 'leave_request',
      resourceId: rows[0]?.id,
      details: { leave_type, start_date, end_date, days },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'ess.leave.request',
      resourceType: 'leave_request',
      resourceId: rows[0]?.id,
      tenantId: ctx.tenantId,
      details: { leave_type, start_date, end_date, days },
    }),
  ])

  return NextResponse.json({ leave_request: rows[0] }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const { rows } = await pool.query(
    `SELECT * FROM leave_requests WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
    [ctx.userId, ctx.tenantId]
  )
  return NextResponse.json({ leave_requests: rows })
}
