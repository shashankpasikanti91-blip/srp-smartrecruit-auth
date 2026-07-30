/** Build complete JD text for AI Screening / Boolean / Posts from a job row. */

import type { Pool } from 'pg'

export type JobJdSource = {
  id?: string
  short_id?: string | null
  title?: string | null
  company?: string | null
  client_name?: string | null
  location?: string | null
  status?: string | null
  type?: string | null
  employment_type?: string | null
  experience_min?: number | null
  experience_max?: number | null
  description?: string | null
  requirements?: string | null
  optional_requirements?: string | null
  raw_jd_text?: string | null
  skills_mandatory?: string[] | null
  skills_required?: string[] | null
  tags?: string[] | null
  screening_questions?: unknown
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  department?: string | null
  priority?: string | null
}

export function buildJdFromJobRow(row: JobJdSource): string {
  const blocks: string[] = []
  if (row.title) blocks.push(`# ${row.title}`)
  const client = row.client_name || row.company
  if (client) blocks.push(`Client / Company: ${client}`)
  if (row.location) blocks.push(`Location: ${row.location}`)
  const emp = row.employment_type || row.type
  if (emp) blocks.push(`Employment Type: ${emp}`)
  if (row.experience_min != null || row.experience_max != null) {
    blocks.push(
      `Experience: ${row.experience_min ?? '?'}${row.experience_max != null ? `–${row.experience_max}` : '+'} years`,
    )
  }
  const skills = [
    ...(Array.isArray(row.skills_mandatory) ? row.skills_mandatory : []),
    ...(Array.isArray(row.skills_required) ? row.skills_required : []),
    ...(Array.isArray(row.tags) ? row.tags : []),
  ].filter(Boolean)
  if (skills.length) blocks.push(`Skills: ${[...new Set(skills)].join(', ')}`)

  const raw = row.raw_jd_text?.trim()
  if (raw) {
    blocks.push('## Full Job Description\n' + raw)
  } else {
    if (row.description?.trim()) blocks.push('## Role description\n' + row.description.trim())
    if (row.requirements?.trim()) blocks.push('## Required / must-have\n' + row.requirements.trim())
  }
  if (row.optional_requirements?.trim()) {
    blocks.push('## Nice-to-have\n' + row.optional_requirements.trim())
  }
  if (row.screening_questions) {
    const q = Array.isArray(row.screening_questions)
      ? row.screening_questions
      : typeof row.screening_questions === 'object'
        ? Object.values(row.screening_questions as object)
        : []
    if (q.length) {
      blocks.push(
        '## Screening Questions\n' +
          q.map((item, i) => `${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n'),
      )
    }
  }
  return blocks.join('\n\n').trim()
}

/**
 * Load a job for screening / JD context.
 * Uses SELECT * so missing optional columns (screening_questions, skills_*, etc.)
 * never crash screening — only present fields are used.
 */
export async function fetchJobJdSource(
  db: Pool,
  tenantId: string,
  jobId: string,
): Promise<JobJdSource | null> {
  const { rows } = await db.query(
    `SELECT * FROM job_posts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [jobId, tenantId],
  )
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null

  const asStringArray = (v: unknown): string[] | null => {
    if (Array.isArray(v)) return v.map(x => String(x)).filter(Boolean)
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v)
        if (Array.isArray(parsed)) return parsed.map(x => String(x)).filter(Boolean)
      } catch { /* ignore */ }
    }
    return null
  }

  return {
    id: row.id != null ? String(row.id) : undefined,
    short_id: (row.short_id as string) ?? null,
    title: (row.title as string) ?? null,
    company: (row.company as string) ?? null,
    client_name: (row.client_name as string) ?? null,
    location: (row.location as string) ?? null,
    status: (row.status as string) ?? null,
    type: (row.type as string) ?? null,
    // Never read a non-existent employment_type column — SELECT * only returns real cols
    employment_type: (row.employment_type as string) ?? (row.type as string) ?? null,
    experience_min: row.experience_min != null ? Number(row.experience_min) : null,
    experience_max: row.experience_max != null ? Number(row.experience_max) : null,
    description: (row.description as string) ?? null,
    requirements: (row.requirements as string) ?? null,
    optional_requirements: (row.optional_requirements as string) ?? null,
    raw_jd_text: (row.raw_jd_text as string) ?? null,
    skills_mandatory: asStringArray(row.skills_mandatory),
    skills_required: asStringArray(row.skills_required),
    tags: asStringArray(row.tags),
    screening_questions: row.screening_questions ?? null,
    salary_min: row.salary_min != null ? Number(row.salary_min) : null,
    salary_max: row.salary_max != null ? Number(row.salary_max) : null,
    currency: (row.currency as string) ?? null,
    department: (row.department as string) ?? null,
    priority: (row.priority as string) ?? null,
  }
}
