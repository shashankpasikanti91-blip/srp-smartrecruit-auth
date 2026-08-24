import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'
import { csvDownload, resolveDateFilter, resolveMineScope, xlsxDownload } from '@/lib/opsList'
import { formatPhoneInternational } from '@/lib/phoneFormat'
import { cleanCandidateName } from '@/lib/nameClean'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const status = sanitizeText(searchParams.get('status'), 50) ?? ''
  const q = sanitizeText(searchParams.get('q'), 200) ?? ''
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  const dateRange = resolveDateFilter(searchParams)
  const { mine } = resolveMineScope(ctx, searchParams.get('mine'))

  const conditions = ['i.tenant_id = $1']
  const params: unknown[] = [ctx.tenantId]
  let p = 2

  if (status) {
    conditions.push(`i.status = $${p++}`)
    params.push(status)
  }
  if (q) {
    conditions.push(`(
      i.candidate_name ILIKE $${p} OR i.candidate_email ILIKE $${p}
      OR i.short_id ILIKE $${p} OR COALESCE(r.short_id,'') ILIKE $${p}
      OR COALESCE(r.candidate_phone,'') ILIKE $${p}
      OR COALESCE(jp.title,'') ILIKE $${p}
    )`)
    params.push(`%${q}%`)
    p++
  }
  if (mine) {
    conditions.push(`(i.interviewer_id = $${p} OR r.user_id = $${p})`)
    params.push(ctx.userId)
    p++
  }
  if (dateRange) {
    conditions.push(`i.scheduled_at::date >= $${p++}::date`)
    params.push(dateRange.from)
    conditions.push(`i.scheduled_at::date <= $${p++}::date`)
    params.push(dateRange.to)
  }

  const where = conditions.join(' AND ')
  const { rows } = await pool.query(
    `SELECT
       i.short_id, i.candidate_name, i.candidate_email, i.scheduled_at, i.duration_minutes,
       i.format, i.status, i.round, i.feedback, i.rating,
       r.short_id AS candidate_short_id, r.candidate_phone,
       jp.title AS job_title, COALESCE(jp.company, cl.name) AS job_client_name,
       au.name AS interviewer_name
     FROM interviews i
     LEFT JOIN resumes r ON r.id = i.resume_id
     LEFT JOIN job_posts jp ON jp.id = i.job_post_id
     LEFT JOIN clients cl ON cl.id = jp.client_id
     LEFT JOIN auth_users au ON au.id = i.interviewer_id
     WHERE ${where}
     ORDER BY i.scheduled_at ASC
     LIMIT 5000`,
    params,
  )

  const headers = [
    'Interview ID', 'Cand. ID', 'Name', 'Phone', 'Email', 'Client/Project', 'Position',
    '1st Date/Time', 'Status', 'Feedback', 'Rating', 'Interviewer',
  ]
  const data = rows.map(r => [
    r.short_id,
    r.candidate_short_id,
    cleanCandidateName(r.candidate_name as string) || r.candidate_name,
    formatPhoneInternational(r.candidate_phone as string) || r.candidate_phone || '',
    r.candidate_email,
    r.job_client_name,
    r.job_title,
    r.scheduled_at ? new Date(r.scheduled_at as string).toISOString() : '',
    r.status,
    typeof r.feedback === 'string' ? r.feedback : (r.feedback ? JSON.stringify(r.feedback) : ''),
    r.rating,
    r.interviewer_name,
  ])

  if (format === 'xlsx' || format === 'excel') {
    return xlsxDownload('interviews-export.xlsx', 'Interviews', headers, data)
  }
  return csvDownload('interviews-export.csv', headers, data)
}
