import { pool as db } from './db'

export type MarketInsight = {
  difficulty: 'low' | 'medium' | 'high' | 'critical'
  score: number
  reasons: string[]
  salary_vs_market?: string
  pool_size?: number
  rare_skills?: string[]
  notice_pressure?: string
  location?: string | null
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9+#.]/).filter(t => t.length > 2)
}

/** Heuristic market intelligence from tenant SQL — no external market feed. */
export async function analyzeJobFillDifficulty(opts: {
  tenantId: string
  jobId: string
}): Promise<MarketInsight> {
  const reasons: string[] = []
  let score = 40

  const jobRes = await db.query(
    `SELECT id, title, location, requirements, description, skills,
            salary_min, salary_max, currency, priority, internal_sla_days
     FROM job_posts WHERE id = $1 AND tenant_id = $2`,
    [opts.jobId, opts.tenantId]
  )
  const job = jobRes.rows[0]
  if (!job) {
    return { difficulty: 'medium', score: 50, reasons: ['Job not found in tenant data.'] }
  }

  const skillList: string[] = Array.isArray(job.skills)
    ? job.skills
    : tokens(`${job.requirements ?? ''} ${job.title ?? ''}`)

  // Candidate pool in location / skills
  let poolSize = 0
  try {
    const likeSkills = skillList.slice(0, 5)
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM resumes
       WHERE tenant_id = $1
         AND (
           ($2::text IS NULL OR COALESCE(candidate_profile->>'location','') ILIKE '%' || $2 || '%')
           OR ai_skills && $3::text[]
           OR COALESCE(ai_summary,'') ILIKE '%' || COALESCE($4,'') || '%'
         )`,
      [
        opts.tenantId,
        job.location ?? null,
        likeSkills.length ? likeSkills : ['__none__'],
        likeSkills[0] ?? null,
      ]
    )
    poolSize = rows[0]?.n ?? 0
  } catch {
    poolSize = 0
  }

  if (poolSize < 5) {
    score += 25
    reasons.push(`Limited candidate pool in tenant data (${poolSize} matching profiles).`)
  } else if (poolSize < 15) {
    score += 12
    reasons.push(`Moderate candidate pool (${poolSize} profiles) — competition for talent likely.`)
  } else {
    reasons.push(`Healthy internal pool (${poolSize} profiles) for this search profile.`)
  }

  // Salary vs tenant peer jobs
  if (job.salary_max || job.salary_min) {
    try {
      const { rows } = await db.query(
        `SELECT AVG(COALESCE(salary_max, salary_min))::float AS avg_sal
         FROM job_posts
         WHERE tenant_id = $1 AND status != 'archived'
           AND (title ILIKE '%' || $2 || '%' OR skills && $3::text[])
           AND id != $4
           AND COALESCE(salary_max, salary_min) IS NOT NULL`,
        [opts.tenantId, tokens(job.title ?? '')[0] ?? 'x', skillList.slice(0, 3), opts.jobId]
      )
      const avg = rows[0]?.avg_sal
      const ours = Number(job.salary_max ?? job.salary_min)
      if (avg && ours && ours < avg * 0.85) {
        score += 20
        reasons.push(`Salary (${ours} ${job.currency ?? ''}) is ~${Math.round((1 - ours / avg) * 100)}% below similar open roles in your tenant (${Math.round(avg)}).`)
      } else if (avg && ours && ours >= avg) {
        reasons.push(`Salary is competitive vs similar tenant roles (avg ~${Math.round(avg)}).`)
      }
    } catch { /* ignore */ }
  } else {
    score += 8
    reasons.push('No salary band set — candidates may bounce without compensation clarity.')
  }

  // Rare skill combo
  const rare: string[] = []
  for (const sk of skillList.slice(0, 8)) {
    try {
      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS n FROM resumes
         WHERE tenant_id = $1 AND (
           $2 = ANY(COALESCE(ai_skills, ARRAY[]::text[]))
           OR COALESCE(ai_summary,'') ILIKE '%' || $2 || '%'
         )`,
        [opts.tenantId, sk]
      )
      if ((rows[0]?.n ?? 0) <= 2) rare.push(sk)
    } catch { /* ignore */ }
  }
  if (rare.length >= 2) {
    score += 18
    reasons.push(`Rare skill combination in your database: ${rare.slice(0, 4).join(', ')}.`)
  } else if (rare.length === 1) {
    score += 8
    reasons.push(`Scarce skill in pool: ${rare[0]}.`)
  }

  // Priority / SLA pressure
  if (/high/i.test(String(job.priority ?? ''))) {
    score += 10
    reasons.push('Marked HIGH priority — fill pressure elevates perceived difficulty.')
  }
  if (job.internal_sla_days && Number(job.internal_sla_days) <= 14) {
    score += 10
    reasons.push(`Tight internal SLA (${job.internal_sla_days} days).`)
  }

  // Submission starvation
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM submissions WHERE tenant_id = $1 AND job_post_id = $2`,
      [opts.tenantId, opts.jobId]
    )
    if ((rows[0]?.n ?? 0) === 0) {
      score += 12
      reasons.push('No submissions yet — pipeline cold start.')
    }
  } catch { /* ignore */ }

  score = Math.max(0, Math.min(100, score))
  const difficulty =
    score >= 75 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low'

  if (!reasons.length) reasons.push('Insufficient tenant signals — treat as medium difficulty.')

  return {
    difficulty,
    score,
    reasons,
    pool_size: poolSize,
    rare_skills: rare,
    location: job.location,
    salary_vs_market: reasons.find(r => r.toLowerCase().includes('salary')) ?? undefined,
    notice_pressure: /notice/i.test(job.requirements ?? '')
      ? 'Job requirements mention notice constraints — may shrink active pool.'
      : undefined,
  }
}

export function formatMarketInsightForPrompt(insight: MarketInsight, jobTitle?: string): string {
  return `MARKET INTELLIGENCE${jobTitle ? ` for "${jobTitle}"` : ''}:
- Hiring difficulty: ${insight.difficulty} (score ${insight.score}/100)
- Pool size (tenant): ${insight.pool_size ?? 'n/a'}
- Rare skills: ${(insight.rare_skills ?? []).join(', ') || 'none flagged'}
- Reasons:
${insight.reasons.map(r => `  • ${r}`).join('\n')}
${insight.notice_pressure ? `- Notice: ${insight.notice_pressure}` : ''}

Answer with concrete reasoning grounded in these signals. Do not invent external salary surveys.`
}
