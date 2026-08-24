import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'
import { pool } from '@/lib/db'
import { cleanCandidateName } from '@/lib/nameClean'
import {
  formatPhoneInternational,
  sanitizeCandidateEmail,
  splitGluedPhoneFromEmail,
} from '@/lib/phoneFormat'
import { requireTenant } from '@/lib/tenant'

/**
 * POST /api/admin/repair-contacts
 * Owner: all tenants. Tenant admin: own tenant only.
 * Body: { dry_run?: boolean, limit?: number, tenant_id?: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = session.user.email.toLowerCase()
  const isOwner = isPlatformOwnerEmail(email)

  let tenantId: string | null = null
  if (!isOwner) {
    const ctx = await requireTenant(req, 'candidates.update')
    if (ctx instanceof NextResponse) return ctx
    if (ctx.tenantRole !== 'admin' && ctx.tenantRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden — admin or owner only' }, { status: 403 })
    }
    tenantId = ctx.tenantId
  }

  const body = await req.json().catch(() => ({})) as {
    dry_run?: boolean
    limit?: number
    tenant_id?: string
  }
  const dryRun = body.dry_run !== false // default dry-run for safety
  const limit = Math.min(5000, Math.max(1, Number(body.limit) || 500))

  if (isOwner && body.tenant_id) tenantId = body.tenant_id

  const params: unknown[] = []
  let where = 'TRUE'
  if (tenantId) {
    params.push(tenantId)
    where = `tenant_id = $1`
  }
  params.push(limit)
  const limIdx = params.length

  const { rows } = await pool.query<{
    id: string
    tenant_id: string
    candidate_name: string | null
    candidate_email: string | null
    candidate_phone: string | null
  }>(
    `SELECT id, tenant_id, candidate_name, candidate_email, candidate_phone
     FROM resumes
     WHERE ${where}
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $${limIdx}`,
    params,
  )

  const changes: Array<{
    id: string
    before: Record<string, string | null>
    after: Record<string, string | null>
  }> = []
  let updated = 0

  for (const row of rows) {
    const glued = splitGluedPhoneFromEmail(row.candidate_email)
    const nextName = cleanCandidateName(row.candidate_name) || row.candidate_name || null
    const nextEmail = sanitizeCandidateEmail(glued.email || row.candidate_email) || null
    const nextPhone =
      formatPhoneInternational(row.candidate_phone) ||
      glued.phone ||
      (row.candidate_phone ? String(row.candidate_phone).trim() : null)

    const before = {
      name: row.candidate_name,
      email: row.candidate_email,
      phone: row.candidate_phone,
    }
    const after = {
      name: nextName,
      email: nextEmail,
      phone: nextPhone ? nextPhone.slice(0, 50) : null,
    }

    const changed =
      (before.name ?? '') !== (after.name ?? '') ||
      (before.email ?? '') !== (after.email ?? '') ||
      (before.phone ?? '') !== (after.phone ?? '')

    if (!changed) continue
    changes.push({ id: row.id, before, after })

    if (!dryRun) {
      await pool.query(
        `UPDATE resumes SET
           candidate_name = COALESCE(NULLIF($1, ''), candidate_name),
           candidate_email = $2,
           candidate_phone = $3,
           updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [after.name, after.email, after.phone, row.id, row.tenant_id],
      )
      updated++
    }
  }

  return NextResponse.json({
    dry_run: dryRun,
    scanned: rows.length,
    would_change: changes.length,
    updated: dryRun ? 0 : updated,
    sample: changes.slice(0, 25),
  })
}
