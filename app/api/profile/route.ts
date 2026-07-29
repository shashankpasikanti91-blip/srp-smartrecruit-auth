import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { computeRetentionInfo, isEnvProtectedTenant } from '@/lib/dataRetention'
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
    let ai_history: unknown[] = []
    try {
      const usageRes = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE operation LIKE '%screen%') AS screens_this_month,
           COUNT(*) FILTER (WHERE operation LIKE '%compose%') AS composes_this_month,
           COUNT(*) AS total_requests,
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total_tokens,
           COALESCE(SUM(cost_usd), 0) AS estimated_cost_usd
         FROM token_usage
         WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
        [user.id]
      )
      if (usageRes.rows[0]) usage = usageRes.rows[0]
      const hist = await pool.query(
        `SELECT id, operation, model, prompt_tokens, completion_tokens, cost_usd, metadata, created_at
         FROM token_usage WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 40`,
        [user.id]
      )
      ai_history = hist.rows
    } catch { /* token_usage may not exist */ }

    // Get candidate & job counts scoped to current tenant (non-fatal)
    let counts: Record<string, unknown> = { total_candidates: 0, active_jobs: 0 }
    try {
      const tenantCtx = await resolveTenant()
      if (tenantCtx?.tenantId) {
        const countsRes = await pool.query(
          `SELECT
             (SELECT COUNT(*) FROM resumes WHERE tenant_id = $1) AS total_candidates,
             (SELECT COUNT(*) FROM job_posts WHERE tenant_id = $1 AND status != 'archived') AS active_jobs`,
          [tenantCtx.tenantId]
        )
        if (countsRes.rows[0]) counts = countsRes.rows[0]
      } else {
        // Fallback: scope by user_id for legacy rows
        const countsRes = await pool.query(
          `SELECT
             (SELECT COUNT(*) FROM resumes WHERE user_id = $1) AS total_candidates,
             (SELECT COUNT(*) FROM job_posts WHERE user_id = $1 AND status != 'archived') AS active_jobs`,
          [user.id]
        )
        if (countsRes.rows[0]) counts = countsRes.rows[0]
      }
    } catch { /* counts fallback */ }

    // Data-retention summary (non-fatal; DB column may not exist on older installs)
    let retention: Record<string, unknown> = {
      phase: 'none',
      period_end: null,
      purge_eligible_after: null,
      days_until_purge_eligible: null,
      banner: null,
    }
    try {
      const tenantCtx = await resolveTenant()
      let tenantRetentionExempt = false
      if (tenantCtx?.tenantId) {
        tenantRetentionExempt = isEnvProtectedTenant(tenantCtx.tenantId)
        if (!tenantRetentionExempt) {
          try {
            const ex = await pool.query<{ retention_exempt: boolean }>(
              'SELECT retention_exempt FROM tenants WHERE id = $1 LIMIT 1',
              [tenantCtx.tenantId]
            )
            tenantRetentionExempt = Boolean(ex.rows[0]?.retention_exempt)
          } catch {
            /* column retention_exempt may be missing until migrate_v13 applied */
          }
        }
      }
      const r = computeRetentionInfo({
        plan: String(subscription.plan ?? 'free'),
        status: String(subscription.status ?? 'active'),
        billing_cycle: subscription.billing_cycle as string | null,
        current_period_end: subscription.current_period_end as string | null,
        tenantRetentionExempt,
      })
      retention = {
        phase: r.phase,
        period_end: r.periodEnd,
        purge_eligible_after: r.purgeEligibleAfter,
        days_until_purge_eligible: r.daysUntilPurgeEligible,
        banner: r.banner,
      }
    } catch {
      /* retention optional */
    }

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
        retention,
      },
      usage: {
        screens_this_month: parseInt(String(usage.screens_this_month ?? '0')),
        composes_this_month: parseInt(String(usage.composes_this_month ?? '0')),
        total_requests: parseInt(String(usage.total_requests ?? '0')),
        total_tokens: parseInt(String(usage.total_tokens ?? '0')),
        estimated_cost_usd: Number(usage.estimated_cost_usd ?? 0),
        total_candidates: parseInt(String(counts.total_candidates ?? '0')),
        active_jobs: parseInt(String(counts.active_jobs ?? '0')),
      },
      ai_history,
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

    // Integration CRUD has been moved to /api/integrations — reject legacy calls
    if (['save_integration', 'get_integrations', 'delete_integration', 'toggle_integration'].includes(action)) {
      return NextResponse.json(
        { error: 'Use /api/integrations for integration management' },
        { status: 410 }
      )
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Profile POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
