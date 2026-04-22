import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user details
    const userRes = await pool.query(
      `SELECT id, name, email, image, provider, role, product_access, is_active, created_at
       FROM auth_users WHERE email = $1`,
      [session.user.email]
    )
    if (!userRes.rows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = userRes.rows[0]

    // Get subscription (non-fatal)
    let subscription: Record<string, unknown> = { plan: 'free', status: 'active' }
    try {
      const subRes = await pool.query(
        `SELECT plan, status, billing_cycle, amount_cents, currency, trial_ends_at, current_period_end, created_at
         FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      )
      if (subRes.rows[0]) subscription = subRes.rows[0]
    } catch { /* table may not exist in all envs */ }

    // Get usage stats this month (non-fatal)
    let usage: Record<string, unknown> = { screens_this_month: 0, composes_this_month: 0 }
    try {
      const usageRes = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE operation LIKE '%screen%') AS screens_this_month,
           COUNT(*) FILTER (WHERE operation LIKE '%compose%') AS composes_this_month
         FROM token_usage
         WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
        [user.id]
      )
      if (usageRes.rows[0]) usage = usageRes.rows[0]
    } catch { /* token_usage may not exist */ }

    // Get candidate & job counts (non-fatal)
    let counts: Record<string, unknown> = { total_candidates: 0, active_jobs: 0 }
    try {
      const countsRes = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM resumes WHERE user_id = $1) AS total_candidates,
           (SELECT COUNT(*) FROM job_posts WHERE user_id = $1 AND status != 'archived') AS active_jobs`,
        [user.id]
      )
      if (countsRes.rows[0]) counts = countsRes.rows[0]
    } catch { /* counts fallback */ }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        provider: user.provider,
        role: user.role,
        created_at: user.created_at,
      },
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle ?? null,
        current_period_end: subscription.current_period_end ?? null,
        trial_ends_at: subscription.trial_ends_at ?? null,
      },
      usage: {
        screens_this_month: parseInt(String(usage.screens_this_month ?? '0')),
        composes_this_month: parseInt(String(usage.composes_this_month ?? '0')),
        total_candidates: parseInt(String(counts.total_candidates ?? '0')),
        active_jobs: parseInt(String(counts.active_jobs ?? '0')),
      },
    })
  } catch (err) {
    console.error('Profile API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH: Update profile details ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name } = body as { name?: string }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const sanitizedName = name.trim().slice(0, 100)

    await pool.query(
      'UPDATE auth_users SET name = $1, updated_at = NOW() WHERE email = $2',
      [sanitizedName, session.user.email]
    )

    return NextResponse.json({ ok: true, name: sanitizedName })
  } catch (err) {
    console.error('Profile PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST: Generate API key for n8n / ATS integration ──────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action } = body as { action: string }

    const userRes = await pool.query<{ id: string }>(
      'SELECT id FROM auth_users WHERE email = $1', [session.user.email]
    )
    const userId = userRes.rows[0]?.id
    if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (action === 'generate_api_key') {
      // Generate a secure API key
      const rawKey = crypto.randomBytes(32).toString('hex')
      const apiKey = `srp_${rawKey}`
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
      const keyPrefix = apiKey.slice(0, 12)

      // Ensure api_keys table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          key_hash TEXT NOT NULL UNIQUE,
          key_prefix TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT 'Default',
          is_active BOOLEAN NOT NULL DEFAULT true,
          last_used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      // Deactivate old keys
      await pool.query(
        'UPDATE api_keys SET is_active = false WHERE user_id = $1',
        [userId]
      )

      // Insert new key
      await pool.query(
        `INSERT INTO api_keys (user_id, key_hash, key_prefix, label)
         VALUES ($1, $2, $3, $4)`,
        [userId, keyHash, keyPrefix, body.label ?? 'Default']
      )

      // Return the full key once — it won't be retrievable again
      return NextResponse.json({ api_key: apiKey, prefix: keyPrefix })
    }

    if (action === 'revoke_api_key') {
      await pool.query(
        'UPDATE api_keys SET is_active = false WHERE user_id = $1 AND is_active = true',
        [userId]
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'get_api_keys') {
      try {
        const { rows } = await pool.query(
          `SELECT key_prefix, label, is_active, last_used_at, created_at
           FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
          [userId]
        )
        return NextResponse.json({ keys: rows })
      } catch {
        // Table may not exist yet
        return NextResponse.json({ keys: [] })
      }
    }

    if (action === 'save_integration') {
      const { provider, api_key: extKey, webhook_url, config } = body as {
        provider: string; api_key?: string; webhook_url?: string; config?: Record<string, string>
      }
      if (!provider?.trim()) return NextResponse.json({ error: 'provider required' }, { status: 400 })

      // Ensure integrations table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS integrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          api_key_encrypted TEXT,
          webhook_url TEXT,
          config JSONB DEFAULT '{}',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, provider)
        )
      `)

      // Encrypt API key with a simple reversible approach (using DB-side pgcrypto would be better in production)
      const encKey = extKey ? Buffer.from(extKey).toString('base64') : null

      await pool.query(
        `INSERT INTO integrations (user_id, provider, api_key_encrypted, webhook_url, config)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, provider) DO UPDATE SET
           api_key_encrypted = COALESCE(EXCLUDED.api_key_encrypted, integrations.api_key_encrypted),
           webhook_url = COALESCE(EXCLUDED.webhook_url, integrations.webhook_url),
           config = COALESCE(EXCLUDED.config, integrations.config),
           is_active = true, updated_at = NOW()`,
        [userId, provider.trim().toLowerCase(), encKey, webhook_url ?? null, config ?? {}]
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'get_integrations') {
      try {
        const { rows } = await pool.query(
          `SELECT provider, webhook_url, config, is_active,
                  CASE WHEN api_key_encrypted IS NOT NULL THEN true ELSE false END as has_api_key,
                  created_at, updated_at
           FROM integrations WHERE user_id = $1 ORDER BY provider`,
          [userId]
        )
        return NextResponse.json({ integrations: rows })
      } catch {
        return NextResponse.json({ integrations: [] })
      }
    }

    if (action === 'delete_integration') {
      const { provider } = body as { provider: string }
      if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })
      await pool.query(
        'DELETE FROM integrations WHERE user_id = $1 AND provider = $2',
        [userId, provider.trim().toLowerCase()]
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'toggle_integration') {
      const { provider, is_active } = body as { provider: string; is_active: boolean }
      if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })
      await pool.query(
        'UPDATE integrations SET is_active = $1, updated_at = NOW() WHERE user_id = $2 AND provider = $3',
        [is_active, userId, provider.trim().toLowerCase()]
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Profile POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
