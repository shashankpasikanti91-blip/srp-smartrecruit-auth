import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'
import { notifyError } from '@/lib/notifications'

function pgErrorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : undefined
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { rows } = await pool.query(
      `SELECT * FROM clients
       WHERE tenant_id = $1 AND COALESCE(is_active, TRUE) = TRUE
       ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST, name ASC`,
      [ctx.tenantId],
    )
    return NextResponse.json({ clients: rows })
  } catch (err) {
    // Fallback if created_at/updated_at missing on older DBs
    try {
      const { rows } = await pool.query(
        `SELECT * FROM clients WHERE tenant_id = $1 AND COALESCE(is_active, TRUE) = TRUE ORDER BY name ASC`,
        [ctx.tenantId],
      )
      return NextResponse.json({ clients: rows })
    } catch (err2) {
      console.error('[api/clients GET]', err2)
      void notifyError({
        message: `Clients list failed: ${err2 instanceof Error ? err2.message : String(err2)}`,
        severity: 'critical',
      })
      return NextResponse.json({ error: 'Could not load clients' }, { status: 500 })
    }
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const name = sanitizeText(body.name, 200)
    if (!name) return NextResponse.json({ error: 'Client name is required' }, { status: 400 })

    const industry = sanitizeText(body.industry, 100)
    const contact_name = sanitizeText(body.contact_name, 120)
    const contact_email = sanitizeText(body.contact_email, 200)
    const contact_phone = sanitizeText(body.contact_phone, 40)
    const notes = sanitizeText(body.notes, 2000)
    const hiring_manager = sanitizeText(body.hiring_manager, 120)
    const country_code = sanitizeText(body.country_code, 10)

    // Prefer full insert; fall back if optional columns missing
    try {
      const { rows } = await pool.query(
        `INSERT INTO clients
           (tenant_id, name, industry, contact_name, contact_email, contact_phone, notes, hiring_manager, country_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [ctx.tenantId, name, industry, contact_name, contact_email, contact_phone, notes, hiring_manager, country_code],
      )
      return NextResponse.json({ client: rows[0] }, { status: 201 })
    } catch (inner) {
      if (pgErrorCode(inner) === '42703') {
        const { rows } = await pool.query(
          `INSERT INTO clients
             (tenant_id, name, industry, contact_name, contact_email, contact_phone, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [ctx.tenantId, name, industry, contact_name, contact_email, contact_phone, notes],
        )
        return NextResponse.json({ client: rows[0] }, { status: 201 })
      }
      throw inner
    }
  } catch (err) {
    const code = pgErrorCode(err)
    if (code === '23505') {
      return NextResponse.json({ error: 'A client with this name already exists' }, { status: 409 })
    }
    console.error('[api/clients POST]', err)
    void notifyError({
      message: `Client save failed: ${err instanceof Error ? err.message : String(err)}`,
      severity: 'critical',
    })
    return NextResponse.json({ error: 'Could not save client' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const id = body.id as string
    if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const name = body.name !== undefined ? sanitizeText(body.name, 200) : null
    if (body.name !== undefined && !name) {
      return NextResponse.json({ error: 'Client name cannot be empty' }, { status: 400 })
    }

    const industry = body.industry !== undefined ? sanitizeText(body.industry, 100) : null
    const contact_name = body.contact_name !== undefined ? sanitizeText(body.contact_name, 120) : null
    const contact_email = body.contact_email !== undefined ? sanitizeText(body.contact_email, 200) : null
    const contact_phone = body.contact_phone !== undefined ? sanitizeText(body.contact_phone, 40) : null
    const notes = body.notes !== undefined ? sanitizeText(body.notes, 2000) : null
    const hiring_manager = body.hiring_manager !== undefined ? sanitizeText(body.hiring_manager, 120) : null
    const country_code = body.country_code !== undefined ? sanitizeText(body.country_code, 10) : null
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : null

    try {
      const { rows } = await pool.query(
        `UPDATE clients SET
           name = COALESCE($1, name),
           industry = CASE WHEN $10::boolean THEN $2 ELSE industry END,
           contact_name = CASE WHEN $11::boolean THEN $3 ELSE contact_name END,
           contact_email = CASE WHEN $12::boolean THEN $4 ELSE contact_email END,
           contact_phone = CASE WHEN $13::boolean THEN $5 ELSE contact_phone END,
           notes = CASE WHEN $14::boolean THEN $6 ELSE notes END,
           hiring_manager = CASE WHEN $15::boolean THEN $7 ELSE hiring_manager END,
           country_code = CASE WHEN $16::boolean THEN $8 ELSE country_code END,
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
         WHERE id = $17 AND tenant_id = $18
         RETURNING *`,
        [
          name,
          industry,
          contact_name,
          contact_email,
          contact_phone,
          notes,
          hiring_manager,
          country_code,
          is_active,
          body.industry !== undefined,
          body.contact_name !== undefined,
          body.contact_email !== undefined,
          body.contact_phone !== undefined,
          body.notes !== undefined,
          body.hiring_manager !== undefined,
          body.country_code !== undefined,
          id,
          ctx.tenantId,
        ],
      )
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ client: rows[0] })
    } catch (inner) {
      if (pgErrorCode(inner) === '42703') {
        const { rows } = await pool.query(
          `UPDATE clients SET
             name = COALESCE($1, name),
             industry = CASE WHEN $7::boolean THEN $2 ELSE industry END,
             contact_name = CASE WHEN $8::boolean THEN $3 ELSE contact_name END,
             contact_email = CASE WHEN $9::boolean THEN $4 ELSE contact_email END,
             contact_phone = CASE WHEN $10::boolean THEN $5 ELSE contact_phone END,
             notes = CASE WHEN $11::boolean THEN $6 ELSE notes END,
             is_active = COALESCE($12, is_active),
             updated_at = NOW()
           WHERE id = $13 AND tenant_id = $14
           RETURNING *`,
          [
            name, industry, contact_name, contact_email, contact_phone, notes,
            body.industry !== undefined,
            body.contact_name !== undefined,
            body.contact_email !== undefined,
            body.contact_phone !== undefined,
            body.notes !== undefined,
            is_active, id, ctx.tenantId,
          ],
        )
        if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ client: rows[0] })
      }
      throw inner
    }
  } catch (err) {
    const code = pgErrorCode(err)
    if (code === '23505') {
      return NextResponse.json({ error: 'A client with this name already exists' }, { status: 409 })
    }
    console.error('[api/clients PATCH]', err)
    void notifyError({
      message: `Client update failed: ${err instanceof Error ? err.message : String(err)}`,
      severity: 'critical',
    })
    return NextResponse.json({ error: 'Could not update client' }, { status: 500 })
  }
}
