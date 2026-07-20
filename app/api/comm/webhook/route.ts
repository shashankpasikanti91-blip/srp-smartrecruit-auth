import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'

/**
 * Provider-agnostic delivery webhook stub.
 * Accepts { log_id | message_id, event: delivered|opened|read|failed, reason? }
 * No auth provider signature validation in v1 — protect via network / secret header if set.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.COMM_WEBHOOK_SECRET
  if (secret) {
    const hdr = req.headers.get('x-comm-webhook-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (hdr !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const logId = (body.log_id || body.message_id || body.id) as string
  const event = String(body.event || body.status || body.delivery_status || '').toLowerCase()

  if (!logId || !isValidUUID(logId) || !event) {
    return NextResponse.json({ error: 'log_id and event required' }, { status: 400 })
  }

  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  if (event === 'delivered' || event === 'sent') {
    sets.push(`delivery_status = $${i++}`, `status = 'sent'`)
    vals.push(event === 'delivered' ? 'delivered' : 'sent')
  } else if (event === 'opened') {
    sets.push(`delivery_status = 'opened'`, `opened_at = COALESCE(opened_at, NOW())`)
  } else if (event === 'read') {
    sets.push(`delivery_status = 'read'`, `opened_at = COALESCE(opened_at, NOW())`, `read_at = COALESCE(read_at, NOW())`)
  } else if (event === 'failed' || event === 'bounce') {
    sets.push(`delivery_status = 'failed'`, `status = 'failed'`)
    if (body.reason) {
      sets.push(`failed_reason = $${i++}`)
      vals.push(String(body.reason).slice(0, 500))
    }
  } else {
    sets.push(`delivery_status = $${i++}`)
    vals.push(event)
  }

  vals.push(logId)
  try {
    const { rowCount } = await pool.query(
      `UPDATE communication_logs SET ${sets.join(', ')} WHERE id = $${i}`,
      vals
    )
    if (!rowCount) return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    return NextResponse.json({ ok: true, event })
  } catch (e) {
    console.error('[comm/webhook]', e)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
