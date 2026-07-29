import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'
import {
  getTenantSecuritySettings,
  validatePasswordComplexity,
  assertPasswordNotReused,
  recordPasswordHistory,
} from '@/lib/passwordPolicy'
import { createNotification } from '@/lib/notificationCenter'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { rows } = await pool.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
       FROM password_reset_tokens prt
       JOIN auth_users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1`,
      [tokenHash]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 })
    }

    const resetToken = rows[0]

    if (resetToken.used) {
      return NextResponse.json({ error: 'This reset link has already been used. Please request a new one.' }, { status: 400 })
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })
    }

    const { rows: tm } = await pool.query(
      `SELECT tenant_id FROM tenant_members WHERE user_id = $1 AND invite_accepted = TRUE ORDER BY created_at ASC LIMIT 1`,
      [resetToken.user_id]
    )
    const tenantId = tm[0]?.tenant_id as string | undefined
    if (tenantId) {
      const settings = await getTenantSecuritySettings(tenantId)
      const complexity = validatePasswordComplexity(password, settings)
      if (complexity) return NextResponse.json({ error: complexity }, { status: 400 })
      const reused = await assertPasswordNotReused(resetToken.user_id, password, settings.password_history_count)
      if (reused) return NextResponse.json({ error: reused }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: old } = await client.query(
        `SELECT password_hash FROM auth_users WHERE id = $1`,
        [resetToken.user_id]
      )
      await client.query(
        `UPDATE auth_users SET password_hash = $1, password_changed_at = NOW(), failed_login_count = 0, locked_until = NULL WHERE id = $2`,
        [passwordHash, resetToken.user_id]
      )
      await client.query(
        `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
        [resetToken.id]
      )
      await client.query(
        `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND id != $2`,
        [resetToken.user_id, resetToken.id]
      )
      await client.query('COMMIT')
      if (old[0]?.password_hash) {
        await recordPasswordHistory(resetToken.user_id, tenantId ?? null, old[0].password_hash as string)
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    if (tenantId) {
      await createNotification({
        tenantId,
        userId: resetToken.user_id,
        category: 'security',
        title: 'Password reset completed',
        body: 'Your password was reset successfully.',
      }).catch(() => {})
      await logAudit({
        userId: resetToken.user_id,
        userEmail: resetToken.email,
        tenantId,
        action: 'password_reset',
        resourceType: 'auth_user',
        module: 'security',
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, message: 'Password updated successfully. You can now sign in.' })
  } catch (err) {
    console.error('[reset-password] Error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
