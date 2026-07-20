import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'

/**
 * POST /api/reports/run-scheduled
 * Finds active templates with schedule_cron set and marks last_run_at.
 * Email delivery is stubbed — extend with sendEmailFromTenant when needed.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'reports.read')
  if (ctx instanceof NextResponse) return ctx

  if (!['owner', 'admin'].includes(ctx.tenantRole)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const { rows } = await pool.query<{
      id: string
      name: string
      report_type: string
      format: string
      schedule_cron: string | null
      last_run_at: string | null
    }>(
      `SELECT id, name, report_type, format, schedule_cron, last_run_at
       FROM report_templates
       WHERE tenant_id = $1
         AND is_active = true
         AND schedule_cron IS NOT NULL
         AND schedule_cron <> ''
         AND (last_run_at IS NULL OR last_run_at < NOW() - INTERVAL '1 day')`,
      [ctx.tenantId]
    )

    const ran: { id: string; name: string; report_type: string; format: string }[] = []
    for (const tpl of rows) {
      await pool.query(
        `UPDATE report_templates SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [tpl.id]
      )
      // Stub: email attachment would call /api/reports with tpl.report_type + tpl.format
      ran.push({
        id: tpl.id,
        name: tpl.name,
        report_type: tpl.report_type,
        format: tpl.format,
      })
    }

    return NextResponse.json({
      ok: true,
      processed: ran.length,
      templates: ran,
      email_stub: true,
    })
  } catch (e) {
    console.error('[reports/run-scheduled]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
