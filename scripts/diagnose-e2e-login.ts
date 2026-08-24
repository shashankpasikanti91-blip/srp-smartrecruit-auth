/**
 * Diagnose local E2E login readiness (no secrets printed).
 * npx tsx scripts/diagnose-e2e-login.ts
 */
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import pg from 'pg'
import path from 'path'

config({ path: path.resolve(__dirname, '..', '.env.local') })
config({ path: path.resolve(__dirname, '..', '.env.e2e.local'), override: true })

async function main() {
  const url = process.env.DATABASE_URL
  const email = (process.env.E2E_USER_EMAIL || process.env.E2E_DEMO_EMAIL || 'demo@srpailabs.com')
    .trim()
    .toLowerCase()
  const password =
    process.env.E2E_USER_PASSWORD || process.env.E2E_DEMO_PASSWORD || 'Demo@1234'

  const out: Record<string, unknown> = {
    hasDatabaseUrl: Boolean(url),
    nextauthUrl: process.env.NEXTAUTH_URL || null,
    emailDomain: email.includes('@') ? email.split('@')[1] : null,
    passwordConfigured: Boolean(password),
  }

  if (!url) {
    console.log(JSON.stringify(out, null, 2))
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: url })
  try {
    const { rows } = await pool.query(
      `SELECT id, is_active, password_hash IS NOT NULL AS has_hash,
              locked_until, failed_login_count,
              COALESCE(mfa_enabled, false) AS mfa_enabled
       FROM auth_users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    )
    if (!rows[0]) {
      out.userFound = false
      console.log(JSON.stringify(out, null, 2))
      process.exit(2)
    }
    const u = rows[0]
    out.userFound = true
    out.isActive = u.is_active
    out.hasHash = u.has_hash
    out.locked = u.locked_until != null && new Date(u.locked_until) > new Date()
    out.failedLoginCount = Number(u.failed_login_count ?? 0)
    out.mfaEnabled = Boolean(u.mfa_enabled)

    if (u.has_hash && password) {
      const { rows: hashRows } = await pool.query(
        `SELECT password_hash FROM auth_users WHERE id = $1`,
        [u.id],
      )
      out.passwordMatches = await bcrypt.compare(password, hashRows[0].password_hash)
    } else {
      out.passwordMatches = false
    }

    const { rows: mem } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tenant_members
       WHERE user_id = $1 AND invite_accepted = TRUE`,
      [u.id],
    )
    out.acceptedTenants = mem[0].n
  } finally {
    await pool.end()
  }

  console.log(JSON.stringify(out, null, 2))
  const ok =
    out.userFound &&
    out.isActive &&
    out.hasHash &&
    out.passwordMatches &&
    !out.locked &&
    !out.mfaEnabled &&
    (out.acceptedTenants as number) > 0
  process.exit(ok ? 0 : 3)
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
