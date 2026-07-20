import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const prev = await pool.query<{ status: string }>(
    'SELECT status FROM offer_cases WHERE id = $1 AND tenant_id = $2',
    [id, ctx.tenantId]
  )
  if (!prev.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const oldStatus = prev.rows[0].status

  const body = await req.json()
  const sets: string[] = ['updated_at = NOW()']
  const vals: unknown[] = []
  let i = 1

  if (body.status !== undefined) {
    sets.unshift(`status = $${i++}`)
    vals.push(sanitizeText(body.status, 50))
  }
  if (body.offer_salary !== undefined) {
    sets.unshift(`offer_salary = $${i++}`)
    vals.push(sanitizeText(body.offer_salary, 120))
  }
  if (body.expected_joining !== undefined) {
    sets.unshift(`expected_joining = $${i++}`)
    vals.push(body.expected_joining || null)
  }
  if (body.hr_checklist !== undefined) {
    sets.unshift(`hr_checklist = $${i++}::jsonb`)
    vals.push(JSON.stringify(body.hr_checklist))
  }
  if (body.notes !== undefined) {
    sets.unshift(`notes = $${i++}`)
    vals.push(sanitizeText(body.notes, 5000))
  }

  vals.push(id, ctx.tenantId)
  const { rows } = await pool.query(
    `UPDATE offer_cases SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    vals
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = rows[0].status as string
  if (body.status !== undefined && newStatus !== oldStatus) {
    try {
      await pool.query(
        `INSERT INTO offer_history (offer_case_id, tenant_id, user_id, old_status, new_status, details)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, ctx.tenantId, ctx.userId, oldStatus, newStatus, JSON.stringify({ offer_salary: rows[0].offer_salary })]
      )
    } catch { /* ignore */ }
  }

  return NextResponse.json({ offer: rows[0] })
}
