/**
 * Tenant password policy + lockout helpers.
 */
import bcrypt from 'bcryptjs'
import { pool } from './db'

export type TenantSecuritySettings = {
  tenant_id: string
  min_length: number
  require_uppercase: boolean
  require_lowercase: boolean
  require_number: boolean
  require_special: boolean
  password_expiry_days: number | null
  password_history_count: number
  max_login_attempts: number
  lock_duration_minutes: number
  mfa_required: boolean
}

const DEFAULTS: Omit<TenantSecuritySettings, 'tenant_id'> = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: false,
  password_expiry_days: null,
  password_history_count: 3,
  max_login_attempts: 5,
  lock_duration_minutes: 30,
  mfa_required: false,
}

export async function getTenantSecuritySettings(tenantId: string): Promise<TenantSecuritySettings> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tenant_security_settings WHERE tenant_id = $1`,
      [tenantId]
    )
    if (rows[0]) {
      return {
        tenant_id: tenantId,
        min_length: rows[0].min_length,
        require_uppercase: rows[0].require_uppercase,
        require_lowercase: rows[0].require_lowercase,
        require_number: rows[0].require_number,
        require_special: rows[0].require_special,
        password_expiry_days: rows[0].password_expiry_days,
        password_history_count: rows[0].password_history_count,
        max_login_attempts: rows[0].max_login_attempts,
        lock_duration_minutes: rows[0].lock_duration_minutes,
        mfa_required: rows[0].mfa_required,
      }
    }
  } catch { /* table may not exist */ }
  return { tenant_id: tenantId, ...DEFAULTS }
}

export async function upsertTenantSecuritySettings(
  tenantId: string,
  patch: Partial<Omit<TenantSecuritySettings, 'tenant_id'>>
): Promise<TenantSecuritySettings> {
  const cur = await getTenantSecuritySettings(tenantId)
  const next = { ...cur, ...patch, tenant_id: tenantId }
  await pool.query(
    `INSERT INTO tenant_security_settings
       (tenant_id, min_length, require_uppercase, require_lowercase, require_number,
        require_special, password_expiry_days, password_history_count,
        max_login_attempts, lock_duration_minutes, mfa_required, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       min_length = EXCLUDED.min_length,
       require_uppercase = EXCLUDED.require_uppercase,
       require_lowercase = EXCLUDED.require_lowercase,
       require_number = EXCLUDED.require_number,
       require_special = EXCLUDED.require_special,
       password_expiry_days = EXCLUDED.password_expiry_days,
       password_history_count = EXCLUDED.password_history_count,
       max_login_attempts = EXCLUDED.max_login_attempts,
       lock_duration_minutes = EXCLUDED.lock_duration_minutes,
       mfa_required = EXCLUDED.mfa_required,
       updated_at = NOW()`,
    [
      tenantId, next.min_length, next.require_uppercase, next.require_lowercase,
      next.require_number, next.require_special, next.password_expiry_days,
      next.password_history_count, next.max_login_attempts, next.lock_duration_minutes,
      next.mfa_required,
    ]
  )
  return next
}

export function validatePasswordComplexity(
  password: string,
  settings: Pick<TenantSecuritySettings, 'min_length' | 'require_uppercase' | 'require_lowercase' | 'require_number' | 'require_special'>
): string | null {
  if (password.length < settings.min_length) {
    return `Password must be at least ${settings.min_length} characters`
  }
  if (settings.require_uppercase && !/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter'
  }
  if (settings.require_lowercase && !/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter'
  }
  if (settings.require_number && !/[0-9]/.test(password)) {
    return 'Password must include a number'
  }
  if (settings.require_special && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character'
  }
  return null
}

export async function assertPasswordNotReused(
  userId: string,
  newPassword: string,
  historyCount: number
): Promise<string | null> {
  if (historyCount <= 0) return null
  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM password_history
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, historyCount]
    )
    for (const r of rows) {
      if (await bcrypt.compare(newPassword, r.password_hash as string)) {
        return `Password was used recently. Choose a different password.`
      }
    }
    // Also check current hash
    const { rows: cur } = await pool.query(
      `SELECT password_hash FROM auth_users WHERE id = $1`,
      [userId]
    )
    if (cur[0]?.password_hash && await bcrypt.compare(newPassword, cur[0].password_hash as string)) {
      return 'New password must be different from your current password'
    }
  } catch { /* ignore if tables missing */ }
  return null
}

export async function recordPasswordHistory(
  userId: string,
  tenantId: string | null,
  passwordHash: string,
  keepCount = 10
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO password_history (user_id, tenant_id, password_hash) VALUES ($1,$2,$3)`,
      [userId, tenantId, passwordHash]
    )
    await pool.query(
      `DELETE FROM password_history WHERE id IN (
         SELECT id FROM password_history WHERE user_id = $1
         ORDER BY created_at DESC OFFSET $2
       )`,
      [userId, keepCount]
    )
  } catch { /* ignore */ }
}

export async function isAccountLocked(userId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT locked_until FROM auth_users WHERE id = $1`,
      [userId]
    )
    const until = rows[0]?.locked_until
    if (!until) return false
    return new Date(until).getTime() > Date.now()
  } catch {
    return false
  }
}

export async function recordFailedLogin(
  userId: string,
  maxAttempts: number,
  lockMinutes: number
): Promise<{ locked: boolean }> {
  try {
    const { rows } = await pool.query(
      `UPDATE auth_users
       SET failed_login_count = COALESCE(failed_login_count, 0) + 1
       WHERE id = $1
       RETURNING failed_login_count`,
      [userId]
    )
    const count = rows[0]?.failed_login_count ?? 0
    if (count >= maxAttempts) {
      await pool.query(
        `UPDATE auth_users SET locked_until = NOW() + ($2 || ' minutes')::interval
         WHERE id = $1`,
        [userId, String(lockMinutes)]
      )
      return { locked: true }
    }
  } catch { /* columns may not exist */ }
  return { locked: false }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE auth_users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
      [userId]
    )
  } catch { /* ignore */ }
}
