/**
 * Internal talent pool matching for a job — tenant-scoped only.
 */
import { pool } from '@/lib/db'
import { buildJdFromJobRow } from '@/lib/jobScreeningContext'

export type InternalMatchRow = {
  id: string
  short_id: string
  candidate_name: string
  match_percent: number
  ai_score: number | null
  skills: string[]
  experience: string | null
  location: string | null
  availability: string | null
  notice_period: string | null
  visa: string | null
  nationality: string | null
  recruiter_name: string | null
  recruiter_email: string | null
  pipeline_stage: string
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1),
  )
}

function skillOverlap(required: string[], candidateSkills: string[]): number {
  if (!required.length) return 50
  const reqTokens = new Set(required.flatMap(s => [...tokenize(s)]))
  if (!reqTokens.size) return 50
  const candTokens = new Set(candidateSkills.flatMap(s => [...tokenize(s)]))
  let hit = 0
  for (const t of reqTokens) {
    if (candTokens.has(t)) hit++
  }
  return Math.round((hit / reqTokens.size) * 100)
}

function profileStr(p: Record<string, unknown>, key: string): string | null {
  const v = p[key]
  if (v == null || v === '') return null
  return String(v)
}

export async function computeInternalMatches(
  tenantId: string,
  jobId: string,
  limit = 25,
): Promise<{ job_title: string; matches: InternalMatchRow[] }> {
  let jobRow: Record<string, unknown> | undefined
  try {
    const { rows } = await pool.query(
      `SELECT id, title, location, skills_mandatory, skills_required, tags,
              experience_min, experience_max, raw_jd_text, description, requirements
       FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [jobId, tenantId],
    )
    jobRow = rows[0]
  } catch {
    return { job_title: '', matches: [] }
  }
  if (!jobRow) return { job_title: '', matches: [] }

  const requiredSkills = [
    ...((jobRow.skills_mandatory as string[]) ?? []),
    ...((jobRow.skills_required as string[]) ?? []),
    ...((jobRow.tags as string[]) ?? []),
  ].filter((v, i, a) => v && a.indexOf(v) === i)

  const jdText = buildJdFromJobRow(jobRow as Parameters<typeof buildJdFromJobRow>[0])
  const jdTokens = tokenize(jdText)

  const { rows: candidates } = await pool.query(
    `SELECT r.id, r.short_id, r.candidate_name, r.ai_score, r.ai_skills,
            r.pipeline_stage, r.candidate_profile, r.raw_text,
            u.name AS recruiter_name, u.email AS recruiter_email
     FROM resumes r
     LEFT JOIN auth_users u ON u.id = r.user_id
     WHERE r.tenant_id = $1
       AND r.pipeline_stage NOT IN ('rejected', 'withdrawn', 'employee')
     ORDER BY r.ai_score DESC NULLS LAST, r.updated_at DESC
     LIMIT 200`,
    [tenantId],
  )

  const jobLocation = String(jobRow.location ?? '').toLowerCase()
  const scored: InternalMatchRow[] = []

  for (const row of candidates) {
    const profile = typeof row.candidate_profile === 'string'
      ? (() => { try { return JSON.parse(row.candidate_profile) } catch { return {} } })()
      : (row.candidate_profile as Record<string, unknown>) ?? {}

    const skills = Array.isArray(row.ai_skills)
      ? (row.ai_skills as string[])
      : []

    let matchPercent = skillOverlap(requiredSkills, skills)

    const candText = tokenize(`${row.raw_text ?? ''} ${skills.join(' ')}`)
    let jdHits = 0
    for (const t of jdTokens) {
      if (candText.has(t)) jdHits++
    }
    if (jdTokens.size > 0) {
      const jdScore = Math.round((jdHits / Math.min(jdTokens.size, 80)) * 100)
      matchPercent = Math.round(matchPercent * 0.6 + jdScore * 0.4)
    }

    const location = profileStr(profile, 'current_location') ?? profileStr(profile, 'preferred_location')
    if (jobLocation && location && location.toLowerCase().includes(jobLocation.split(',')[0])) {
      matchPercent = Math.min(100, matchPercent + 8)
    }

    const aiScore = row.ai_score != null ? Number(row.ai_score) : null
    if (aiScore != null) {
      matchPercent = Math.round(matchPercent * 0.7 + aiScore * 0.3)
    }

    scored.push({
      id: String(row.id),
      short_id: String(row.short_id ?? row.id).slice(0, 12),
      candidate_name: String(row.candidate_name ?? ''),
      match_percent: matchPercent,
      ai_score: aiScore,
      skills: skills.slice(0, 12),
      experience: profileStr(profile, 'total_experience'),
      location,
      availability: profileStr(profile, 'availability') ?? profileStr(profile, 'work_authorization'),
      notice_period: profileStr(profile, 'notice_period'),
      visa: profileStr(profile, 'visa_type'),
      nationality: profileStr(profile, 'nationality'),
      recruiter_name: (row.recruiter_name as string) ?? null,
      recruiter_email: (row.recruiter_email as string) ?? null,
      pipeline_stage: String(row.pipeline_stage ?? ''),
    })
  }

  scored.sort((a, b) => b.match_percent - a.match_percent)
  return {
    job_title: String(jobRow.title ?? ''),
    matches: scored.slice(0, limit),
  }
}
