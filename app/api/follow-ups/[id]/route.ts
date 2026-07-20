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

  const body = await req.json()
  const status = sanitizeText(body.status, 20)
  const sets = ['updated_at = NOW()']
  const vals: unknown[] = []
  let i = 1

  if (status) {
    sets.unshift(`status = $${i++}`)
    vals.push(status)
    if (status === 'done') {
      sets.push(`completed_at = NOW()`)
    }
  }
  if (body.notes !== undefined) {
    sets.unshift(`notes = $${i++}`)
    vals.push(sanitizeText(body.notes, 2000))
  }
  if (body.due_at !== undefined) {
    sets.unshift(`due_at = $${i++}`)
    vals.push(body.due_at)
  }

  vals.push(id, ctx.tenantId)
  const { rows } = await pool.query(
    `UPDATE follow_ups SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    vals
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ follow_up: rows[0] })
}
