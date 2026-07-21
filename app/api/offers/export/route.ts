import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'
import { csvDownload, resolveDateFilter, resolveMineScope, xlsxDownload, deriveDocsStatus } from '@/lib/opsList'
import { DOCUMENT_SLOTS } from '@/lib/documentStorage'

const HR_SLOTS = [...DOCUMENT_SLOTS]

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const status = sanitizeText(searchParams.get('status'), 50) ?? ''
  const docsStatus = sanitizeText(searchParams.get('docs_status'), 40) ?? ''
  const q = sanitizeText(searchParams.get('q'), 200) ?? ''
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  const dateRange = resolveDateFilter(searchParams)
  const { mine } = resolveMineScope(ctx, searchParams.get('mine'))

  const params: unknown[] = [ctx.tenantId]
  let sql = `
    SELECT o.short_id, o.status, o.offer_salary, o.expected_joining, o.remarks, o.updated_at,
           r.candidate_name, r.short_id AS candidate_short_id, r.candidate_email, r.candidate_phone,
           r.candidate_profile->>'years_experience' AS years_experience,
           r.candidate_profile->>'current_salary' AS current_salary,
           r.candidate_profile->>'expected_salary' AS expected_salary,
           s.client_name AS submission_client, s.applying_for AS submission_position,
           jp.title AS job_title, COALESCE(jp.company, cl.name) AS job_client_name,
           u.name AS recruiter_name,
           o.resume_id, o.hr_checklist
    FROM offer_cases o
    JOIN resumes r ON r.id = o.resume_id
    LEFT JOIN submissions s ON s.id = o.submission_id
    LEFT JOIN job_posts jp ON jp.id = s.job_post_id
    LEFT JOIN clients cl ON cl.id = jp.client_id
    LEFT JOIN auth_users u ON u.id = o.user_id
    WHERE o.tenant_id = $1
  `
  let p = 2
  if (status) {
    sql += ` AND o.status = $${p}`
    params.push(status)
    p++
  }
  if (q) {
    sql += ` AND (
      r.candidate_name ILIKE $${p} OR r.candidate_email ILIKE $${p}
      OR r.short_id ILIKE $${p} OR COALESCE(o.short_id,'') ILIKE $${p}
      OR COALESCE(r.candidate_phone,'') ILIKE $${p}
    )`
    params.push(`%${q}%`)
    p++
  }
  if (mine) {
    sql += ` AND o.user_id = $${p}`
    params.push(ctx.userId)
    p++
  }
  if (dateRange) {
    sql += ` AND o.updated_at::date >= $${p}::date`
    params.push(dateRange.from)
    p++
    sql += ` AND o.updated_at::date <= $${p}::date`
    params.push(dateRange.to)
    p++
  }
  sql += ' ORDER BY o.updated_at DESC LIMIT 5000'

  const { rows } = await pool.query(sql, params)

  let mapped = rows.map(o => {
    const checklist = (o.hr_checklist ?? {}) as Record<string, boolean>
    const filled = HR_SLOTS.filter(s => checklist[s]).length
    const m = String(o.remarks ?? '').match(/docs_status:(\w+)/)
    const docs_status = deriveDocsStatus(o.status as string, filled, HR_SLOTS.length, m?.[1] ?? null)
    return { ...o, docs_status, slots_filled: filled }
  })
  if (docsStatus) mapped = mapped.filter(o => o.docs_status === docsStatus)

  const headers = [
    'Offer ID', 'Cand. ID', 'Name', 'Phone', 'Email', 'Client', 'Position', 'Recruiter', 'Exp',
    'Current sal', 'Expected sal', 'Offer salary', 'DOJ', 'Offer stage', 'Docs status', 'Slots filled',
  ]
  const data = mapped.map(o => [
    o.short_id,
    o.candidate_short_id,
    o.candidate_name,
    o.candidate_phone,
    o.candidate_email,
    o.job_client_name || o.submission_client,
    o.submission_position || o.job_title,
    o.recruiter_name,
    o.years_experience,
    o.current_salary,
    o.expected_salary,
    o.offer_salary,
    o.expected_joining ? new Date(o.expected_joining as string).toISOString().slice(0, 10) : '',
    o.status,
    o.docs_status,
    o.slots_filled,
  ])

  if (format === 'xlsx' || format === 'excel') {
    return xlsxDownload('offers-export.xlsx', 'Offers', headers, data)
  }
  return csvDownload('offers-export.csv', headers, data)
}
