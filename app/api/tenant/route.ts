/**
 * GET  /api/tenant           — current tenant info + member list
 * POST /api/tenant           — register / create a new tenant
 * PATCH /api/tenant          — update tenant settings (name, logo, etc.)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, getTenantById, getTenantMembers, TenantPermissions } from '@/lib/tenant'
import { pool } from '@/lib/db'

// ── GET: current tenant + member list ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const tenant = await getTenantById(ctx.tenantId)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const members = await getTenantMembers(ctx.tenantId)

  // Usage stats
  const { rows: usage } = await pool.query<{ jobs: string; candidates: string; screens: string }>(
    `SELECT
       (SELECT COUNT(*) FROM job_posts  WHERE tenant_id = $1 AND status != 'archived') AS jobs,
       (SELECT COUNT(*) FROM resumes    WHERE tenant_id = $1) AS candidates,
       (SELECT COUNT(*) FROM token_usage WHERE tenant_id = $1
          AND operation LIKE '%screen%'
          AND created_at >= date_trunc('month', NOW())) AS screens`,
    [ctx.tenantId]
  )

  return NextResponse.json({
    tenant: {
      ...tenant,
      usage: {
        jobs:       parseInt(usage[0]?.jobs ?? '0'),
        candidates: parseInt(usage[0]?.candidates ?? '0'),
        screens_this_month: parseInt(usage[0]?.screens ?? '0'),
      },
    },
    members,
    myRole: ctx.tenantRole,
    myPermissions: ctx.permissions,
  })
}

// ── POST: create a new tenant (for users switching to multi-org) ──────────────
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'billing.update')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json() as {
    name: string; slug?: string; industry?: string; size?: string; website?: string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
  }

  const rawSlug = (body.slug ?? body.name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)

  // Ensure unique slug
  let slug = rawSlug
  let attempt = 0
  while (attempt < 10) {
    const { rows } = await pool.query<{ id: string }>('SELECT id FROM tenants WHERE slug = $1', [slug])
    if (rows.length === 0) break
    slug = `${rawSlug}-${Math.floor(1000 + Math.random() * 9000)}`
    attempt++
  }

  const { rows } = await pool.query<{ id: string; short_id: string }>(
    `INSERT INTO tenants (name, slug, industry, size, website, plan, plan_status)
     VALUES ($1, $2, $3, $4, $5, 'free', 'active')
     RETURNING id, short_id`,
    [body.name.trim(), slug, body.industry ?? null, body.size ?? 'small', body.website ?? null]
  )
  const newTenantId = rows[0].id
  const newShortId  = rows[0].short_id

  // Add the creator as owner
  await pool.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
     VALUES ($1, $2, 'owner', TRUE, $3)`,
    [newTenantId, ctx.userId, JSON.stringify({
      jobs:           { create: true, read: true, update: true, delete: true },
      candidates:     { create: true, read: true, update: true, delete: true },
      pipeline:       { read: true, update: true },
      ai_screen:      { use: true },
      ai_compose:     { use: true },
      jd_intel:       { use: true },
      boolean_search: { use: true },
      integrations:   { read: true, update: true },
      billing:        { read: true, update: true },
      users:          { invite: true, manage: true },
    })]
  )

  return NextResponse.json({ ok: true, tenantId: newTenantId, shortId: newShortId, slug })
}

// ── PATCH: update tenant settings ────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'billing.update')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json() as {
    name?: string; logo_url?: string; website?: string; industry?: string
    size?: string; settings?: Record<string, unknown>
  }

  const updates: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (body.name?.trim()) {
    updates.push(`name = $${idx++}`)
    params.push(body.name.trim().slice(0, 100))
  }
  if (body.logo_url !== undefined) {
    updates.push(`logo_url = $${idx++}`)
    params.push(body.logo_url || null)
  }
  if (body.website !== undefined) {
    updates.push(`website = $${idx++}`)
    params.push(body.website || null)
  }
  if (body.industry !== undefined) {
    updates.push(`industry = $${idx++}`)
    params.push(body.industry || null)
  }
  if (body.size) {
    updates.push(`size = $${idx++}`)
    params.push(body.size)
  }
  if (body.settings) {
    updates.push(`settings = settings || $${idx++}`)
    params.push(JSON.stringify(body.settings))
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  updates.push(`updated_at = NOW()`)
  params.push(ctx.tenantId)
  await pool.query(
    `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx}`,
    params
  )

  return NextResponse.json({ ok: true })
}
