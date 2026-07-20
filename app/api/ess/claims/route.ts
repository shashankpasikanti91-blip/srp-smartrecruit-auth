import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'

/** Employee claims / HR requests — uses existing hr_requests table (v19). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { rows } = await pool.query(
      `SELECT id, request_type, title, description, status, created_at, updated_at
       FROM hr_requests
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [ctx.tenantId, ctx.userId]
    )
    return NextResponse.json({ claims: rows })
  } catch {
    return NextResponse.json({ claims: [], error: 'Claims table unavailable' })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const claimType = sanitizeText(body.claim_type, 60) ?? 'general'
  const amount = sanitizeText(String(body.amount ?? ''), 40)
  const claimDate = sanitizeText(body.claim_date, 20)
  const remarks = sanitizeText(body.remarks, 1000)
  const title = sanitizeText(body.title, 160) ?? `${claimType} claim`

  if (!title.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const description = [
    claimDate ? `Date: ${claimDate}` : null,
    amount ? `Amount: ${amount}` : null,
    remarks ? `Remarks: ${remarks}` : null,
  ].filter(Boolean).join('\n') || null

  try {
    const { rows } = await pool.query(
      `INSERT INTO hr_requests (tenant_id, user_id, request_type, title, description, status)
       VALUES ($1, $2, 'hr', $3, $4, 'pending')
       RETURNING id, request_type, title, description, status, created_at, updated_at`,
      [ctx.tenantId, ctx.userId, title, description]
    )
    return NextResponse.json({ claim: rows[0] }, { status: 201 })
  } catch (e) {
    console.error('[ess/claims]', e)
    return NextResponse.json({ error: 'Could not submit claim' }, { status: 500 })
  }
}
