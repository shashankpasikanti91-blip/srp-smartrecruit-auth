import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { isValidUUID } from '@/lib/validate'
import { analyzeJobFillDifficulty } from '@/lib/marketIntelligence'
import { computeAiFitScores } from '@/lib/aiFitScore'
import { listEntityTimeline } from '@/lib/timelineEngine'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const jobRes = await pool.query(
    `SELECT j.*, c.name AS client_name
     FROM job_posts j
     LEFT JOIN clients c ON c.id = j.client_id
     WHERE j.id = $1 AND j.tenant_id = $2`,
    [id, ctx.tenantId]
  )
  if (!jobRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const job = jobRes.rows[0]

  const [pipeline, submissions, interviews, offers, similar, candidates, timeline] = await Promise.all([
    pool.query(
      `SELECT COALESCE(pipeline_stage,'sourced') AS stage, COUNT(*)::int AS n
       FROM resumes WHERE tenant_id = $1 AND job_posts_id = $2
       GROUP BY 1`,
      [ctx.tenantId, id]
    ).catch(async () => {
      // alternate: candidates linked via submissions
      return pool.query(
        `SELECT COALESCE(r.pipeline_stage,'sourced') AS stage, COUNT(*)::int AS n
         FROM submissions s
         JOIN resumes r ON r.id = s.resume_id
         WHERE s.tenant_id = $1 AND s.job_post_id = $2
         GROUP BY 1`,
        [ctx.tenantId, id]
      ).catch(() => ({ rows: [] }))
    }),
    pool.query(
      `SELECT s.*, r.candidate_name, r.short_id AS candidate_short_id, r.ai_score
       FROM submissions s JOIN resumes r ON r.id = s.resume_id
       WHERE s.tenant_id = $1 AND s.job_post_id = $2
       ORDER BY s.updated_at DESC LIMIT 50`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT * FROM interviews WHERE tenant_id = $1 AND job_post_id = $2
       ORDER BY scheduled_at DESC LIMIT 40`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT o.*, r.candidate_name FROM offer_cases o
       JOIN resumes r ON r.id = o.resume_id
       WHERE o.tenant_id = $1 AND o.job_post_id = $2
       ORDER BY o.updated_at DESC LIMIT 30`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, short_id, title, location, status, salary_min, salary_max
       FROM job_posts
       WHERE tenant_id = $1 AND id != $2 AND status != 'archived'
         AND (
           title ILIKE '%' || split_part($3, ' ', 1) || '%'
           OR company = $4
         )
       ORDER BY created_at DESC LIMIT 8`,
      [ctx.tenantId, id, job.title ?? 'x', job.company ?? '']
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT r.id, r.short_id, r.candidate_name, r.ai_score, r.ai_skills, r.ai_summary,
              r.candidate_profile, r.ai_fit_scores, s.stage
       FROM submissions s
       JOIN resumes r ON r.id = s.resume_id
       WHERE s.tenant_id = $1 AND s.job_post_id = $2
       ORDER BY COALESCE(r.ai_score, 0) DESC
       LIMIT 25`,
      [ctx.tenantId, id]
    ).catch(() => ({ rows: [] })),
    listEntityTimeline({ tenantId: ctx.tenantId, entityType: 'job', entityId: id, limit: 30 }).catch(() => []),
  ])

  const market = await analyzeJobFillDifficulty({ tenantId: ctx.tenantId, jobId: id })

  // Persist difficulty hint
  try {
    await pool.query(
      `UPDATE job_posts SET hiring_difficulty = $1, market_insights = $2::jsonb, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [market.difficulty, JSON.stringify(market), id, ctx.tenantId]
    )
  } catch { /* ignore */ }

  const ranking = candidates.rows.map((r: Record<string, unknown>) => {
    const existing = r.ai_fit_scores && typeof r.ai_fit_scores === 'object' && Object.keys(r.ai_fit_scores as object).length
      ? r.ai_fit_scores as ReturnType<typeof computeAiFitScores>
      : computeAiFitScores({
          ai_score: r.ai_score as number | null,
          ai_skills: r.ai_skills as string[] | null,
          ai_summary: r.ai_summary as string | null,
          candidate_profile: r.candidate_profile as Record<string, unknown> | null,
        }, {
          title: job.title,
          location: job.location,
          requirements: job.requirements,
          description: job.description,
          skills: job.skills,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
        })
    return {
      id: r.id,
      resume_id: r.id,
      short_id: r.short_id,
      candidate_name: r.candidate_name,
      stage: r.stage,
      pipeline_stage: r.stage,
      ai_score: r.ai_score,
      ai_fit_scores: existing,
      fit: existing,
    }
  }).sort((a: { fit: { overall: number } }, b: { fit: { overall: number } }) => b.fit.overall - a.fit.overall)

  // Time to fill proxy
  let time_to_fill_days: number | null = null
  try {
    const { rows } = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (MIN(o.updated_at) - j.created_at)) / 86400 AS days
       FROM job_posts j
       JOIN offer_cases o ON o.job_post_id = j.id AND o.status IN ('joined','completed')
       WHERE j.id = $1 AND j.tenant_id = $2
       GROUP BY j.created_at`,
      [id, ctx.tenantId]
    )
    time_to_fill_days = rows[0]?.days != null ? Math.round(Number(rows[0].days) * 10) / 10 : null
  } catch { /* ignore */ }

  const pipelineMap: Record<string, number> = {}
  for (const r of pipeline.rows) pipelineMap[r.stage] = r.n

  return NextResponse.json({
    job: {
      ...job,
      hiring_manager: job.hiring_manager ?? null,
      client_name: job.client_name,
    },
    required_skills: job.skills ?? [],
    pipeline: pipelineMap,
    ranking,
    candidate_ranking: ranking,
    submissions: submissions.rows,
    interviews: interviews.rows,
    offers: offers.rows,
    similar_jobs: similar.rows,
    salary_benchmark: job.salary_benchmark ?? {
      min: job.salary_min,
      max: job.salary_max,
      currency: job.currency,
    },
    market: {
      ...market,
      insights: market,
      salary_benchmark: job.salary_benchmark ?? {
        min: job.salary_min,
        max: job.salary_max,
        currency: job.currency,
      },
    },
    hiring_difficulty: market.difficulty,
    time_to_fill_days,
    ai_suggestions: market.reasons.slice(0, 5),
    timeline,
  })
}
