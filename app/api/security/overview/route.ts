/**
 * GET  /api/security/overview — Security Center KPIs
 * Prefer this over duplicating governance metrics.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { listUserSessions } from '@/lib/sessions'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const days = Math.min(90, parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10) || 7)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const isAdmin = ctx.tenantRole === 'owner' || ctx.tenantRole === 'admin'

  const [
    mySessions,
    failedMine,
    successMine,
    lastSuccess,
    lastFail,
    tenantFailed,
    tenantActive,
    mfaRow,
    policyRow,
    recentSecurity,
  ] = await Promise.all([
    listUserSessions(ctx.userId),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM login_history
       WHERE user_id = $1 AND success = FALSE AND created_at >= $2`,
      [ctx.userId, sinceIso]
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM login_history
       WHERE user_id = $1 AND success = TRUE AND created_at >= $2`,
      [ctx.userId, sinceIso]
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `SELECT created_at, ip_address, user_agent FROM login_history
       WHERE user_id = $1 AND success = TRUE ORDER BY created_at DESC LIMIT 1`,
      [ctx.userId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT created_at, ip_address, failure_reason FROM login_history
       WHERE user_id = $1 AND success = FALSE ORDER BY created_at DESC LIMIT 1`,
      [ctx.userId]
    ).catch(() => ({ rows: [] })),
    isAdmin
      ? pool.query(
          `SELECT COUNT(*)::int AS c FROM login_history
           WHERE tenant_id = $1 AND success = FALSE AND created_at >= $2`,
          [ctx.tenantId, sinceIso]
        ).catch(() => ({ rows: [{ c: 0 }] }))
      : Promise.resolve({ rows: [{ c: 0 }] }),
    isAdmin
      ? pool.query(
          `SELECT COUNT(*)::int AS c FROM user_sessions
           WHERE tenant_id = $1 AND is_active = TRUE`,
          [ctx.tenantId]
        ).catch(() => ({ rows: [{ c: 0 }] }))
      : Promise.resolve({ rows: [{ c: 0 }] }),
    pool.query(
      `SELECT mfa_enabled FROM auth_users WHERE id = $1`,
      [ctx.userId]
    ).catch(() => ({ rows: [{ mfa_enabled: false }] })),
    pool.query(
      `SELECT * FROM tenant_security_settings WHERE tenant_id = $1`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT action, resource_type, user_email, created_at, result, details
       FROM audit_logs
       WHERE tenant_id = $1 AND (module = 'security' OR action ILIKE '%login%' OR action ILIKE '%session%' OR action ILIKE '%password%' OR action ILIKE '%mfa%' OR action ILIKE '%support%')
       ORDER BY created_at DESC LIMIT 25`,
      [ctx.tenantId]
    ).catch(() => ({ rows: [] })),
  ])

  const activeMine = mySessions.filter(s => s.is_active).length
  const mfaEnabled = Boolean(mfaRow.rows[0]?.mfa_enabled)
  const policy = policyRow.rows[0] ?? {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_number: true,
    require_special: false,
    max_login_attempts: 5,
    lock_duration_minutes: 30,
    mfa_required: false,
    password_history_count: 3,
  }

  // Simple additive score 0–100
  let score = 40
  if (mfaEnabled) score += 25
  if (policy.mfa_required) score += 10
  if ((policy.min_length ?? 8) >= 10) score += 5
  if (policy.require_special) score += 5
  if (activeMine <= 3) score += 5
  if ((failedMine.rows[0]?.c ?? 0) === 0) score += 10
  score = Math.min(100, score)

  return NextResponse.json({
    period_days: days,
    security_score: score,
    mfa_enabled: mfaEnabled,
    mfa_required: Boolean(policy.mfa_required),
    active_sessions_mine: activeMine,
    active_sessions_tenant: tenantActive.rows[0]?.c ?? 0,
    failed_logins_mine: failedMine.rows[0]?.c ?? 0,
    failed_logins_tenant: tenantFailed.rows[0]?.c ?? 0,
    successful_logins_mine: successMine.rows[0]?.c ?? 0,
    last_success: lastSuccess.rows[0] ?? null,
    last_failure: lastFail.rows[0] ?? null,
    password_policy: {
      min_length: policy.min_length,
      require_uppercase: policy.require_uppercase,
      require_lowercase: policy.require_lowercase,
      require_number: policy.require_number,
      require_special: policy.require_special,
      max_login_attempts: policy.max_login_attempts,
      lock_duration_minutes: policy.lock_duration_minutes,
      password_history_count: policy.password_history_count,
      mfa_required: policy.mfa_required,
    },
    placeholders: {
      export_pack: true,
      support_access: true,
      backup_status: 'platform_managed',
    },
    recent_events: recentSecurity.rows,
    is_admin: isAdmin,
  })
}
