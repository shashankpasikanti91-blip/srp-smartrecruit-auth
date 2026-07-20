/**
 * Multi-dimensional Candidate AI Fit Scorecard (Phase 3).
 * Deterministic heuristics from tenant profile + optional job context.
 * Scores are 0–100 integers.
 */

export type AiFitScores = {
  skill_match: number
  experience_match: number
  domain_match: number
  location_match: number
  notice_match: number
  salary_match: number
  communication_score: number
  resume_quality: number
  interview_score: number
  overall: number
  computed_at: string
  job_id?: string | null
  rationale?: Record<string, string>
}

type CandidateLike = {
  ai_score?: number | null
  ai_skills?: string[] | null
  ai_summary?: string | null
  candidate_profile?: Record<string, unknown> | null
  location?: string | null
  years_experience?: number | null
}

type JobLike = {
  title?: string | null
  location?: string | null
  requirements?: string | null
  description?: string | null
  skills?: string[] | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9+#.]/).filter(t => t.length > 2)
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setB = new Set(b)
  const hits = a.filter(x => setB.has(x) || [...setB].some(y => y.includes(x) || x.includes(y)))
  return hits.length / Math.max(a.length, 1)
}

function profileStr(p: Record<string, unknown> | null | undefined, key: string): string {
  const v = p?.[key]
  return v == null ? '' : String(v)
}

export function computeAiFitScores(
  candidate: CandidateLike,
  job?: JobLike | null,
): AiFitScores {
  const profile = candidate.candidate_profile ?? {}
  const candSkills = (candidate.ai_skills ?? []).map(s => s.toLowerCase())
  const skillText = [
    ...candSkills,
    ...tokens(candidate.ai_summary ?? ''),
    ...tokens(profileStr(profile, 'skills')),
    ...tokens(profileStr(profile, 'primary_skill')),
  ]
  const jobSkillSrc = [
    ...(job?.skills ?? []),
    ...(job?.requirements ? tokens(job.requirements) : []),
    ...(job?.title ? tokens(job.title) : []),
  ].map(s => s.toLowerCase())

  const skillOverlap = jobSkillSrc.length
    ? overlap(skillText, jobSkillSrc)
    : Math.min(1, candSkills.length / 8)
  const skill_match = clamp(40 + skillOverlap * 60 + (candidate.ai_score ? candidate.ai_score * 0.15 : 0))

  const years = Number(
    candidate.years_experience
    ?? profile.years_experience
    ?? profile.experience_years
    ?? 0,
  ) || 0
  const expTarget = /\bsenior|lead|principal\b/i.test(job?.title ?? '') ? 7
    : /\bjunior|intern\b/i.test(job?.title ?? '') ? 1 : 4
  const expDelta = Math.abs(years - expTarget)
  const experience_match = clamp(100 - expDelta * 12)

  const domainHints = tokens(`${job?.title ?? ''} ${job?.description ?? ''}`)
  const candDomain = tokens(`${candidate.ai_summary ?? ''} ${profileStr(profile, 'industry')} ${profileStr(profile, 'domain')}`)
  const domain_match = job
    ? clamp(35 + overlap(candDomain, domainHints) * 65)
    : clamp(50 + Math.min(40, candDomain.length * 2))

  const candLoc = (candidate.location || profileStr(profile, 'location') || profileStr(profile, 'city')).toLowerCase()
  const jobLoc = (job?.location ?? '').toLowerCase()
  let location_match = 70
  if (jobLoc && candLoc) {
    if (candLoc.includes(jobLoc) || jobLoc.includes(candLoc)) location_match = 95
    else if (tokens(candLoc).some(t => jobLoc.includes(t))) location_match = 80
    else location_match = 40
  } else if (!jobLoc) location_match = 75

  const noticeRaw = profileStr(profile, 'notice_period') || profileStr(profile, 'notice')
  const noticeDays = parseInt(noticeRaw.replace(/\D/g, ''), 10)
  const notice_match = !noticeRaw ? 65
    : Number.isFinite(noticeDays)
      ? clamp(noticeDays <= 30 ? 95 : noticeDays <= 60 ? 75 : noticeDays <= 90 ? 55 : 35)
      : /immediate|serving/i.test(noticeRaw) ? 90 : 60

  const expectedSal = Number(profile.expected_salary || profile.salary_expectation || 0) || 0
  let salary_match = 70
  if (job && (job.salary_min || job.salary_max) && expectedSal) {
    const min = job.salary_min ?? 0
    const max = job.salary_max ?? min * 1.3
    if (expectedSal >= min && expectedSal <= max) salary_match = 95
    else if (expectedSal < min) salary_match = clamp(70 - ((min - expectedSal) / min) * 40)
    else salary_match = clamp(70 - ((expectedSal - max) / max) * 50)
  }

  const hasEmail = !!(profile.email || profile.candidate_email)
  const hasPhone = !!(profile.phone || profile.candidate_phone)
  const communication_score = clamp(
    40
    + (hasEmail ? 25 : 0)
    + (hasPhone ? 20 : 0)
    + (candidate.ai_summary && candidate.ai_summary.length > 80 ? 15 : 5),
  )

  const resumeLen = (candidate.ai_summary ?? '').length + skillText.length * 10
  const resume_quality = clamp(
    30
    + Math.min(40, resumeLen / 20)
    + (candSkills.length >= 5 ? 20 : candSkills.length * 3)
    + (candidate.ai_score ? 10 : 0),
  )

  const interviewRaw = profile.interview_score ?? profile.last_interview_score
  const interview_score = interviewRaw != null
    ? clamp(Number(interviewRaw))
    : 50

  const overall = clamp(
    skill_match * 0.22
    + experience_match * 0.14
    + domain_match * 0.12
    + location_match * 0.08
    + notice_match * 0.08
    + salary_match * 0.1
    + communication_score * 0.08
    + resume_quality * 0.1
    + interview_score * 0.08,
  )

  return {
    skill_match,
    experience_match,
    domain_match,
    location_match,
    notice_match,
    salary_match,
    communication_score,
    resume_quality,
    interview_score,
    overall,
    computed_at: new Date().toISOString(),
    job_id: null,
    rationale: {
      skill_match: jobSkillSrc.length ? `${Math.round(skillOverlap * 100)}% skill overlap vs job` : 'Based on profile skill density',
      experience_match: `${years}y vs target ~${expTarget}y`,
      location_match: jobLoc ? `${candLoc || 'unknown'} vs ${jobLoc}` : 'No job location set',
      salary_match: expectedSal ? `Expected ${expectedSal}` : 'No salary expectation on file',
    },
  }
}
