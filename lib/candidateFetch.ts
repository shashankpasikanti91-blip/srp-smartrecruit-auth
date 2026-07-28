/**
 * Shared tenant-scoped candidate row fetch + JSON normalization.
 */
import { pool } from '@/lib/db'

export type CandidateRow = {
  id: string
  short_id: string
  candidate_name: string
  candidate_email: string | null
  candidate_phone: string | null
  ai_score: number | null
  match_category: string | null
  pipeline_stage: string
  status: string
  ai_skills: string[] | null
  ai_summary: string | null
  ai_screening_data: unknown
  candidate_profile: Record<string, unknown> | null
  raw_text: string | null
  file_name: string | null
  resume_original_path: string | null
  reviewer_notes: string | null
  source_type: string | null
  user_id: string | null
  job_post_id: string | null
  created_at: string
  updated_at: string | null
  last_contacted_at: string | null
  uploaded_by: { name: string | null; email: string | null } | null
  owner: { user_id: string; name: string | null; email: string | null } | null
  job_posts: { id: string; short_id: string; title: string; company: string } | null
}

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

export function normalizeCandidateRow(row: Record<string, unknown>): CandidateRow {
  const profile = parseJsonField<Record<string, unknown> | null>(row.candidate_profile, null)
  const screening = parseJsonField<unknown>(row.ai_screening_data, null)
  const skills = Array.isArray(row.ai_skills)
    ? (row.ai_skills as string[])
    : parseJsonField<string[]>(row.ai_skills, [])

  let jobPosts: CandidateRow['job_posts'] = null
  if (row.job_id) {
    jobPosts = {
      id: String(row.job_id),
      short_id: String(row.job_short_id ?? row.job_id).slice(0, 12),
      title: String(row.job_title ?? ''),
      company: String(row.job_company ?? ''),
    }
  }

  let uploadedBy: CandidateRow['uploaded_by'] = null
  if (row.uploader_email || row.uploader_name) {
    uploadedBy = {
      name: (row.uploader_name as string) ?? null,
      email: (row.uploader_email as string) ?? null,
    }
  }

  let owner: CandidateRow['owner'] = null
  if (row.user_id) {
    owner = {
      user_id: String(row.user_id),
      name: (row.owner_name as string) ?? null,
      email: (row.owner_email as string) ?? null,
    }
  }

  return {
    id: String(row.id),
    short_id: String(row.short_id ?? row.id).slice(0, 12),
    candidate_name: String(row.candidate_name ?? ''),
    candidate_email: (row.candidate_email as string) ?? null,
    candidate_phone: (row.candidate_phone as string) ?? null,
    ai_score: row.ai_score != null ? Number(row.ai_score) : null,
    match_category: (row.match_category as string) ?? null,
    pipeline_stage: String(row.pipeline_stage ?? 'sourced'),
    status: String(row.status ?? 'pending'),
    ai_skills: skills,
    ai_summary: (row.ai_summary as string) ?? null,
    ai_screening_data: screening,
    candidate_profile: profile,
    raw_text: (row.raw_text as string) ?? null,
    file_name: (row.file_name as string) ?? null,
    resume_original_path: (row.resume_original_path as string) ?? null,
    reviewer_notes: (row.reviewer_notes as string) ?? null,
    source_type: (row.source_type as string) ?? null,
    user_id: (row.user_id as string) ?? null,
    job_post_id: (row.job_post_id as string) ?? null,
    created_at: new Date(row.created_at as string | Date).toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at as string | Date).toISOString() : null,
    last_contacted_at: row.last_contacted_at
      ? new Date(row.last_contacted_at as string | Date).toISOString()
      : null,
    uploaded_by: uploadedBy,
    owner,
    job_posts: jobPosts,
  }
}

const CANDIDATE_SELECT = `
  SELECT r.id, r.short_id, r.candidate_name, r.candidate_email, r.candidate_phone,
         r.ai_score, r.match_category, r.pipeline_stage, r.status, r.ai_skills,
         r.ai_summary, r.ai_screening_data, r.candidate_profile, r.raw_text,
         r.file_name, r.resume_original_path, r.reviewer_notes, r.source_type,
         r.user_id, r.job_post_id, r.created_at, r.updated_at, r.last_contacted_at,
         u.name AS uploader_name, u.email AS uploader_email,
         ou.name AS owner_name, ou.email AS owner_email,
         jp.id AS job_id, jp.short_id AS job_short_id, jp.title AS job_title,
         COALESCE(jp.company, jp.client_name, '') AS job_company
  FROM resumes r
  LEFT JOIN auth_users u ON u.id = r.user_id
  LEFT JOIN auth_users ou ON ou.id = r.user_id
  LEFT JOIN job_posts jp ON jp.id = r.job_post_id AND jp.tenant_id = r.tenant_id
`

export async function fetchCandidateById(
  tenantId: string,
  candidateId: string,
): Promise<CandidateRow | null> {
  const { rows } = await pool.query(
    `${CANDIDATE_SELECT}
     WHERE r.id = $1 AND r.tenant_id = $2
     LIMIT 1`,
    [candidateId, tenantId],
  )
  if (!rows[0]) return null
  return normalizeCandidateRow(rows[0])
}
