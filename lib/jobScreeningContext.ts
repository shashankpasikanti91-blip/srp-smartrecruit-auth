/** Build complete JD text for AI Screening / Boolean / Posts from a job row. */

export type JobJdSource = {
  title?: string | null
  company?: string | null
  client_name?: string | null
  location?: string | null
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
