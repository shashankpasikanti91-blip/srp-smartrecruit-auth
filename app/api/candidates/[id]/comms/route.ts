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

  const channel = req.nextUrl.searchParams.get('channel') ?? 'email'
  const cand = await pool.query(
    'SELECT id, candidate_email, candidate_phone FROM resumes WHERE id = $1 AND tenant_id = $2',
    [id, ctx.tenantId]
  )
  if (!cand.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { rows } = await pool.query(
      `SELECT id, channel, recipient, subject, body, status, delivery_status,
              template_name, message_type, attachment_paths, opened_at, read_at,
              failed_reason, created_at
       FROM communication_logs
       WHERE (resume_id = $1 OR (tenant_id = $2 AND (
              recipient = $3 OR recipient = $4
            )))
         AND channel ILIKE $5
       ORDER BY created_at DESC
       LIMIT 100`,
      [
        id,
        ctx.tenantId,
        cand.rows[0].candidate_email ?? '',
        cand.rows[0].candidate_phone ?? '',
        channel === 'whatsapp' ? '%whatsapp%' : '%email%',
      ]
    )
    return NextResponse.json({ logs: rows })
  } catch {
    // Fallback without enriched columns
    try {
      const { rows } = await pool.query(
        `SELECT id, channel, recipient, subject, status, created_at
         FROM communication_logs
         WHERE resume_id = $1 OR (tenant_id = $2 AND recipient = $3)
         ORDER BY created_at DESC LIMIT 100`,
        [id, ctx.tenantId, cand.rows[0].candidate_email ?? '']
      )
      const filtered = rows.filter((r: { channel: string }) =>
        channel === 'whatsapp'
          ? r.channel?.toLowerCase().includes('whatsapp')
          : r.channel?.toLowerCase().includes('email') || r.channel === 'email'
      )
      return NextResponse.json({ logs: filtered })
    } catch {
      return NextResponse.json({ logs: [] })
    }
  }
}
