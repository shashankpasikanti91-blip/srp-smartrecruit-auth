import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  const { rows } = await pool.query(
    `SELECT * FROM attendance_records
     WHERE tenant_id = $1 AND user_id = $2
       AND to_char(work_date, 'YYYY-MM') = $3
     ORDER BY work_date DESC`,
    [ctx.tenantId, ctx.userId, month]
  ).catch(() => ({ rows: [] }))

  const today = new Date().toISOString().slice(0, 10)
  const todayRow = rows.find((r: { work_date: string }) =>
    new Date(r.work_date).toISOString().slice(0, 10) === today
  )

  return NextResponse.json({ records: rows, today: todayRow ?? null, month })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const action = body.action as string
  const now = new Date()
  const workDate = now.toISOString().slice(0, 10)

  if (action === 'check_in') {
    const { rows } = await pool.query(
      `INSERT INTO attendance_records (tenant_id, user_id, work_date, check_in_at, status)
       VALUES ($1,$2,$3::date,$4,'present')
       ON CONFLICT (tenant_id, user_id, work_date)
       DO UPDATE SET check_in_at = COALESCE(attendance_records.check_in_at, $4), updated_at = NOW()
       RETURNING *`,
      [ctx.tenantId, ctx.userId, workDate, now.toISOString()]
    )
    await logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.attendance.check_in',
      resourceType: 'attendance_record',
      resourceId: rows[0]?.id,
      details: { work_date: workDate },
      ipAddress: getIpAddress(req) ?? undefined,
    }).catch(() => {})
    return NextResponse.json({ record: rows[0] })
  }

  if (action === 'check_out') {
    const { rows } = await pool.query(
      `UPDATE attendance_records SET check_out_at = $1, updated_at = NOW()
       WHERE tenant_id = $2 AND user_id = $3 AND work_date = $4::date
       RETURNING *`,
      [now.toISOString(), ctx.tenantId, ctx.userId, workDate]
    )
    if (!rows[0]) return NextResponse.json({ error: 'No check-in for today' }, { status: 400 })
    await logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.attendance.check_out',
      resourceType: 'attendance_record',
      resourceId: rows[0]?.id,
      details: { work_date: workDate },
      ipAddress: getIpAddress(req) ?? undefined,
    }).catch(() => {})
    return NextResponse.json({ record: rows[0] })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
