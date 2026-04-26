/**
 * GET  /api/tenant/invite?token=XXX  — preview invite details (public, no auth required)
 * POST /api/tenant/invite            — accept invite (requires authenticated user)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

// ── GET: preview invite ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { rows } = await pool.query<{
    invite_accepted: boolean
    invite_expires: string
    role: string
    tenant_name: string
    tenant_slug: string
    invited_email: string
    invited_name: string | null
  }>(
    `SELECT
       tm.invite_accepted, tm.invite_expires, tm.role,
       t.name AS tenant_name, t.slug AS tenant_slug,
       u.email AS invited_email, u.name AS invited_name
     FROM tenant_members tm
     JOIN tenants t ON t.id = tm.tenant_id
     JOIN auth_users u ON u.id = tm.user_id
     WHERE tm.invite_token = $1`,
    [token]
  )

  if (!rows[0]) {
    return NextResponse.json({ error: 'Invalid invite link.' }, { status: 404 })
  }

  if (rows[0].invite_accepted) {
    return NextResponse.json({ error: 'This invite has already been accepted.' }, { status: 410 })
  }

  if (new Date(rows[0].invite_expires) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired.' }, { status: 410 })
  }

  return NextResponse.json({
    email:      rows[0].invited_email,
    name:       rows[0].invited_name,
    tenantName: rows[0].tenant_name,
    tenantSlug: rows[0].tenant_slug,
    role:       rows[0].role,
  })
}

// ── POST: accept invite (logged-in user) ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { token: string }
  if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const user = session.user as Record<string, unknown>
  const userId = user.userId as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the invite — must belong to this user's email address
  const { rows } = await pool.query<{
    id: string; tenant_id: string; user_id: string
    invite_accepted: boolean; invite_expires: string
    invited_email: string
  }>(
    `SELECT
       tm.id, tm.tenant_id, tm.user_id, tm.invite_accepted, tm.invite_expires,
       u.email AS invited_email
     FROM tenant_members tm
     JOIN auth_users u ON u.id = tm.user_id
     WHERE tm.invite_token = $1`,
    [body.token]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Invalid invite.' }, { status: 404 })
  if (rows[0].invite_accepted) return NextResponse.json({ error: 'Invite already accepted.' }, { status: 410 })
  if (new Date(rows[0].invite_expires) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired.' }, { status: 410 })
  }
  if (rows[0].invited_email !== session.user.email) {
    return NextResponse.json({ error: 'This invite is for a different account.' }, { status: 403 })
  }

  // Accept the invite — update to the authenticated user's actual ID (in case the
  // invite stub user_id differs from the real account's id)
  await pool.query(
    `UPDATE tenant_members
     SET invite_accepted = TRUE,
         user_id         = $1,
         invite_token    = NULL,
         invite_expires  = NULL,
         last_active_at  = NOW(),
         updated_at      = NOW()
     WHERE id = $2`,
    [userId, rows[0].id]
  )

  return NextResponse.json({ ok: true, tenantId: rows[0].tenant_id })
}
