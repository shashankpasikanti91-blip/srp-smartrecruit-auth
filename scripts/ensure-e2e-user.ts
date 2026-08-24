/**
 * Ensure local E2E login user exists with a known password + tenant membership.
 * Usage (from nextjs-auth):
 *   npx tsx scripts/ensure-e2e-user.ts
 *
 * Reads DATABASE_URL from .env.local and credentials from:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD  (preferred)
 *   or E2E_DEMO_EMAIL / E2E_DEMO_PASSWORD
 *   or defaults: demo@srpailabs.com / Demo@1234
 */
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import pg from 'pg'
import path from 'path'

config({ path: path.resolve(__dirname, '..', '.env.local') })
config({ path: path.resolve(__dirname, '..', '.env.e2e.local'), override: true })

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }

  const email = (
    process.env.E2E_USER_EMAIL ||
    process.env.E2E_DEMO_EMAIL ||
    'demo@srpailabs.com'
  )
    .trim()
    .toLowerCase()
  const password =
    process.env.E2E_USER_PASSWORD ||
    process.env.E2E_DEMO_PASSWORD ||
    'Demo@1234'

  if (!email || !password) {
    console.error('E2E email/password required')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: url })
  const client = await pool.connect()
  try {
    const hash = await bcrypt.hash(password, 12)

    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM auth_users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    )

    let userId: string
    if (existing[0]) {
      userId = String(existing[0].id)
      await client.query(
        `UPDATE auth_users
         SET password_hash = $2,
             is_active = TRUE,
             failed_login_count = 0,
             locked_until = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, hash],
      )
      console.log('updated existing e2e user')
    } else {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO auth_users (email, name, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'admin', TRUE)
         RETURNING id`,
        [email, 'E2E Demo', hash],
      )
      userId = String(ins.rows[0].id)
      console.log('created e2e user')
    }

    const { rows: tenants } = await client.query<{ id: string }>(
      `SELECT id FROM tenants ORDER BY created_at NULLS LAST LIMIT 1`,
    )
    if (!tenants[0]) {
      console.warn('no tenants — login may provision later; password is set')
      return
    }
    const tenantId = String(tenants[0].id)
    await client.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted)
       VALUES ($1, $2, 'owner', TRUE)
       ON CONFLICT (tenant_id, user_id) DO UPDATE
       SET invite_accepted = TRUE`,
      [tenantId, userId],
    )
    console.log('e2e user ready (password reset + tenant membership)')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
