import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText, isValidUUID } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { logDataAccess, logUserActivity } from '@/lib/activityLog'
import { cleanCandidateName } from '@/lib/nameClean'
import { formatPhoneInternational, sanitizeCandidateEmail } from '@/lib/phoneFormat'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

/**
 * GET /api/candidates/export
 * Tenant-scoped tracker download (CSV Excel-compatible).
 * Same filters as GET /api/candidates — never crosses tenants.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const { searchParams } = new URL(req.url)
    const q         = sanitizeText(searchParams.get('q'), 200) ?? ''
    const stage     = sanitizeText(searchParams.get('stage'), 50) ?? ''
    const match     = sanitizeText(searchParams.get('match'), 50) ?? ''
    const jobId     = searchParams.get('job_id') ?? ''
    const skill     = sanitizeText(searchParams.get('skill'), 100) ?? ''
    const dateRange = sanitizeText(searchParams.get('date_range'), 20) ?? ''
    const idsParam  = searchParams.get('ids') ?? ''
    const limit     = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') ?? '2000', 10) || 2000))

    const idList = idsParam.split(',').map(s => s.trim()).filter(isValidUUID)

    if (jobId && !isValidUUID(jobId)) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 })
    }

    const conditions: string[] = ['r.tenant_id = $1']
    const params: unknown[] = [ctx.tenantId]
    let idx = 2

    if (idList.length) {
      conditions.push(`r.id = ANY($${idx}::uuid[])`)
      params.push(idList)
      idx++
    }

    if (q) {
      conditions.push(`(
        r.candidate_name ILIKE $${idx} OR r.candidate_email ILIKE $${idx}
        OR r.candidate_phone ILIKE $${idx} OR r.short_id ILIKE $${idx}
        OR COALESCE(r.candidate_profile->>'nric','') ILIKE $${idx}
      )`)
      params.push(`%${q}%`); idx++
    }
    if (stage) { conditions.push(`r.pipeline_stage = $${idx}`); params.push(stage); idx++ }
    if (match) { conditions.push(`r.match_category = $${idx}`); params.push(match); idx++ }
    if (jobId) { conditions.push(`r.job_post_id = $${idx}`); params.push(jobId); idx++ }
    if (skill) {
      conditions.push(`EXISTS (SELECT 1 FROM unnest(r.ai_skills) s(sk) WHERE s.sk ILIKE $${idx})`)
      params.push(`%${skill}%`); idx++
    }
    if (dateRange) {
      const now = new Date()
      if (dateRange === 'today' || dateRange === 'day') {
        conditions.push(`r.created_at::date = $${idx}::date`)
        params.push(now.toISOString().split('T')[0]); idx++
      } else if (dateRange === 'week' || dateRange === '7days') {
        const d = new Date(now); d.setDate(d.getDate() - 7)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      } else if (dateRange === 'month' || dateRange === '30days') {
        const d = new Date(now); d.setDate(d.getDate() - 30)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      } else if (dateRange === 'year' || dateRange === '365days') {
        const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
        conditions.push(`r.created_at >= $${idx}`); params.push(d.toISOString()); idx++
      }
    }

    const where = conditions.join(' AND ')
    const sql = `
      SELECT r.short_id, r.candidate_name, r.candidate_email, r.candidate_phone,
             r.ai_score, r.match_category, r.pipeline_stage, r.status,
             r.source_type, r.file_name, r.created_at, r.updated_at,
             r.candidate_profile,
             u.name AS owner_name, u.email AS owner_email,
             jp.short_id AS job_short_id, jp.title AS job_title, jp.company AS job_company,
             array_to_string(r.ai_skills, '; ') AS skills
      FROM resumes r
      LEFT JOIN auth_users u ON u.id = r.user_id
      LEFT JOIN job_posts jp ON jp.id = r.job_post_id
      WHERE ${where}
      ORDER BY r.created_at DESC
      LIMIT $${idx}
    `
    params.push(limit)
    const { rows } = await pool.query(sql, params)

    const headers = [
      'ID', 'Name', 'Phone', 'Email', 'NRIC', 'Nationality', 'Client', 'Hire Type',
      'Applying For', 'Experience', 'Current Role', 'Location', 'Visa Type',
      'AI Score', 'Match', 'Stage', 'Lifecycle', 'Status',
      'Job ID', 'Job Title', 'Company', 'Owner Name', 'Owner Email',
      'Skills', 'Source', 'File', 'Created', 'Updated',
    ]

    const escape = (v: unknown, forceText = false) => {
      let s = v == null ? '' : String(v)
      if (forceText && s) s = `\t${s}`
      if (/[",\n\r\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const profileOf = (r: Record<string, unknown>) => {
      const p = r.candidate_profile
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
      if (typeof p === 'string') {
        try { return JSON.parse(p) as Record<string, unknown> } catch { return {} }
      }
      return {}
    }

    const lines = [headers.join(',')]
    for (const raw of rows) {
      const r = raw as Record<string, unknown>
      const p = profileOf(r)
      const phone =
        formatPhoneInternational(r.candidate_phone as string) || (r.candidate_phone as string) || ''
      lines.push([
        escape(r.short_id),
        escape(cleanCandidateName(r.candidate_name as string) || r.candidate_name),
        escape(phone, true),
        escape(sanitizeCandidateEmail(r.candidate_email as string) || r.candidate_email || ''),
        escape(p.nric ?? p.id_document_reference ?? ''),
        escape(p.nationality ?? ''),
        escape(p.client_name ?? r.job_company ?? ''),
        escape(p.hire_type ?? ''),
        escape(p.applying_for ?? ''),
        escape(p.total_experience ?? ''),
        escape(p.current_role ?? p.current_title ?? ''),
        escape(p.current_location ?? ''),
        escape(p.visa_type ?? ''),
        escape(r.ai_score),
        escape(r.match_category),
        escape(r.pipeline_stage),
        escape(p.lifecycle_status ?? ''),
        escape(r.status),
        escape(r.job_short_id),
        escape(r.job_title),
        escape(r.job_company),
        escape(r.owner_name),
        escape(r.owner_email),
        escape(r.skills),
        escape(r.source_type),
        escape(r.file_name),
        escape(r.created_at ? new Date(r.created_at as string).toISOString() : ''),
        escape(r.updated_at ? new Date(r.updated_at as string).toISOString() : ''),
      ].join(','))
    }

    // UTF-8 BOM so Excel opens UTF-8 correctly
    const bom = '\uFEFF'
    const csv = bom + lines.join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `smartrecruit-tracker-${stamp}.csv`

    await Promise.allSettled([
      logUserActivity({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'candidates.export',
        resourceType: 'candidate_export',
        details: { count: rows.length, filters: { q: !!q, stage, match, jobId: !!jobId, skill, dateRange } },
        ipAddress: getIpAddress(req) ?? undefined,
      }),
      logDataAccess({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userRole: ctx.tenantRole,
        accessType: 'candidate_export',
        resourceType: 'candidate_export',
        ipAddress: getIpAddress(req) ?? undefined,
      }),
      logAudit({
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action: 'candidates.export',
        resourceType: 'candidate_export',
        tenantId: ctx.tenantId,
        details: { count: rows.length, filters: { stage, match, skill, dateRange, selected_ids: idList.length } },
      }),
    ])

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[api/candidates/export] error:', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
