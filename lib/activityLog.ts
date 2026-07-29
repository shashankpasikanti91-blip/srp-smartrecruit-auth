import { pool } from './db'

export async function logDataAccess(opts: {
  tenantId: string
  userId: string
  userRole?: string
  accessType: string
  resourceType: string
  resourceId?: string
  ipAddress?: string
}) {
  try {
    await pool.query(
      `INSERT INTO data_access_logs
         (tenant_id, user_id, access_type, resource_type, resource_id, user_role, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        opts.tenantId, opts.userId, opts.accessType, opts.resourceType,
        opts.resourceId ?? null, opts.userRole ?? null, opts.ipAddress ?? null,
      ]
    )
  } catch {
    /* table may not exist yet */
  }
}

export async function logUserActivity(opts: {
  tenantId?: string
  userId: string
  action: string
  resourceType?: string
  resourceId?: string
  pagePath?: string
  details?: Record<string, unknown>
  ipAddress?: string
}) {
  try {
    await pool.query(
      `INSERT INTO user_activity_logs
         (tenant_id, user_id, action, resource_type, resource_id, page_path, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        opts.tenantId ?? null, opts.userId, opts.action,
        opts.resourceType ?? null, opts.resourceId ?? null,
        opts.pagePath ?? null, JSON.stringify(opts.details ?? {}),
        opts.ipAddress ?? null,
      ]
    )
  } catch {
    /* table may not exist yet */
  }
}

export async function logLogin(opts: {
  tenantId?: string
  userId?: string | null
  email?: string
  success?: boolean
  ipAddress?: string
  userAgent?: string
  failureReason?: string
  role?: string | null
  sessionToken?: string | null
  browser?: string | null
  os?: string | null
  deviceName?: string | null
}) {
  try {
    await pool.query(
      `INSERT INTO login_history
         (tenant_id, user_id, email, success, ip_address, user_agent, failure_reason,
          role, session_token, browser, os, device_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        opts.tenantId ?? null, opts.userId ?? null, opts.email ?? null,
        opts.success ?? true, opts.ipAddress ?? null, opts.userAgent ?? null,
        opts.failureReason ?? null,
        opts.role ?? null, opts.sessionToken ?? null,
        opts.browser ?? null, opts.os ?? null, opts.deviceName ?? null,
      ]
    )
  } catch {
    try {
      await pool.query(
        `INSERT INTO login_history
           (tenant_id, user_id, email, success, ip_address, user_agent, failure_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          opts.tenantId ?? null, opts.userId ?? null, opts.email ?? null,
          opts.success ?? true, opts.ipAddress ?? null, opts.userAgent ?? null,
          opts.failureReason ?? null,
        ]
      )
    } catch {
      /* table may not exist yet */
    }
  }
}
