import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeExternalUrl, sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const { rows } = await pool.query(
    `SELECT id, doc_type, title, external_url, created_at FROM employee_documents
     WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
    [ctx.tenantId, ctx.userId]
  ).catch(() => ({ rows: [] }))

  return NextResponse.json({ documents: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const title = sanitizeText(body.title, 200)
  const doc_type = sanitizeText(body.doc_type, 60) ?? 'other'
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const externalUrl = body.external_url ? sanitizeExternalUrl(body.external_url, 500) : null
  if (body.external_url && !externalUrl) {
    return NextResponse.json({ error: 'external_url must be a valid http(s) URL' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `INSERT INTO employee_documents (tenant_id, user_id, doc_type, title, external_url, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [ctx.tenantId, ctx.userId, doc_type, title, externalUrl, ctx.userId]
  )
  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.document.create',
      resourceType: 'employee_document',
      resourceId: rows[0]?.id,
      details: { doc_type, title },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'ess.document.create',
      resourceType: 'employee_document',
      resourceId: rows[0]?.id,
      tenantId: ctx.tenantId,
      details: { doc_type, title },
    }),
  ])
  return NextResponse.json({ document: rows[0] }, { status: 201 })
}
