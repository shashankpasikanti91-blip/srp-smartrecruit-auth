/**
 * Tenant Admin export pack — reuses existing tables; logs every export.
 * GET /api/security/export-pack?type=candidates|jobs|audit|ai|comms|notes|all
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  return [keys.join(','), ...rows.map(r => keys.map(k => escape(r[k])).join(','))].join('\n')
}

async function recordExport(opts: {
  tenantId: string
  userId: string
  userEmail: string
  exportType: string
  rowCount: number
  correlationId?: string
}) {
  await pool.query(
    `INSERT INTO tenant_exports (tenant_id, user_id, export_type, status, row_count)
     VALUES ($1,$2,$3,'completed',$4)`,
    [opts.tenantId, opts.userId, opts.exportType, opts.rowCount]
  ).catch(() => {})
  await logAudit({
    userId: opts.userId,
    userEmail: opts.userEmail,
    tenantId: opts.tenantId,
    action: 'tenant_export',
    resourceType: 'tenant_export',
    details: { type: opts.exportType, rows: opts.rowCount },
    module: 'security',
    actorType: 'human',
    correlationId: opts.correlationId ?? null,
  })
  await createNotification({
    tenantId: opts.tenantId,
    userId: opts.userId,
    category: 'security',
    title: 'Export completed',
    body: `${opts.exportType} export (${opts.rowCount} rows) is ready.`,
  }).catch(() => {})
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const type = req.nextUrl.searchParams.get('type') ?? 'all'
  const format = req.nextUrl.searchParams.get('format') ?? 'json'

  const packs: Record<string, Record<string, unknown>[]> = {}

  if (type === 'candidates' || type === 'all') {
    const { rows } = await pool.query(
      `SELECT id, short_id, candidate_name, candidate_email, candidate_phone, created_at, updated_at
       FROM resumes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] }))
    packs.candidates = rows
  }
  if (type === 'jobs' || type === 'all') {
    const { rows } = await pool.query(
      `SELECT id, title, company, status, created_at, updated_at
       FROM job_posts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 2000`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] }))
    packs.jobs = rows
  }
  if (type === 'audit' || type === 'all') {
    const { rows } = await pool.query(
      `SELECT action, resource_type, user_email, result, created_at, module
       FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] }))
    packs.audit = rows
  }
  if (type === 'ai' || type === 'all') {
    const { rows } = await pool.query(
      `SELECT model, operation, prompt_tokens, completion_tokens, total_tokens, created_at
       FROM token_usage WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] }))
    packs.ai = rows
  }
  if (type === 'comms' || type === 'all') {
    const { rows } = await pool.query(
      `SELECT channel, "to", subject, status, created_at
       FROM communication_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] }))
    packs.comms = rows
  }
  if (type === 'notes' || type === 'all') {
    const { rows } = await pool.query(
      `SELECT entity_type, entity_id, body, created_at
       FROM entity_notes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] }))
    packs.notes = rows
  }

  const totalRows = Object.values(packs).reduce((n, rows) => n + rows.length, 0)
  await recordExport({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    exportType: type,
    rowCount: totalRows,
    correlationId: ctx.requestId,
  })

  if (format === 'csv' && type !== 'all') {
    const rows = packs[type] ?? []
    const csv = toCsv(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-${type}.csv"`,
      },
    })
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    type,
    packs,
    row_counts: Object.fromEntries(Object.entries(packs).map(([k, v]) => [k, v.length])),
  })
}
