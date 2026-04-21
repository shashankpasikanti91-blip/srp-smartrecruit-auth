import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as Record<string, unknown>
  const role = user.role as string | undefined
  const userId = user.userId as string

  // Audit logs: admins see all, others see own
  const isAdmin = role === 'admin' || role === 'owner'

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'))
  const action = url.searchParams.get('action') ?? ''
  const resource = url.searchParams.get('resource') ?? ''
  const offset = (page - 1) * limit

  try {
    const conditions: string[] = []
    const params: (string | number)[] = []
    let idx = 1

    if (!isAdmin) {
      conditions.push(`user_id = $${idx++}`)
      params.push(userId)
    }
    if (action) {
      conditions.push(`action ILIKE $${idx++}`)
      params.push(`%${action}%`)
    }
    if (resource) {
      conditions.push(`resource_type ILIKE $${idx++}`)
      params.push(`%${resource}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT id, user_id, user_email, action, resource_type, resource_id,
              details, ip_address, user_agent, result, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0].count as string)

    return NextResponse.json({
      logs: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Internal write endpoint for audit events from frontend actions
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as Record<string, unknown>
  const userId = user.userId as string

  try {
    const body = await req.json() as {
      action: string
      resource_type: string
      resource_id?: string
      details?: Record<string, unknown>
      result?: string
    }

    const { action, resource_type, resource_id, details, result } = body
    if (!action || !resource_type) {
      return NextResponse.json({ error: 'action and resource_type required' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    const ua = req.headers.get('user-agent') ?? null

    await pool.query(
      `INSERT INTO audit_logs
         (user_id, user_email, action, resource_type, resource_id, details, ip_address, user_agent, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9)`,
      [
        userId, session.user.email, action, resource_type,
        resource_id ?? null, JSON.stringify(details ?? {}),
        ip, ua, result ?? 'success',
      ]
    )
    return NextResponse.json({ status: 'logged' })
  } catch (err: unknown) {
    // Audit log failures must never break the caller
    console.warn('[audit] write failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ status: 'skipped' })
  }
}
