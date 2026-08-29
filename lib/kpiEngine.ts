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

/** Lightweight strip for Dashboard live poll (Phase D). Prefer over full insights. */
export type LiveOpsStrip = {
  scope: 'self' | 'tenant'
  period_days: number
  open_jobs: number
  active_candidates: number
  submissions: number
  interviews_scheduled: number
  interviews_completed: number
  interviews_upcoming: number
  offers_active: number
  offers_pending: number
  follow_ups_overdue: number
  follow_ups_pending: number
  joining_soon: number
  comms_sent: number
  ts: number
}

export async function computeLiveOpsStrip(opts: {
  tenantId: string
  userId: string
  /** tenant = manager/admin workspace rollup; self = recruiter personal */
  scope: 'self' | 'tenant'
  days?: number
}): Promise<LiveOpsStrip> {
  const days = Math.min(90, Math.max(7, opts.days ?? 30))
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()
  const scopeSelf = opts.scope === 'self'

  const userFilter = scopeSelf ? 'AND user_id = $2' : ''
  const interviewUser = scopeSelf ? 'AND interviewer_id = $2' : ''
  const params2 = scopeSelf ? [opts.tenantId, opts.userId, sinceIso] : [opts.tenantId, sinceIso]
  const pSince = scopeSelf ? 3 : 2

  const safe = async <T>(q: string, params: unknown[], fallback: T): Promise<T> => {
    try {
      const { rows } = await pool.query(q, params)
      return (rows[0] as T) ?? fallback
    } catch {
      return fallback
    }
  }

  const [
    jobs,
    candidates,
    submissions,
    interviews,
    offers,
    followUps,
    joining,
    comms,
    upcoming,
  ] = await Promise.all([
    safe<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM job_posts
       WHERE tenant_id = $1 AND COALESCE(status, 'active') IN ('active', 'open', 'published')`,
      [opts.tenantId],
      { c: '0' },
    ),
    safe<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM resumes
       WHERE tenant_id = $1 ${userFilter}
         AND COALESCE(pipeline_stage, '') NOT IN ('hired', 'rejected', 'withdrawn', 'archived')`,
      scopeSelf ? [opts.tenantId, opts.userId] : [opts.tenantId],
      { c: '0' },
    ),
    safe<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM submissions
       WHERE tenant_id = $1 ${userFilter} AND created_at >= $${pSince}`,
      params2,
      { c: '0' },
    ),
    safe<{ scheduled: string; completed: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('scheduled','confirmed'))::text AS scheduled,
         COUNT(*) FILTER (WHERE status = 'completed')::text AS completed
       FROM interviews
       WHERE tenant_id = $1 ${interviewUser} AND created_at >= $${pSince}`,
      params2,
      { scheduled: '0', completed: '0' },
    ),
    safe<{ active: string; pending: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('joined','cancelled','rejected','withdrawn'))::text AS active,
         COUNT(*) FILTER (WHERE status IN ('pending','sent','awaiting_response','draft'))::text AS pending
       FROM offer_cases
       WHERE tenant_id = $1 ${userFilter}`,
      scopeSelf ? [opts.tenantId, opts.userId] : [opts.tenantId],
      { active: '0', pending: '0' },
    ),
    safe<{ pending: string; overdue: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
         COUNT(*) FILTER (WHERE status = 'pending' AND due_at < NOW())::text AS overdue
       FROM follow_ups
       WHERE tenant_id = $1 ${userFilter}`,
      scopeSelf ? [opts.tenantId, opts.userId] : [opts.tenantId],
      { pending: '0', overdue: '0' },
    ),
    safe<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM offer_cases
       WHERE tenant_id = $1 ${userFilter}
         AND status IN ('accepted','joining','onboarding','offer_accepted')
         AND expected_joining IS NOT NULL
         AND expected_joining::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`,
      scopeSelf ? [opts.tenantId, opts.userId] : [opts.tenantId],
      { c: '0' },
    ),
    safe<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM communication_logs
       WHERE tenant_id = $1 ${userFilter} AND created_at >= $${pSince}
         AND COALESCE(direction, 'outbound') = 'outbound'`,
      params2,
      { c: '0' },
    ),
    safe<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM interviews
       WHERE tenant_id = $1 ${interviewUser}
         AND status IN ('scheduled','confirmed')
         AND scheduled_at >= NOW() AND scheduled_at < NOW() + interval '7 days'`,
      scopeSelf ? [opts.tenantId, opts.userId] : [opts.tenantId],
      { c: '0' },
    ),
  ])

  return {
    scope: opts.scope,
    period_days: days,
    open_jobs: parseInt(jobs.c ?? '0', 10),
    active_candidates: parseInt(candidates.c ?? '0', 10),
    submissions: parseInt(submissions.c ?? '0', 10),
    interviews_scheduled: parseInt(interviews.scheduled ?? '0', 10),
    interviews_completed: parseInt(interviews.completed ?? '0', 10),
    interviews_upcoming: parseInt(upcoming.c ?? '0', 10),
    offers_active: parseInt(offers.active ?? '0', 10),
    offers_pending: parseInt(offers.pending ?? '0', 10),
    follow_ups_overdue: parseInt(followUps.overdue ?? '0', 10),
    follow_ups_pending: parseInt(followUps.pending ?? '0', 10),
    joining_soon: parseInt(joining.c ?? '0', 10),
    comms_sent: parseInt(comms.c ?? '0', 10),
    ts: Date.now(),
  }
}
