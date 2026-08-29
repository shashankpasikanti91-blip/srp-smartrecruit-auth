/**
 * Provision a lifelong Enterprise owner account with a temporary password.
 *
 * Usage (from nextjs-auth):
 *   set PROVISION_EMAIL=user@example.com
 *   set PROVISION_TEMP_PASSWORD=TempPass@Change1
 *   set PROVISION_NAME=Client Name
 *   npx tsx scripts/provision-lifelong-user.ts
 *
 * Effects:
 *   - auth_users: active credentials user, role=owner, full product_access
 *   - tenants: enterprise plan, high seat/job caps, no expiry
 *   - tenant_members: owner + invite_accepted
 *   - subscriptions: enterprise / active / lifelong (far future end or null)
 *
 * Client must change the temporary password after first login.
 */
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import pg from 'pg'
import path from 'path'
import crypto from 'crypto'

config({ path: path.resolve(__dirname, '..', '.env.local') })

function slugify(email: string): string {
  const local = email.split('@')[0].replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${local || 'workspace'}-${crypto.randomBytes(2).toString('hex')}`
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }

  const email = (process.env.PROVISION_EMAIL || '').trim().toLowerCase()
  const password = process.env.PROVISION_TEMP_PASSWORD || ''
  const name = (process.env.PROVISION_NAME || email.split('@')[0] || 'Owner').trim()

  if (!email.includes('@')) {
    console.error('PROVISION_EMAIL required')
    process.exit(1)
  }
  if (password.length < 10) {
    console.error('PROVISION_TEMP_PASSWORD required (min 10 chars)')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: url })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
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
             name = COALESCE(NULLIF($3, ''), name),
             role = 'owner',
             provider = 'credentials',
             is_active = TRUE,
             product_access = ARRAY['recruit','ess','analytics','governance','ai'],
             failed_login_count = 0,
             locked_until = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, hash, name],
      )
    } else {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO auth_users
           (email, name, password_hash, role, provider, is_active, product_access)
         VALUES ($1,$2,$3,'owner','credentials',TRUE,ARRAY['recruit','ess','analytics','governance','ai'])
         RETURNING id`,
        [email, name, hash],
      )
      userId = String(ins.rows[0].id)
    }

    // Prefer existing membership tenant; else create enterprise workspace
    const { rows: mem } = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenant_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId],
    )

    let tenantId: string
    if (mem[0]) {
      tenantId = String(mem[0].tenant_id)
      await client.query(
        `UPDATE tenants
         SET plan = 'enterprise',
             max_users = GREATEST(COALESCE(max_users, 0), 999),
             updated_at = NOW()
         WHERE id = $1`,
        [tenantId],
      ).catch(async () => {
        await client.query(
          `UPDATE tenants SET plan = 'enterprise' WHERE id = $1`,
          [tenantId],
        )
      })
    } else {
      const slug = slugify(email)
      const t = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug, plan, max_users)
         VALUES ($1, $2, 'enterprise', 999)
         RETURNING id`,
        [`${name} Workspace`, slug],
      )
      tenantId = String(t.rows[0].id)
    }

    await client.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
       VALUES ($1, $2, 'owner', TRUE, '{}'::jsonb)
       ON CONFLICT (tenant_id, user_id) DO UPDATE
         SET role = 'owner',
             invite_accepted = TRUE,
             updated_at = NOW()`,
      [tenantId, userId],
    )

    // Lifelong subscription — far-future period end; status active; enterprise plan.
    // No unique(user_id) on subscriptions in base schema — upsert manually.
    const { rows: sub } = await client.query<{ id: string }>(
      `SELECT id FROM subscriptions WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId],
    )
    if (sub[0]) {
      await client.query(
        `UPDATE subscriptions
         SET plan = 'enterprise',
             status = 'active',
             billing_cycle = 'lifetime',
             amount_cents = 0,
             current_period_end = '2099-12-31'::timestamptz,
             updated_at = NOW()
         WHERE id = $1`,
        [sub[0].id],
      )
    } else {
      await client.query(
        `INSERT INTO subscriptions
           (user_id, plan, status, billing_cycle, amount_cents, currency, current_period_end)
         VALUES ($1, 'enterprise', 'active', 'lifetime', 0, 'usd', '2099-12-31'::timestamptz)`,
        [userId],
      )
    }

    await client.query('COMMIT')
    console.log(JSON.stringify({
      ok: true,
      email,
      user_id: userId,
      tenant_id: tenantId,
      role: 'owner',
      plan: 'enterprise',
      access: 'lifelong',
      note: 'Temporary password set — client must change after first login',
    }, null, 2))
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
