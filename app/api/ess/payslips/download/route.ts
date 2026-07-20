import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { readFile } from 'fs/promises'
import path from 'path'
import { logAudit } from '@/lib/audit'
import { logDataAccess, logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const id = req.nextUrl.searchParams.get('id')
  if (!id || !isValidUUID(id)) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { rows } = await pool.query<{ storage_path: string | null; external_url: string | null; period_label: string }>(
    `SELECT storage_path, external_url, period_label FROM employee_payslips
     WHERE id = $1 AND user_id = $2 AND tenant_id = $3 LIMIT 1`,
    [id, ctx.userId, ctx.tenantId]
  )
  const row = rows[0]
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (row.external_url) {
    await Promise.allSettled([
      logUserActivity({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'ess.payslip.download',
        resourceType: 'employee_payslip',
        resourceId: id,
        details: { period_label: row.period_label, external: true },
        ipAddress: getIpAddress(req) ?? undefined,
      }),
      logDataAccess({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userRole: ctx.tenantRole,
        accessType: 'payslip_download',
        resourceType: 'employee_payslip',
        resourceId: id,
        ipAddress: getIpAddress(req) ?? undefined,
      }),
    ])
    return NextResponse.redirect(row.external_url)
  }
  if (!row.storage_path) {
    return NextResponse.json({ error: 'No file' }, { status: 404 })
  }

  const root = path.join(process.cwd(), 'uploads', 'ess-payslips')
  const abs = path.join(root, row.storage_path)
  if (!abs.startsWith(root)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  try {
    const buf = await readFile(abs)
    await Promise.allSettled([
      logUserActivity({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'ess.payslip.download',
        resourceType: 'employee_payslip',
        resourceId: id,
        details: { period_label: row.period_label, external: false },
        ipAddress: getIpAddress(req) ?? undefined,
      }),
      logDataAccess({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userRole: ctx.tenantRole,
        accessType: 'payslip_download',
        resourceType: 'employee_payslip',
        resourceId: id,
        ipAddress: getIpAddress(req) ?? undefined,
      }),
      logAudit({
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action: 'ess.payslip.download',
        resourceType: 'employee_payslip',
        resourceId: id,
        tenantId: ctx.tenantId,
        details: { period_label: row.period_label },
      }),
    ])
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${row.period_label.replace(/[^a-z0-9-_]/gi, '_')}.pdf"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'File missing' }, { status: 404 })
  }
}
