/**
 * POST /api/security/change-password
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notificationCenter'
import {
  getTenantSecuritySettings,
  validatePasswordComplexity,
  assertPasswordNotReused,
  recordPasswordHistory,
} from '@/lib/passwordPolicy'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  let body: { current_password?: string; new_password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.current_password || !body.new_password) {
    return NextResponse.json({ error: 'current_password and new_password required' }, { status: 422 })
  }

  const settings = await getTenantSecuritySettings(ctx.tenantId)
  const complexity = validatePasswordComplexity(body.new_password, settings)
  if (complexity) return NextResponse.json({ error: complexity }, { status: 422 })

  const reused = await assertPasswordNotReused(ctx.userId, body.new_password, settings.password_history_count)
  if (reused) return NextResponse.json({ error: reused }, { status: 422 })

  const { rows } = await pool.query(
    `SELECT password_hash FROM auth_users WHERE id = $1`,
    [ctx.userId]
  )
  const hash = rows[0]?.password_hash as string | undefined
  if (!hash) {
    return NextResponse.json({
      error: 'No password set for this account (Google sign-in). Use Forgot password to set one.',
    }, { status: 400 })
  }
  const ok = await bcrypt.compare(body.current_password, hash)
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

  const newHash = await bcrypt.hash(body.new_password, 12)
  await recordPasswordHistory(ctx.userId, ctx.tenantId, hash)
  await pool.query(
    `UPDATE auth_users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [newHash, ctx.userId]
  )

  await createNotification({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    category: 'security',
    title: 'Password changed',
    body: 'Your account password was updated. If this was not you, contact your admin immediately.',
    link: '/dashboard',
  })
  await logAudit({
    userId: ctx.userId, userEmail: ctx.userEmail, tenantId: ctx.tenantId,
    action: 'password_changed', resourceType: 'auth_user', resourceId: ctx.userId,
    module: 'security',
  })

  return NextResponse.json({ ok: true })
}
