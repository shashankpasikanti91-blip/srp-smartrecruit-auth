import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    // Hash the incoming token to match stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Find valid token
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

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update password & mark token as used in a transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE auth_users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, resetToken.user_id]
      )
      await client.query(
        `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
        [resetToken.id]
      )
      // Invalidate all other tokens for this user
      await client.query(
        `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND id != $2`,
        [resetToken.user_id, resetToken.id]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return NextResponse.json({ ok: true, message: 'Password updated successfully. You can now sign in.' })
  } catch (err) {
    console.error('[reset-password] Error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
