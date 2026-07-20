import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE tenant_id = $1 AND is_active = TRUE ORDER BY name`,
    [ctx.tenantId]
  )
  return NextResponse.json({ clients: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const name = sanitizeText(body.name, 200)
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { rows } = await pool.query(
    `INSERT INTO clients (tenant_id, name, industry, contact_name, contact_email, contact_phone, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      ctx.tenantId, name,
      sanitizeText(body.industry, 100),
      sanitizeText(body.contact_name, 120),
      sanitizeText(body.contact_email, 200),
      sanitizeText(body.contact_phone, 40),
      sanitizeText(body.notes, 2000),
    ]
  )
  return NextResponse.json({ client: rows[0] }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const id = body.id as string
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { rows } = await pool.query(
    `UPDATE clients SET
       name = COALESCE($1, name),
       industry = COALESCE($2, industry),
       contact_name = COALESCE($3, contact_name),
       contact_email = COALESCE($4, contact_email),
       contact_phone = COALESCE($5, contact_phone),
       notes = COALESCE($6, notes),
       is_active = COALESCE($7, is_active),
       updated_at = NOW()
     WHERE id = $8 AND tenant_id = $9 RETURNING *`,
    [
      sanitizeText(body.name, 200),
      sanitizeText(body.industry, 100),
      sanitizeText(body.contact_name, 120),
      sanitizeText(body.contact_email, 200),
      sanitizeText(body.contact_phone, 40),
      sanitizeText(body.notes, 2000),
      body.is_active,
      id, ctx.tenantId,
    ]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ client: rows[0] })
}
