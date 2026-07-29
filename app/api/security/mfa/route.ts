/**
 * MFA setup / verify / disable
 * GET  /api/security/mfa — status
 * POST /api/security/mfa — { action: 'begin'|'confirm'|'disable'|'email_otp_send'|'email_otp_verify', code? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'
import {
  generateTotpSecret,
  totpUri,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  getEnabledTotpSecret,
} from '@/lib/mfa'
import { sendEmailFromTenant } from '@/lib/email-oauth'

const emailOtpStore = new Map<string, { code: string; expires: number }>()

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  const { rows: userRows } = await pool.query(
    `SELECT mfa_enabled FROM auth_users WHERE id = $1`,
    [ctx.userId]
  ).catch(() => ({ rows: [{ mfa_enabled: false }] as { mfa_enabled: boolean }[] }))
  const { rows: devices } = await pool.query(
    `SELECT id, method, label, is_enabled, verified_at, created_at
     FROM mfa_devices WHERE user_id = $1 ORDER BY created_at DESC`,
    [ctx.userId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }))
  return NextResponse.json({
    mfa_enabled: Boolean(userRows[0]?.mfa_enabled),
    devices,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  let body: { action?: string; code?: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.action === 'begin') {
    const secret = generateTotpSecret()
    await pool.query(
      `INSERT INTO mfa_devices (user_id, tenant_id, method, label, secret_enc, is_enabled)
       VALUES ($1,$2,'totp',$3,$4,FALSE)`,
      [ctx.userId, ctx.tenantId, body.label || 'Authenticator', secret]
    ).catch(async () => {
      /* if table missing, still return secret for UX in memory — prefer failing soft */
    })
    return NextResponse.json({
      secret,
      otpauth_url: totpUri(secret, ctx.userEmail),
      message: 'Scan with your authenticator app, then confirm with a 6-digit code.',
    })
  }

  if (body.action === 'confirm') {
    if (!body.code) return NextResponse.json({ error: 'code required' }, { status: 422 })
    const { rows } = await pool.query(
      `SELECT id, secret_enc FROM mfa_devices
       WHERE user_id = $1 AND method = 'totp' AND is_enabled = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [ctx.userId]
    )
    if (!rows[0]) return NextResponse.json({ error: 'No pending MFA setup' }, { status: 400 })
    if (!verifyTotp(rows[0].secret_enc as string, body.code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
    }
    const codes = generateRecoveryCodes(8)
    await pool.query(
      `UPDATE mfa_devices SET is_enabled = TRUE, verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [rows[0].id]
    )
    await pool.query(`UPDATE auth_users SET mfa_enabled = TRUE WHERE id = $1`, [ctx.userId])
    await pool.query(`DELETE FROM mfa_recovery_codes WHERE user_id = $1`, [ctx.userId]).catch(() => {})
    for (const c of codes) {
      await pool.query(
        `INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES ($1,$2)`,
        [ctx.userId, hashRecoveryCode(c)]
      ).catch(() => {})
    }
    await createNotification({
      tenantId: ctx.tenantId, userId: ctx.userId, category: 'security',
      title: 'MFA enabled', body: 'Authenticator MFA is now active on your account.',
    })
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'mfa_enabled', resourceType: 'mfa_device', module: 'security',
    })
    return NextResponse.json({ ok: true, recovery_codes: codes })
  }

  if (body.action === 'disable') {
    if (!body.code) return NextResponse.json({ error: 'code required' }, { status: 422 })
    const secret = await getEnabledTotpSecret(ctx.userId)
    if (secret && !verifyTotp(secret, body.code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
    }
    await pool.query(`UPDATE mfa_devices SET is_enabled = FALSE WHERE user_id = $1`, [ctx.userId])
    await pool.query(`UPDATE auth_users SET mfa_enabled = FALSE WHERE id = $1`, [ctx.userId])
    await logAudit({
      userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
      action: 'mfa_disabled', resourceType: 'mfa_device', module: 'security',
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'email_otp_send') {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    emailOtpStore.set(ctx.userId, { code, expires: Date.now() + 10 * 60 * 1000 })
    try {
      await sendEmailFromTenant(ctx.tenantId, ctx.userId, {
        to: ctx.userEmail,
        subject: 'Your SRP SmartRecruit security code',
        html: `<p>Your one-time code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
        text: `Your one-time code is ${code}. It expires in 10 minutes.`,
      })
    } catch (err) {
      return NextResponse.json({
        error: err instanceof Error ? err.message : 'Could not send OTP email',
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, message: 'OTP sent to your email' })
  }

  if (body.action === 'email_otp_verify') {
    const entry = emailOtpStore.get(ctx.userId)
    if (!entry || entry.expires < Date.now() || entry.code !== body.code) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }
    emailOtpStore.delete(ctx.userId)
    await pool.query(
      `INSERT INTO mfa_devices (user_id, tenant_id, method, label, is_enabled, verified_at)
       VALUES ($1,$2,'email','Email OTP',TRUE,NOW())
       ON CONFLICT DO NOTHING`,
      [ctx.userId, ctx.tenantId]
    ).catch(() => {})
    await pool.query(`UPDATE auth_users SET mfa_enabled = TRUE WHERE id = $1`, [ctx.userId])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 422 })
}
