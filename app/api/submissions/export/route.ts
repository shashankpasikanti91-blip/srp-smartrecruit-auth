import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx

  const stage = sanitizeText(new URL(req.url).searchParams.get('stage'), 50) ?? ''
  const params: unknown[] = [ctx.tenantId]
  let sql = `
    SELECT s.short_id, s.client_name, s.applying_for, s.stage, s.hire_type, s.submission_date,
           r.candidate_name, r.candidate_email, r.short_id AS candidate_id,
           jp.title AS job_title, u.name AS recruiter_name, s.updated_at
    FROM submissions s
    JOIN resumes r ON r.id = s.resume_id
    LEFT JOIN job_posts jp ON jp.id = s.job_post_id
    LEFT JOIN auth_users u ON u.id = s.user_id
    WHERE s.tenant_id = $1
  `
  if (stage) {
    sql += ' AND s.stage = $2'
    params.push(stage)
  }
  sql += ' ORDER BY s.updated_at DESC LIMIT 2000'

  const { rows } = await pool.query(sql, params)
  const headers = ['Submission ID','Candidate','Email','Client','Applying For','Stage','Hire Type','Job','Recruiter','Date']
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push([
      r.short_id, r.candidate_name, r.candidate_email, r.client_name, r.applying_for,
      r.stage, r.hire_type, r.job_title, r.recruiter_name,
      r.submission_date ? new Date(r.submission_date as string).toISOString().slice(0, 10) : '',
    ].map(escape).join(','))
  }
  return new NextResponse('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="submissions-export.csv"',
    },
  })
}
