import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { logAudit } from '@/lib/audit'
import { logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.admin')
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const form = await req.formData()
  const userId = form.get('user_id') as string
  const periodLabel = sanitizeText(String(form.get('period_label') ?? ''), 80)
  const periodMonth = String(form.get('period_month') ?? '')
  const file = form.get('file') as File | null

  if (!userId || !periodLabel || !periodMonth) {
    return NextResponse.json({ error: 'user_id, period_label, period_month required' }, { status: 400 })
  }
  if (!isValidUUID(userId)) {
    return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodMonth)) {
    return NextResponse.json({ error: 'period_month must be YYYY-MM-DD' }, { status: 400 })
  }
  const membership = await pool.query(
    `SELECT 1 FROM tenant_members WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
    [ctx.tenantId, userId]
  )
  if (!membership.rows[0]) {
    return NextResponse.json({ error: 'Target user does not belong to this tenant' }, { status: 400 })
  }

  let storagePath: string | null = null
  if (file) {
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF payslips are allowed' }, { status: 400 })
    }
    const relative = path.join(ctx.tenantId, userId, `${periodMonth}.pdf`)
    const root = path.join(process.cwd(), 'uploads', 'ess-payslips')
    await mkdir(path.join(root, ctx.tenantId, userId), { recursive: true })
    await writeFile(path.join(root, relative), Buffer.from(await file.arrayBuffer()))
    storagePath = relative
  }

  const { rows } = await pool.query(
    `INSERT INTO employee_payslips (tenant_id, user_id, period_label, period_month, storage_path)
     VALUES ($1,$2,$3,$4::date,$5) RETURNING *`,
    [ctx.tenantId, userId, periodLabel, periodMonth, storagePath]
  )
  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.admin.payslip.upload',
      resourceType: 'employee_payslip',
      resourceId: rows[0]?.id,
      details: { target_user_id: userId, period_month: periodMonth },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'ess.admin.payslip.upload',
      resourceType: 'employee_payslip',
      resourceId: rows[0]?.id,
      tenantId: ctx.tenantId,
      details: { target_user_id: userId, period_month: periodMonth },
    }),
  ])
  return NextResponse.json({ payslip: rows[0] }, { status: 201 })
}
