import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { buildJdFromJobRow } from '@/lib/jobScreeningContext'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireTenant(req, 'jobs.read')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  let row: Record<string, unknown> | undefined
  try {
    const { rows } = await pool.query(
      `SELECT id, short_id, title, company, client_name, location, status, type,
              employment_type, experience_min, experience_max,
              description, requirements, optional_requirements, raw_jd_text,
              skills_mandatory, skills_required, tags, screening_questions,
              salary_min, salary_max, currency, department, priority
       FROM job_posts
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [id, ctx.tenantId],
    )
    row = rows[0]
  } catch {
    const fallback = await pool.query(
      `SELECT id, short_id, title, company, location, status, type,
              description, requirements, optional_requirements, raw_jd_text
       FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, ctx.tenantId],
    )
    row = fallback.rows[0]
  }

  if (!row) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const jd_text = buildJdFromJobRow(row as Parameters<typeof buildJdFromJobRow>[0])
  if (!jd_text) {
    return NextResponse.json({
      error: 'Job has no description. Add a JD to this job first.',
      job: row,
      jd_text: '',
    }, { status: 422 })
  }

  return NextResponse.json({
    job: row,
    jd_text,
    title: row.title,
    skills: [
      ...((row.skills_mandatory as string[]) ?? []),
      ...((row.skills_required as string[]) ?? []),
    ],
    experience: {
      min: row.experience_min ?? null,
      max: row.experience_max ?? null,
    },
    client: row.client_name || row.company || null,
    employment_type: row.employment_type || row.type || null,
    screening_questions: row.screening_questions ?? null,
  })
}
