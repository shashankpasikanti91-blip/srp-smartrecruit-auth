import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { buildJdFromJobRow, fetchJobJdSource } from '@/lib/jobScreeningContext'

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

  // SELECT * via helper — never fails on missing optional columns
  const row = await fetchJobJdSource(pool, ctx.tenantId, id)
  if (!row) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const jd_text = buildJdFromJobRow(row)
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
      ...(row.skills_mandatory ?? []),
      ...(row.skills_required ?? []),
    ],
    experience: {
      min: row.experience_min ?? null,
      max: row.experience_max ?? null,
    },
    client: row.company || null,
    employment_type: row.type || row.employment_type || null,
    screening_questions: row.screening_questions ?? null,
  })
}
