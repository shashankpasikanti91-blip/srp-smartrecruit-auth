import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'
import { logActivity } from '@/lib/db'
import { notifyNewSignup, sendWelcomeEmail } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, inviteToken } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ── Invite-based registration ──────────────────────────────────────────────
    if (inviteToken && typeof inviteToken === 'string') {
      // Look up the invite: must be pending, not expired, and belong to this email address
      const { rows: inviteRows } = await pool.query<{
        member_id: string; user_id: string; invited_email: string
        invite_expires: string; tenant_id: string
      }>(
        `SELECT tm.id AS member_id, tm.user_id, u.email AS invited_email,
                tm.invite_expires, tm.tenant_id
         FROM tenant_members tm
         JOIN auth_users u ON u.id = tm.user_id
         WHERE tm.invite_token = $1
           AND tm.invite_accepted = FALSE
           AND tm.invite_expires > NOW()`,
        [inviteToken]
      )

      if (!inviteRows[0]) {
        return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 400 })
      }

      // Verify the signup email matches the invited email
      if (inviteRows[0].invited_email !== normalizedEmail) {
        return NextResponse.json(
          { error: `This invite was sent to ${inviteRows[0].invited_email}. Please use that email address to accept.` },
          { status: 400 }
        )
      }

      const { member_id, user_id } = inviteRows[0]
      const password_hash = await bcrypt.hash(password, 12)

      // Activate the pre-created user record and set credentials
      await pool.query(
        `UPDATE auth_users
         SET password_hash = $1, name = $2, provider = 'credentials',
             is_active = TRUE, updated_at = NOW()
         WHERE id = $3`,
        [password_hash, name?.trim() || normalizedEmail.split('@')[0], user_id]
      )

      // Accept the invite
      await pool.query(
        `UPDATE tenant_members
         SET invite_accepted = TRUE, invite_token = NULL, invite_expires = NULL,
             last_active_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [member_id]
      )

      // Provision free subscription so user-level limits work
      await pool.query(
        `INSERT INTO subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
         VALUES ($1, 'free', 'active', 'monthly', 0, 'usd')
         ON CONFLICT DO NOTHING`,
        [user_id]
      )

      const displayName = name?.trim() || normalizedEmail.split('@')[0]
      logActivity({
        user_id,
        event_type: 'signup',
        event_data: { email: normalizedEmail, provider: 'credentials', via: 'invite' },
        severity: 'info',
      }).catch(() => {})
      notifyNewSignup({ name: displayName, email: normalizedEmail, provider: 'invite' }).catch(() => {})
      sendWelcomeEmail({ name: displayName, email: normalizedEmail, provider: 'credentials' }).catch(() => {})

      return NextResponse.json({ ok: true, userId: user_id }, { status: 201 })
    }

    // ── Standard registration ──────────────────────────────────────────────────
    // Check for existing active account (inactive invite stubs are allowed to sign up)
    const { rows: existing } = await pool.query(
      `SELECT id FROM auth_users WHERE email = $1 AND is_active = TRUE`, [normalizedEmail]
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)

    // If an inactive stub exists (leftover from a cancelled invite), reuse it
    const { rows: stubRows } = await pool.query<{ id: string }>(
      `SELECT id FROM auth_users WHERE email = $1 AND is_active = FALSE`, [normalizedEmail]
    )

    let userId: string
    if (stubRows[0]) {
      await pool.query(
        `UPDATE auth_users
         SET password_hash = $1, name = $2, provider = 'credentials',
             is_active = TRUE, updated_at = NOW()
         WHERE id = $3`,
        [password_hash, name?.trim() || null, stubRows[0].id]
      )
      userId = stubRows[0].id
    } else {
      const { rows, rowCount } = await pool.query(
        `INSERT INTO auth_users (name, email, image, provider, provider_id, password_hash, role, product_access, is_active)
         VALUES ($1,$2,NULL,'credentials',NULL,$3,'user',ARRAY['recruit'],true)
         RETURNING id`,
        [name?.trim() || null, normalizedEmail, password_hash]
      )
      if (!rowCount) {
        return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
      }
      userId = rows[0].id
    }

    // Auto-provision free subscription
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
       VALUES ($1, 'free', 'active', 'monthly', 0, 'usd')
       ON CONFLICT DO NOTHING`,
      [userId]
    )

    const displayName = name?.trim() || null
    logActivity({
      user_id: userId,
      event_type: 'signup',
      event_data: { email: normalizedEmail, provider: 'credentials', name: displayName },
      severity: 'info',
    }).catch(() => {})
    notifyNewSignup({ name: displayName, email: normalizedEmail, provider: 'credentials' }).catch(() => {})
    sendWelcomeEmail({ name: displayName, email: normalizedEmail, provider: 'credentials' }).catch(() => {})

    return NextResponse.json({ ok: true, userId }, { status: 201 })
  } catch (err) {
    console.error('[signup] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
