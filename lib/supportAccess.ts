/**
 * Active support session helpers (shared by admin PII lockdown).
 */
import { pool } from '@/lib/db'

export async function hasActiveSupportSession(opts: {
  tenantId?: string | null
  ownerUserId: string
}): Promise<boolean> {
  try {
    await pool.query(
      `UPDATE support_sessions SET is_active = FALSE, ended_at = NOW()
       WHERE is_active = TRUE AND expires_at < NOW()`
    )
    if (opts.tenantId) {
      const { rows } = await pool.query(
        `SELECT 1 FROM support_sessions
         WHERE tenant_id = $1 AND owner_user_id = $2 AND is_active = TRUE AND expires_at > NOW()
         LIMIT 1`,
        [opts.tenantId, opts.ownerUserId]
      )
      return rows.length > 0
    }
    const { rows } = await pool.query(
      `SELECT 1 FROM support_sessions
       WHERE owner_user_id = $1 AND is_active = TRUE AND expires_at > NOW()
       LIMIT 1`,
      [opts.ownerUserId]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export function redactResumePii<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    candidate_name: row.candidate_name ? '[redacted]' : row.candidate_name,
    candidate_email: row.candidate_email ? '[redacted]' : null,
    candidate_phone: row.candidate_phone ? '[redacted]' : null,
    raw_text: row.raw_text != null ? '[redacted — support approval required]' : null,
    resume_text: row.resume_text != null ? '[redacted — support approval required]' : null,
    parsed_data: row.parsed_data != null ? { redacted: true } : row.parsed_data,
    candidate_profile: row.candidate_profile != null ? { redacted: true } : row.candidate_profile,
    nric: null,
    _pii_locked: true,
  }
}
