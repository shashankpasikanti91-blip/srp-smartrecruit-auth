import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'
import {
  getOwnerStats,
  getAllUsers,
  getActivityLog,
  getAllJobPosts,
  getAllResumes,
  getAllSubscriptions,
  getTokenStats,
  getAdminTenantSummaries,
  getAdminPlatformHealth,
  setAdminTenantStatus,
} from '@/lib/db'
import { pool } from '@/lib/db'
import { defaultOwnerPermissions } from '@/lib/tenant'

// Guard — only owner/admin may call these endpoints
async function requireOwner() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const email = session.user.email.toLowerCase()
  if (!isPlatformOwnerEmail(email)) {
    return null
  }
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireOwner()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'stats'

  switch (view) {
    case 'stats': {
      const stats = await getOwnerStats()
      return NextResponse.json({ stats })
    }
    case 'users': {
      const users = await getAllUsers()
      return NextResponse.json({ users })
    }
    case 'activity': {
      const log = await getActivityLog()
      return NextResponse.json({ log })
    }
    case 'jobs': {
      const jobs = await getAllJobPosts()
      return NextResponse.json({ jobs })
    }
    case 'resumes': {
      const resumes = await getAllResumes()
      return NextResponse.json({ resumes })
    }
    case 'subscriptions': {
      const subs = await getAllSubscriptions()
      return NextResponse.json({ subs })
    }
    case 'tokens': {
      const tokens = await getTokenStats()
      return NextResponse.json({ tokens })
    }
    case 'tenants': {
      const tenants = await getAdminTenantSummaries()
      return NextResponse.json({ tenants })
    }
    case 'health': {
      const health = await getAdminPlatformHealth()
      return NextResponse.json({ health })
    }
    case 'security': {
      const [recentActivity, errorActivity, loginFailures] = await Promise.all([
        getActivityLog(50),
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM activity_log
           WHERE severity IN ('error', 'critical')
             AND created_at >= NOW() - interval '7 days'`
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM login_events
           WHERE success = FALSE
             AND created_at >= NOW() - interval '7 days'`
        ).catch(() => ({ rows: [{ count: '0' }] })),
      ])
      return NextResponse.json({
        security: {
          recentActivity,
          errorEvents7d: parseInt(errorActivity.rows[0]?.count ?? '0'),
          failedLogins7d: parseInt(loginFailures.rows[0]?.count ?? '0'),
        },
      })
    }
    default:
      return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireOwner()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as
    | {
        action?: 'create_tenant' | 'update_tenant'
        tenantId?: string
        name?: string
        slug?: string
        plan?: string
        planStatus?: string
        isActive?: boolean
        maxUsers?: number
        maxJobs?: number
        maxCandidates?: number
        ownerEmail?: string
      }
    | null

  if (!body?.action) {
    return NextResponse.json({ error: 'Action is required' }, { status: 400 })
  }

  if (body.action === 'update_tenant') {
    if (!body.tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
    const ok = await setAdminTenantStatus({
      tenantId: body.tenantId,
      isActive: body.isActive,
      plan: body.plan,
      planStatus: body.planStatus,
      maxUsers: body.maxUsers,
      maxJobs: body.maxJobs,
      maxCandidates: body.maxCandidates,
    })
    return NextResponse.json({ ok })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
  }

  const rawSlug = (body.slug ?? body.name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  if (!rawSlug) {
    return NextResponse.json({ error: 'Valid slug is required' }, { status: 400 })
  }

  let slug = rawSlug
  let attempt = 0
  while (attempt < 10) {
    const existing = await pool.query<{ id: string }>('SELECT id FROM tenants WHERE slug = $1', [slug])
    if (!existing.rows.length) break
    slug = `${rawSlug}-${Math.floor(1000 + Math.random() * 9000)}`
    attempt++
  }

  const created = await pool.query<{ id: string; short_id: string }>(
    `INSERT INTO tenants (name, slug, plan, plan_status, max_users, max_jobs, max_candidates, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     RETURNING id, short_id`,
    [
      body.name.trim(),
      slug,
      body.plan ?? 'free',
      body.planStatus ?? 'active',
      body.maxUsers ?? 3,
      body.maxJobs ?? 5,
      body.maxCandidates ?? 200,
    ]
  )

  if (body.ownerEmail?.trim()) {
    const owner = await pool.query<{ id: string }>(
      'SELECT id FROM auth_users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [body.ownerEmail.trim()]
    )
    if (owner.rows[0]?.id) {
      await pool.query(
        `INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
         VALUES ($1, $2, 'owner', TRUE, $3)
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [created.rows[0].id, owner.rows[0].id, JSON.stringify(defaultOwnerPermissions())]
      )
    }
  }

  return NextResponse.json({
    ok: true,
    tenantId: created.rows[0].id,
    shortId: created.rows[0].short_id,
    slug,
  })
}
