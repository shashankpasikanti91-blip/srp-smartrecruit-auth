import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'
import {
  csvDownload,
  resolveDateFilter,
  resolveMineScope,
  stagesForFeedbackBucket,
  xlsxDownload,
} from '@/lib/opsList'
import { formatPhoneInternational } from '@/lib/phoneFormat'
import { cleanCandidateName } from '@/lib/nameClean'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const stage = sanitizeText(searchParams.get('stage'), 50) ?? ''
  const feedbackBucket = sanitizeText(searchParams.get('feedback'), 40) ?? ''
  const client = sanitizeText(searchParams.get('client'), 200) ?? ''
  const q = sanitizeText(searchParams.get('q'), 200) ?? ''
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  const dateRange = resolveDateFilter(searchParams)
  const { mine } = resolveMineScope(ctx, searchParams.get('mine'))

  const conditions = ['s.tenant_id = $1']
  const params: unknown[] = [ctx.tenantId]
  let idx = 2

  if (stage) {
    conditions.push(`s.stage = $${idx}`)
    params.push(stage)
    idx++
  } else {
    const stages = stagesForFeedbackBucket(feedbackBucket)
    if (stages?.length) {
      conditions.push(`s.stage = ANY($${idx}::text[])`)
      params.push(stages)
      idx++
    }
  }
  if (client) {
    conditions.push(`s.client_name ILIKE $${idx}`)
    params.push(`%${client}%`)
    idx++
  }
  if (q) {
    conditions.push(`(
      r.candidate_name ILIKE $${idx} OR r.candidate_email ILIKE $${idx}
      OR r.short_id ILIKE $${idx} OR s.short_id ILIKE $${idx}
      OR s.client_name ILIKE $${idx} OR COALESCE(s.applying_for,'') ILIKE $${idx}
    )`)
    params.push(`%${q}%`)
    idx++
  }
  if (mine) {
    conditions.push(`s.user_id = $${idx}`)
    params.push(ctx.userId)
    idx++
  }
  if (dateRange) {
    conditions.push(`COALESCE(s.submission_date, s.updated_at)::date >= $${idx}::date`)
    params.push(dateRange.from)
    idx++
    conditions.push(`COALESCE(s.submission_date, s.updated_at)::date <= $${idx}::date`)
    params.push(dateRange.to)
    idx++
  }

  const where = conditions.join(' AND ')
  const { rows } = await pool.query(
    `SELECT s.short_id, s.client_name, s.applying_for, s.stage, s.hire_type, s.submission_date, s.updated_at,
            r.candidate_name, r.candidate_email, r.candidate_phone, r.short_id AS candidate_id,
            jp.title AS job_title, u.name AS recruiter_name
     FROM submissions s
     JOIN resumes r ON r.id = s.resume_id
     LEFT JOIN job_posts jp ON jp.id = s.job_post_id
     LEFT JOIN auth_users u ON u.id = s.user_id
     WHERE ${where}
     ORDER BY s.updated_at DESC
     LIMIT 5000`,
    params,
  )

  const headers = [
    'Submission ID', 'Cand. ID', 'Candidate', 'Phone', 'Email', 'Client', 'Position',
    'Stage', 'Hire Type', 'Job', 'Recruiter', 'Submitted', 'Feedback date',
  ]
  const data = rows.map(r => [
    r.short_id,
    r.candidate_id,
    cleanCandidateName(r.candidate_name as string) || r.candidate_name,
    formatPhoneInternational(r.candidate_phone as string) || r.candidate_phone || '',
    r.candidate_email,
    r.client_name,
    r.applying_for,
    r.stage,
    r.hire_type,
    r.job_title,
    r.recruiter_name,
    r.submission_date ? new Date(r.submission_date as string).toISOString().slice(0, 10) : '',
    r.updated_at ? new Date(r.updated_at as string).toISOString().slice(0, 10) : '',
  ])

  if (format === 'xlsx' || format === 'excel') {
    return xlsxDownload('submissions-export.xlsx', 'Submissions', headers, data)
  }
  return csvDownload('submissions-export.csv', headers, data)
}
