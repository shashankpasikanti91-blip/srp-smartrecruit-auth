import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { computeAiFitScores } from '@/lib/aiFitScore'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const jobId = req.nextUrl.searchParams.get('job_id')
  const cand = await pool.query(
    `SELECT id, ai_score, ai_skills, ai_summary, candidate_profile, ai_fit_scores,
            candidate_profile->>'location' AS location
     FROM resumes WHERE id = $1 AND tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!cand.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let job = null
  if (jobId && isValidUUID(jobId)) {
    const j = await pool.query(
      `SELECT title, location, requirements, description, skills, salary_min, salary_max, currency
       FROM job_posts WHERE id = $1 AND tenant_id = $2`,
      [jobId, ctx.tenantId]
    )
    job = j.rows[0] ?? null
  }

  const scores = computeAiFitScores(
    {
      ai_score: cand.rows[0].ai_score,
      ai_skills: cand.rows[0].ai_skills,
      ai_summary: cand.rows[0].ai_summary,
      candidate_profile: cand.rows[0].candidate_profile,
      location: cand.rows[0].location,
    },
    job,
  )
  if (jobId) scores.job_id = jobId

  try {
    await pool.query(
      `UPDATE resumes SET ai_fit_scores = $1::jsonb WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify(scores), id, ctx.tenantId]
    )
  } catch { /* ignore */ }

  return NextResponse.json({ scores })
}
