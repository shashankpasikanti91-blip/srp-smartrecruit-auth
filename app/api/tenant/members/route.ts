/**
 * GET    /api/tenant/members         — list team members
 * POST   /api/tenant/members         — invite a new member (sends email invite)
 * PATCH  /api/tenant/members/[id]    — update role / permissions
 * DELETE /api/tenant/members/[id]    — remove member
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, ROLE_PRESET, getTenantMembers, TenantPermissions } from '@/lib/tenant'
import { pool } from '@/lib/db'
import crypto from 'crypto'

// ── GET: list all members ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'users.manage')
  if (ctx instanceof NextResponse) return ctx

  const members = await getTenantMembers(ctx.tenantId)
  return NextResponse.json({ members })
}

// ── POST: invite member ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'users.invite')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json() as {
    email: string
    role: 'admin' | 'recruiter' | 'member' | 'viewer'
    permissions?: Partial<TenantPermissions>
  }

  if (!body.email?.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const validRoles = ['admin', 'recruiter', 'member', 'viewer']
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 })
  }

  // Check seat limit
  const { rows: tenantRow } = await pool.query<{ max_users: number; member_count: string }>(
    `SELECT t.max_users,
       (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = t.id AND invite_accepted = TRUE) AS member_count
     FROM tenants t WHERE t.id = $1`,
    [ctx.tenantId]
  )
  const maxUsers    = tenantRow[0]?.max_users ?? 3
  const memberCount = parseInt(tenantRow[0]?.member_count ?? '0')
  if (memberCount >= maxUsers) {
    return NextResponse.json(
      { error: `Seat limit reached (${maxUsers}). Upgrade your plan to add more team members.` },
      { status: 422 }
    )
  }

  // Merge base role permissions with any custom overrides
  const basePerms = ROLE_PRESET[body.role]?.() ?? ROLE_PRESET.member()
  const permissions = body.permissions
    ? deepMerge(basePerms as unknown as Record<string, unknown>, body.permissions) as unknown as typeof basePerms
    : basePerms

  // Try to find existing user first
  const { rows: existingUser } = await pool.query<{ id: string; name: string | null }>(
    'SELECT id, name FROM auth_users WHERE email = $1',
    [body.email.toLowerCase()]
  )

  const inviteToken = crypto.randomBytes(32).toString('hex')
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  if (existingUser[0]) {
    // User already exists — add / update membership
    await pool.query(
      `INSERT INTO tenant_members
         (tenant_id, user_id, role, permissions, invite_token, invite_expires, invite_accepted, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
       ON CONFLICT (tenant_id, user_id) DO UPDATE
         SET role = EXCLUDED.role,
             permissions = EXCLUDED.permissions,
             invite_token = EXCLUDED.invite_token,
             invite_expires = EXCLUDED.invite_expires,
             invite_accepted = FALSE,
             invited_by = EXCLUDED.invited_by,
             updated_at = NOW()`,
      [ctx.tenantId, existingUser[0].id, body.role, JSON.stringify(permissions),
       inviteToken, inviteExpiry, ctx.userId]
    )
  } else {
    // Pending invite — user will accept when they register
    // Store in a pending_invites helper table (or we can keep invite_token in tenant_members
    // with a placeholder user_id). Best practice: create the user record as inactive.
    const { rows: newUser } = await pool.query<{ id: string }>(
      `INSERT INTO auth_users (name, email, provider, role, product_access, is_active)
       VALUES ($1, $2, 'invite', 'user', ARRAY['recruit'], FALSE)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [body.email.split('@')[0], body.email.toLowerCase()]
    )
    await pool.query(
      `INSERT INTO tenant_members
         (tenant_id, user_id, role, permissions, invite_token, invite_expires, invite_accepted, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
       ON CONFLICT (tenant_id, user_id) DO UPDATE
         SET role = EXCLUDED.role,
             permissions = EXCLUDED.permissions,
             invite_token = EXCLUDED.invite_token,
             invite_expires = EXCLUDED.invite_expires,
             invite_accepted = FALSE,
             updated_at = NOW()`,
      [ctx.tenantId, newUser[0].id, body.role, JSON.stringify(permissions),
       inviteToken, inviteExpiry, ctx.userId]
    )
  }

  // Existing user → accept-invite page (they log in, then accept)
  // New user       → signup page with pre-filled invite data
  const inviteLink = existingUser[0]
    ? `${process.env.NEXTAUTH_URL}/accept-invite?token=${inviteToken}`
    : `${process.env.NEXTAUTH_URL}/signup?invite=${inviteToken}`

  // Send invite email (non-fatal)
  try {
    const { sendInviteEmail } = await import('@/lib/notifications')
    await sendInviteEmail({
      toEmail:    body.email,
      inviterName: ctx.session.user?.name ?? ctx.userEmail,
      tenantName: ctx.tenantName,
      role:       body.role,
      inviteLink,
    })
  } catch (e) {
    console.error('[tenant/members] invite email failed (non-fatal):', e)
  }

  return NextResponse.json({ ok: true, inviteLink, inviteToken, role: body.role })
}

// ── PATCH: update a member's role/permissions ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'users.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json() as {
    memberId: string
    role?: string
    permissions?: Partial<TenantPermissions>
  }

  if (!body.memberId) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  }

  // Cannot modify own record (prevent privilege escalation)
  const { rows: mRow } = await pool.query<{ user_id: string; role: string }>(
    'SELECT user_id, role FROM tenant_members WHERE id = $1 AND tenant_id = $2',
    [body.memberId, ctx.tenantId]
  )
  if (!mRow[0]) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (mRow[0].user_id === ctx.userId) {
    return NextResponse.json({ error: 'Cannot modify your own membership' }, { status: 422 })
  }
  // Cannot change an owner (only platform admin can)
  if (mRow[0].role === 'owner' && ctx.tenantRole !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can transfer ownership' }, { status: 403 })
  }

  const updates: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (body.role) {
    updates.push(`role = $${idx++}`)
    params.push(body.role)
    if (!body.permissions) {
      // Auto-apply preset when role changes
      const preset = ROLE_PRESET[body.role]?.()
      if (preset) {
        updates.push(`permissions = $${idx++}`)
        params.push(JSON.stringify(preset))
      }
    }
  }
  if (body.permissions) {
    updates.push(`permissions = $${idx++}`)
    const currentPerms = ROLE_PRESET[body.role ?? mRow[0].role]?.() ?? ROLE_PRESET.member()
    params.push(JSON.stringify(deepMerge(currentPerms as unknown as Record<string, unknown>, body.permissions)))
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  updates.push(`updated_at = NOW()`)
  params.push(body.memberId, ctx.tenantId)
  await pool.query(
    `UPDATE tenant_members SET ${updates.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
    params
  )

  return NextResponse.json({ ok: true })
}

// ── DELETE: remove member ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const ctx = await requireTenant(req, 'users.manage')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId query param required' }, { status: 400 })

  const { rows } = await pool.query<{ user_id: string; role: string }>(
    'SELECT user_id, role FROM tenant_members WHERE id = $1 AND tenant_id = $2',
    [memberId, ctx.tenantId]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (rows[0].user_id === ctx.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 422 })
  }
  if (rows[0].role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the owner account' }, { status: 422 })
  }

  await pool.query(
    'DELETE FROM tenant_members WHERE id = $1 AND tenant_id = $2',
    [memberId, ctx.tenantId]
  )
  return NextResponse.json({ ok: true })
}

// ── Utility ───────────────────────────────────────────────────────────────────
function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key of Object.keys(override) as Array<keyof T>) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      typeof base[key] === 'object'
    ) {
      result[key] = { ...base[key] as object, ...override[key] as object } as T[typeof key]
    } else if (override[key] !== undefined) {
      result[key] = override[key] as T[typeof key]
    }
  }
  return result
}
