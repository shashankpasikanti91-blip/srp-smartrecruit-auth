import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPermission } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID, sanitizeText } from '@/lib/validate'

function canUseCoach(ctx: { permissions: Parameters<typeof checkPermission>[0] }) {
  return checkPermission(ctx.permissions, 'ai_compose.use') || checkPermission(ctx.permissions, 'ai_screen.use')
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (!canUseCoach(ctx)) return NextResponse.json({ error: 'Forbidden', sessions: [] }, { status: 403 })

  try {
    const { rows } = await pool.query(
      `SELECT id, title, pinned, context, working_set, updated_at, created_at,
              jsonb_array_length(messages) AS message_count
       FROM coach_sessions
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY pinned DESC, updated_at DESC
       LIMIT 40`,
      [ctx.tenantId, ctx.userId]
    )
    return NextResponse.json({ sessions: rows })
  } catch {
    return NextResponse.json({ sessions: [] })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (!canUseCoach(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const title = sanitizeText(body.title, 120) ?? 'New chat'
  const id = typeof body.id === 'string' && isValidUUID(body.id) ? body.id : undefined

  try {
    if (id) {
      const { rows } = await pool.query(
        `INSERT INTO coach_sessions (id, tenant_id, user_id, title, messages)
         VALUES ($1,$2,$3,$4,'[]'::jsonb)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
         RETURNING *`,
        [id, ctx.tenantId, ctx.userId, title]
      )
      return NextResponse.json({ session: rows[0] }, { status: 201 })
    }
    const { rows } = await pool.query(
      `INSERT INTO coach_sessions (tenant_id, user_id, title, messages)
       VALUES ($1,$2,$3,'[]'::jsonb) RETURNING *`,
      [ctx.tenantId, ctx.userId, title]
    )
    return NextResponse.json({ session: rows[0] }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  const body = await req.json().catch(() => ({}))
  const id = body.id as string
  if (!isValidUUID(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sets: string[] = ['updated_at = NOW()']
  const vals: unknown[] = []
  let i = 1
  if (body.pinned !== undefined) {
    sets.push(`pinned = $${i++}`)
    vals.push(!!body.pinned)
  }
  if (body.title !== undefined) {
    sets.push(`title = $${i++}`)
    vals.push(sanitizeText(body.title, 120))
  }
  vals.push(id, ctx.tenantId, ctx.userId)
  try {
    await pool.query(
      `UPDATE coach_sessions SET ${sets.join(', ')}
       WHERE id = $${i} AND tenant_id = $${i + 1} AND user_id = $${i + 2}`,
      vals
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
