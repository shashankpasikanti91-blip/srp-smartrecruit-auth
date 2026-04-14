import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { pool } from '@/lib/db'
import { sendEmail } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Look up user (only credentials users can reset password)
    const { rows } = await pool.query(
      `SELECT id, name, email, provider FROM auth_users WHERE email = $1`,
      [normalizedEmail]
    )

    // Always return success to prevent email enumeration
    const successMsg = { ok: true, message: 'If an account with that email exists, a password reset link has been sent.' }

    if (rows.length === 0) {
      return NextResponse.json(successMsg)
    }

    const user = rows[0]

    // Google-only users can't reset password
    if (user.provider === 'google' && !user.password_hash) {
      // Send them a helpful email instead
      await sendEmail({
        to: user.email,
        subject: 'Password Reset — SRP SmartRecruit',
        html: buildGoogleOnlyEmail(user.name ?? 'there'),
      })
      return NextResponse.json(successMsg)
    }

    // Invalidate any existing unused tokens for this user
    await pool.query(
      `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    )

    // Generate secure token (64 bytes hex = 128 chars)
    const rawToken = crypto.randomBytes(64).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt.toISOString()]
    )

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL ?? 'https://recruit.srpailabs.com'
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Reset Your Password — SRP SmartRecruit',
      html: buildResetEmail(user.name ?? 'there', resetUrl),
    })

    return NextResponse.json(successMsg)
  } catch (err) {
    console.error('[forgot-password] Error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

function buildResetEmail(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);text-align:center;line-height:48px">
        <span style="color:#fff;font-size:20px;font-weight:bold">⚡</span>
      </div>
      <h1 style="color:#fff;font-size:20px;margin:16px 0 0;font-weight:700">SRP SmartRecruit</h1>
    </div>

    <!-- Card -->
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;text-align:center">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(99,102,241,0.15);margin:0 auto 20px;text-align:center;line-height:56px">
        <span style="font-size:24px">🔐</span>
      </div>
      <h2 style="color:#f9fafb;font-size:18px;margin:0 0 8px;font-weight:700">Reset Your Password</h2>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6">
        Hi ${name}, we received a request to reset your password. Click the button below to create a new one.
      </p>
      <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(99,102,241,0.3)">
        Reset Password
      </a>
      <p style="color:#6b7280;font-size:12px;margin:24px 0 0;line-height:1.5">
        This link expires in <b style="color:#9ca3af">1 hour</b>. If you didn't request this, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px">
      <p style="color:#4b5563;font-size:11px;margin:0">
        SRP AI Labs &bull; AI-Powered Recruitment Platform<br>
        <a href="https://recruit.srpailabs.com" style="color:#6366f1;text-decoration:none">recruit.srpailabs.com</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildGoogleOnlyEmail(name: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px">
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;text-align:center">
      <h2 style="color:#f9fafb;font-size:18px;margin:0 0 12px">Password Reset Request</h2>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6">
        Hi ${name}, your account was created with Google Sign-In, so there's no password to reset.
        Simply sign in using the <b style="color:#f9fafb">Google</b> button on the login page.
      </p>
      <a href="https://recruit.srpailabs.com/login" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#6366f1;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">
        Go to Login
      </a>
    </div>
  </div>
</body>
</html>`
}
