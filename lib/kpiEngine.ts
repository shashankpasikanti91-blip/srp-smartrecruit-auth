import { pool } from './db'

export type RecruiterKpi = {
  period_days: number
  candidates_added: number
  candidates_screened: number
  submissions: number
  interviews_scheduled: number
  interviews_completed: number
  comms_sent: number
  follow_ups_pending: number
  follow_ups_overdue: number
  offers_active: number
  submission_conversion_rate: number
  interview_conversion_rate: number
  pipeline_by_stage: Record<string, number>
}

export async function computeRecruiterKpi(opts: {
  tenantId: string
  userId: string
  days?: number
}): Promise<RecruiterKpi> {
  const days = Math.min(365, Math.max(7, opts.days ?? 30))
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [
    added,
    screened,
    submissions,
    interviews,
    comms,
    followUps,
    offers,
    pipeline,
  ] = await Promise.all([
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM resumes
       WHERE tenant_id = $1 AND user_id = $2 AND created_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM resumes
       WHERE tenant_id = $1 AND user_id = $2 AND ai_score IS NOT NULL AND updated_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM submissions
       WHERE tenant_id = $1 AND user_id = $2 AND created_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ scheduled: string; completed: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('scheduled','confirmed'))::text AS scheduled,
         COUNT(*) FILTER (WHERE status = 'completed')::text AS completed
       FROM interviews
       WHERE tenant_id = $1 AND interviewer_id = $2 AND created_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM communication_logs
       WHERE tenant_id = $1 AND user_id = $2 AND created_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ pending: string; overdue: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
         COUNT(*) FILTER (WHERE status = 'pending' AND due_at < NOW())::text AS overdue
       FROM follow_ups
       WHERE tenant_id = $1 AND user_id = $2 AND created_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM offer_cases
       WHERE tenant_id = $1 AND user_id = $2
         AND status NOT IN ('joined','cancelled')
         AND created_at >= $3`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
    pool.query<{ pipeline_stage: string; c: string }>(
      `SELECT pipeline_stage, COUNT(*)::text AS c FROM resumes
       WHERE tenant_id = $1 AND user_id = $2 AND created_at >= $3
       GROUP BY pipeline_stage`,
      [opts.tenantId, opts.userId, since.toISOString()]
    ),
  ])

  const pipeline_by_stage: Record<string, number> = {}
  for (const row of pipeline.rows) {
    pipeline_by_stage[row.pipeline_stage] = parseInt(row.c, 10)
  }

  return {
    period_days: days,
    candidates_added: parseInt(added.rows[0]?.c ?? '0', 10),
    candidates_screened: parseInt(screened.rows[0]?.c ?? '0', 10),
    submissions: parseInt(submissions.rows[0]?.c ?? '0', 10),
    interviews_scheduled: parseInt(interviews.rows[0]?.scheduled ?? '0', 10),
    interviews_completed: parseInt(interviews.rows[0]?.completed ?? '0', 10),
    comms_sent: parseInt(comms.rows[0]?.c ?? '0', 10),
    follow_ups_pending: parseInt(followUps.rows[0]?.pending ?? '0', 10),
    follow_ups_overdue: parseInt(followUps.rows[0]?.overdue ?? '0', 10),
    offers_active: parseInt(offers.rows[0]?.c ?? '0', 10),
    submission_conversion_rate:
      parseInt(added.rows[0]?.c ?? '0', 10) > 0
        ? Math.round((parseInt(submissions.rows[0]?.c ?? '0', 10) / parseInt(added.rows[0]?.c ?? '0', 10)) * 100)
        : 0,
    interview_conversion_rate:
      parseInt(submissions.rows[0]?.c ?? '0', 10) > 0
        ? Math.round((parseInt(interviews.rows[0]?.scheduled ?? '0', 10) / parseInt(submissions.rows[0]?.c ?? '0', 10)) * 100)
        : 0,
    pipeline_by_stage,
  }
}

export async function computeTenantFunnel(tenantId: string, days = 90) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { rows } = await pool.query<{ stage: string; c: string }>(
    `SELECT pipeline_stage AS stage, COUNT(*)::text AS c
     FROM resumes WHERE tenant_id = $1 AND created_at >= $2
     GROUP BY pipeline_stage`,
    [tenantId, since.toISOString()]
  )

  const funnel: Record<string, number> = {}
  for (const r of rows) funnel[r.stage] = parseInt(r.c, 10)

  const subs = await pool.query<{ stage: string; c: string }>(
    `SELECT stage, COUNT(*)::text AS c FROM submissions
     WHERE tenant_id = $1 AND created_at >= $2 GROUP BY stage`,
    [tenantId, since.toISOString()]
  )
  const submission_stages: Record<string, number> = {}
  for (const r of subs.rows) submission_stages[r.stage] = parseInt(r.c, 10)

  return { funnel, submission_stages, period_days: days }
}
