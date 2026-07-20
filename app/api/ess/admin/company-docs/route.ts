import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeExternalUrl, sanitizeText } from '@/lib/validate'
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

  const body = await req.json()
  const title = sanitizeText(body.title, 200)
  const doc_type = sanitizeText(body.doc_type, 60) ?? 'policy'
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (body.user_id && !isValidUUID(body.user_id)) {
    return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
  }
  if (body.user_id) {
    const membership = await pool.query(
      `SELECT 1 FROM tenant_members WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
      [ctx.tenantId, body.user_id]
    )
    if (!membership.rows[0]) {
      return NextResponse.json({ error: 'Target user does not belong to this tenant' }, { status: 400 })
    }
  }
  const externalUrl = body.external_url ? sanitizeExternalUrl(body.external_url, 500) : null
  if (body.external_url && !externalUrl) {
    return NextResponse.json({ error: 'external_url must be a valid http(s) URL' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `INSERT INTO company_documents (tenant_id, user_id, doc_type, title, external_url, visible_to_all)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      ctx.tenantId,
      body.user_id || null,
      doc_type,
      title,
      externalUrl,
      body.visible_to_all !== false,
    ]
  )
  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.admin.company_doc.create',
      resourceType: 'company_document',
      resourceId: rows[0]?.id,
      details: { title, doc_type, target_user_id: body.user_id ?? null },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'ess.admin.company_doc.create',
      resourceType: 'company_document',
      resourceId: rows[0]?.id,
      tenantId: ctx.tenantId,
      details: { title, doc_type, target_user_id: body.user_id ?? null },
    }),
  ])
  return NextResponse.json({ document: rows[0] }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.admin')
  if (ctx instanceof NextResponse) return ctx
  if (ctx.tenantRole !== 'owner' && ctx.tenantRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await pool.query(
    `SELECT * FROM company_documents WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [ctx.tenantId]
  )
  return NextResponse.json({ documents: rows })
}
