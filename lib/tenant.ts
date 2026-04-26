/**
 * lib/tenant.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-tenant helpers.
 *
 * Everywhere a Next.js API route or server action needs to:
 *   1. Authenticate the caller
 *   2. Identify which tenant they belong to
 *   3. Confirm a required permission
 *
 * …it should call: `requireTenant(req, 'jobs.create')`
 * That returns { session, tenantId, tenantRole, permissions } or throws HTTP errors.
 *
 * All DB queries must include `AND tenant_id = $N` to enforce tenant isolation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getServerSession, Session } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from './auth'
import { pool } from './db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenantContext {
  session: Session
  userId: string
  userEmail: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  tenantPlan: string
  tenantRole: 'owner' | 'admin' | 'recruiter' | 'member' | 'viewer'
  permissions: TenantPermissions
}

export interface TenantPermissions {
  jobs:           { create: boolean; read: boolean; update: boolean; delete: boolean }
  candidates:     { create: boolean; read: boolean; update: boolean; delete: boolean }
  pipeline:       { read: boolean; update: boolean }
  ai_screen:      { use: boolean }
  ai_compose:     { use: boolean }
  jd_intel:       { use: boolean }
  boolean_search: { use: boolean }
  integrations:   { read: boolean; update: boolean }
  billing:        { read: boolean; update: boolean }
  users:          { invite: boolean; manage: boolean }
}

export interface TenantRow {
  id: string
  short_id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
  plan_status: string
  max_users: number
  max_jobs: number
  max_candidates: number
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
}

// ── Core: resolve tenant from session ────────────────────────────────────────

/**
 * Resolve the active tenant for the authenticated user.
 * If the user belongs to multiple tenants, the `X-Tenant-ID` header
 * or `tenantId` query param selects which one; otherwise the first/default is used.
 *
 * Returns null if the user is not authenticated or has no tenant.
 */
export async function resolveTenant(req?: NextRequest): Promise<TenantContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = session.user as Record<string, unknown>
  const userId = user.userId as string | undefined
  if (!userId) return null

  // Prefer explicit tenant header > query param > default (first membership)
  let requestedTenantId: string | null = null
  if (req) {
    requestedTenantId =
      req.headers.get('x-tenant-id') ??
      new URL(req.url).searchParams.get('tenantId') ??
      null
  }

  const { rows } = await pool.query<{
    tenant_id: string; slug: string; name: string; plan: string; plan_status: string
    role: string; permissions: TenantPermissions; is_active: boolean
    short_id: string
  }>(
    `SELECT
       t.id          AS tenant_id,
       t.short_id,
       t.slug,
       t.name,
       t.plan,
       t.plan_status,
       t.is_active,
       tm.role,
       tm.permissions
     FROM tenant_members tm
     JOIN tenants t ON t.id = tm.tenant_id
     WHERE tm.user_id = $1
       AND tm.invite_accepted = TRUE
       AND t.is_active = TRUE
     ORDER BY
       CASE WHEN t.id = $2 THEN 0 ELSE 1 END,
       tm.created_at ASC
     LIMIT 1`,
    [userId, requestedTenantId ?? '00000000-0000-0000-0000-000000000000']
  )

  if (!rows[0]) return null
  const row = rows[0]

  return {
    session,
    userId,
    userEmail: session.user.email,
    tenantId: row.tenant_id,
    tenantSlug: row.slug,
    tenantName: row.name,
    tenantPlan: row.plan,
    tenantRole: row.role as TenantContext['tenantRole'],
    permissions: row.permissions ?? defaultOwnerPermissions(),
  }
}

/**
 * Require a tenant context. If not found, returns a 401/403 NextResponse.
 * Optionally check a specific permission key like 'jobs.create'.
 *
 * Usage:
 *   const ctx = await requireTenant(req, 'candidates.read')
 *   if (ctx instanceof NextResponse) return ctx
 *   // ctx.tenantId, ctx.userId etc. are safe to use
 */
export async function requireTenant(
  req: NextRequest,
  permission?: string
): Promise<TenantContext | NextResponse> {
  const ctx = await resolveTenant(req)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (permission) {
    const ok = checkPermission(ctx.permissions, permission)
    if (!ok) {
      return NextResponse.json(
        { error: `Forbidden: you lack the '${permission}' permission in this workspace` },
        { status: 403 }
      )
    }
  }
  return ctx
}

// ── Permission check ──────────────────────────────────────────────────────────

/**
 * Check if a flat dot-notation permission is satisfied.
 * Owners always pass. e.g. 'jobs.create', 'ai_screen.use', 'users.invite'
 */
export function checkPermission(perms: TenantPermissions, key: string): boolean {
  const [resource, action] = key.split('.') as [keyof TenantPermissions, string]
  if (!perms[resource]) return false
  const section = perms[resource] as Record<string, boolean>
  return section[action] === true
}

// ── Tenant CRUD helpers ───────────────────────────────────────────────────────

/** Fetch full tenant row by ID */
export async function getTenantById(tenantId: string): Promise<TenantRow | null> {
  const { rows } = await pool.query<TenantRow>(
    'SELECT * FROM tenants WHERE id = $1 AND is_active = TRUE',
    [tenantId]
  )
  return rows[0] ?? null
}

/** Auto-create a tenant for a newly registered user */
export async function provisionTenantForUser(userId: string, name: string, email: string): Promise<string> {
  const slugBase = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 40)

  let slug = slugBase
  let attempt = 0
  while (attempt < 10) {
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM tenants WHERE slug = $1', [slug]
    )
    if (rows.length === 0) break
    slug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`
    attempt++
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO tenants (name, slug, plan, plan_status)
     VALUES ($1, $2, 'free', 'active')
     RETURNING id`,
    [name || slugBase, slug]
  )
  const tenantId = rows[0].id

  await pool.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
     VALUES ($1, $2, 'owner', TRUE, $3)
     ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [tenantId, userId, JSON.stringify(defaultOwnerPermissions())]
  )

  // Back-fill tenant on existing data for this user
  await pool.query('UPDATE job_posts SET tenant_id = $1 WHERE user_id = $2 AND tenant_id IS NULL', [tenantId, userId])
  await pool.query('UPDATE resumes    SET tenant_id = $1 WHERE user_id = $2 AND tenant_id IS NULL', [tenantId, userId])

  return tenantId
}

/** List all tenants a user belongs to */
export async function getUserTenants(userId: string): Promise<Array<{
  id: string; short_id: string; name: string; slug: string; plan: string
  role: string; logo_url: string | null
}>> {
  const { rows } = await pool.query(
    `SELECT t.id, t.short_id, t.name, t.slug, t.plan, t.logo_url, tm.role
     FROM tenant_members tm
     JOIN tenants t ON t.id = tm.tenant_id
     WHERE tm.user_id = $1 AND tm.invite_accepted = TRUE AND t.is_active = TRUE
     ORDER BY tm.created_at ASC`,
    [userId]
  )
  return rows
}

/** List members of a tenant (for the team management UI) */
export async function getTenantMembers(tenantId: string): Promise<Array<{
  id: string; user_id: string; name: string | null; email: string; image: string | null
  role: string; permissions: TenantPermissions; invite_accepted: boolean
  last_active_at: string | null; created_at: string
}>> {
  const { rows } = await pool.query(
    `SELECT
       tm.id, tm.user_id, tm.role, tm.permissions, tm.invite_accepted,
       tm.last_active_at, tm.created_at,
       u.name, u.email, u.image
     FROM tenant_members tm
     JOIN auth_users u ON u.id = tm.user_id
     WHERE tm.tenant_id = $1
     ORDER BY
       CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
       tm.created_at ASC`,
    [tenantId]
  )
  return rows
}

// ── Permission presets ────────────────────────────────────────────────────────

export function defaultOwnerPermissions(): TenantPermissions {
  return {
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
  }
}

export function defaultAdminPermissions(): TenantPermissions {
  return {
    jobs:           { create: true, read: true, update: true, delete: false },
    candidates:     { create: true, read: true, update: true, delete: false },
    pipeline:       { read: true, update: true },
    ai_screen:      { use: true },
    ai_compose:     { use: true },
    jd_intel:       { use: true },
    boolean_search: { use: true },
    integrations:   { read: true, update: false },
    billing:        { read: true, update: false },
    users:          { invite: true, manage: false },
  }
}

export function defaultRecruiterPermissions(): TenantPermissions {
  return {
    jobs:           { create: true, read: true, update: true, delete: false },
    candidates:     { create: true, read: true, update: true, delete: false },
    pipeline:       { read: true, update: true },
    ai_screen:      { use: true },
    ai_compose:     { use: true },
    jd_intel:       { use: true },
    boolean_search: { use: true },
    integrations:   { read: false, update: false },
    billing:        { read: false, update: false },
    users:          { invite: false, manage: false },
  }
}

export function defaultMemberPermissions(): TenantPermissions {
  return {
    jobs:           { create: false, read: true, update: false, delete: false },
    candidates:     { create: false, read: true, update: false, delete: false },
    pipeline:       { read: true, update: false },
    ai_screen:      { use: false },
    ai_compose:     { use: false },
    jd_intel:       { use: false },
    boolean_search: { use: false },
    integrations:   { read: false, update: false },
    billing:        { read: false, update: false },
    users:          { invite: false, manage: false },
  }
}

export const ROLE_PRESET: Record<string, () => TenantPermissions> = {
  owner:     defaultOwnerPermissions,
  admin:     defaultAdminPermissions,
  recruiter: defaultRecruiterPermissions,
  member:    defaultMemberPermissions,
  viewer:    defaultMemberPermissions,
}
