import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'reports.read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { rows } = await pool.query(
      `SELECT * FROM report_templates
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [ctx.tenantId]
    )
    return NextResponse.json({ templates: rows })
  } catch {
    return NextResponse.json({ templates: [] })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'reports.read')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'delete') {
    const id = body.id as string
    if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    await pool.query(
      'DELETE FROM report_templates WHERE id = $1 AND tenant_id = $2',
      [id, ctx.tenantId]
    )
    return NextResponse.json({ ok: true })
  }

  const name = sanitizeText(body.name, 200)
  const report_type = sanitizeText(body.report_type, 80)
  if (!name || !report_type) {
    return NextResponse.json({ error: 'name and report_type required' }, { status: 400 })
  }

  const format = sanitizeText(body.format, 10) ?? 'csv'
  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }

  if (body.id && isValidUUID(body.id)) {
    const { rows } = await pool.query(
      `UPDATE report_templates SET
         name = $1, report_type = $2, filters = $3::jsonb, format = $4,
         schedule_cron = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        name,
        report_type,
        JSON.stringify(body.filters ?? {}),
        format,
        sanitizeText(body.schedule_cron, 80),
        body.is_active !== false,
        body.id,
        ctx.tenantId,
      ]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ template: rows[0] })
  }

  const { rows } = await pool.query(
    `INSERT INTO report_templates
       (tenant_id, name, report_type, filters, format, schedule_cron, is_active, created_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
     RETURNING *`,
    [
      ctx.tenantId,
      name,
      report_type,
      JSON.stringify(body.filters ?? {}),
      format,
      sanitizeText(body.schedule_cron, 80),
      body.is_active !== false,
      ctx.userId,
    ]
  )
  return NextResponse.json({ template: rows[0] }, { status: 201 })
}
