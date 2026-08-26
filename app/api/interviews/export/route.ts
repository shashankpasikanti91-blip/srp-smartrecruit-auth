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
       i.short_id, i.resume_id, i.job_post_id, i.candidate_name, i.candidate_email, i.scheduled_at,
       i.duration_minutes, i.format, i.status, i.round, i.feedback, i.rating,
       r.short_id AS candidate_short_id, r.candidate_phone,
       jp.title AS job_title, COALESCE(jp.company, cl.name) AS job_client_name,
       au.name AS interviewer_name
     FROM interviews i
     LEFT JOIN resumes r ON r.id = i.resume_id
     LEFT JOIN job_posts jp ON jp.id = i.job_post_id
     LEFT JOIN clients cl ON cl.id = jp.client_id
     LEFT JOIN auth_users au ON au.id = i.interviewer_id
     WHERE ${where}
     ORDER BY i.scheduled_at ASC NULLS LAST
     LIMIT 5000`,
    params,
  )

  type Row = typeof rows[number]
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = `${r.resume_id || r.candidate_short_id || r.short_id}::${r.job_post_id || ''}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  const slotIso = (list: Row[], round: number) => {
    const hit = list.find(x => Number(x.round ?? 1) === round)
    return hit?.scheduled_at ? new Date(hit.scheduled_at as string).toISOString() : ''
  }

  const headers = [
    'Interview ID', 'Cand. ID', 'Name', 'Phone', 'Email', 'Client/Project', 'Position',
    '1st Date/Time', '2nd Date/Time', '3rd Date/Time', '4th Date/Time',
    'Status', 'Feedback', 'Rating', 'Interviewer',
  ]
  const data = Array.from(groups.values()).map(list => {
    const r = list.slice().sort((a, b) => Number(a.round ?? 1) - Number(b.round ?? 1))[0]
    return [
      list.map(x => x.short_id).join(' / '),
      r.candidate_short_id,
      cleanCandidateName(r.candidate_name as string) || r.candidate_name,
      formatPhoneInternational(r.candidate_phone as string) || r.candidate_phone || '',
      r.candidate_email,
      r.job_client_name,
      r.job_title,
      slotIso(list, 1),
      slotIso(list, 2),
      slotIso(list, 3),
      slotIso(list, 4),
      r.status,
      typeof r.feedback === 'string' ? r.feedback : (r.feedback ? JSON.stringify(r.feedback) : ''),
      r.rating,
      r.interviewer_name,
    ]
  })

  if (format === 'xlsx' || format === 'excel') {
    return xlsxDownload('interviews-export.xlsx', 'Interviews', headers, data)
  }
  return csvDownload('interviews-export.csv', headers, data)
}
