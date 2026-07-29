/**
 * v1.1 Wave 6 — Security hardening checklist (confirmations)
 *
 * Cookies (NextAuth + srp_session_token):
 * - HttpOnly: yes (NextAuth defaults + session-cookie route)
 * - SameSite=lax: yes
 * - Secure in production: yes
 *
 * Headers (next.config.js):
 * - X-Frame-Options SAMEORIGIN
 * - X-Content-Type-Options nosniff
 * - Referrer-Policy strict-origin-when-cross-origin
 * - Permissions-Policy camera/mic/geo disabled
 * - Content-Security-Policy baseline present
 *
 * Auth:
 * - Passwords: bcrypt only (no plaintext)
 * - Lockout via tenant_security_settings + auth_users.locked_until
 * - Rate limits: rely on reverse proxy / platform (nginx) + lockout
 *
 * Uploads:
 * - Existing parse/upload validation hooks remain; virus-scan is a future hook
 *   (stub: call AV provider after multipart accept, before persistence).
 *
 * Owner PII:
 * - /api/admin?view=resumes redacted unless active support_sessions row.
 */
export const SECURITY_HARDENING_CHECKLIST = {
  version: 'v1.1',
  cookies_httponly: true,
  cookies_samesite_lax: true,
  security_headers: true,
  bcrypt_passwords: true,
  owner_pii_locked_by_default: true,
  virus_scan: 'future_hook',
} as const
