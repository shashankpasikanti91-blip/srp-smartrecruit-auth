import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const cand = await pool.query(
    'SELECT id, short_id FROM resumes WHERE id = $1 AND tenant_id = $2',
    [id, ctx.tenantId]
  )
  if (!cand.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { rows } = await pool.query(
      `SELECT id, action, user_email, resource_type, resource_id, details, result,
              old_value, new_value, reason, ip_address, module, created_at
       FROM audit_logs
       WHERE tenant_id = $1
         AND (
           (resource_type = 'candidate' AND resource_id IN ($2, $3))
           OR details::text ILIKE '%' || $3 || '%'
           OR details::text ILIKE '%' || $2 || '%'
         )
       ORDER BY created_at DESC
       LIMIT 100`,
      [ctx.tenantId, cand.rows[0].short_id, id]
    )
    return NextResponse.json({ logs: rows })
  } catch {
    try {
      const { rows } = await pool.query(
        `SELECT id, action, user_email, resource_type, resource_id, details, result, created_at
         FROM audit_logs
         WHERE tenant_id = $1 AND resource_type = 'candidate' AND resource_id = $2
         ORDER BY created_at DESC LIMIT 100`,
        [ctx.tenantId, cand.rows[0].short_id]
      )
      return NextResponse.json({ logs: rows })
    } catch {
      return NextResponse.json({ logs: [] })
    }
  }
}
