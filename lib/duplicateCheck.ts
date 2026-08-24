/**
 * Tenant-scoped duplicate candidate detection before create.
 */
import { createHash } from 'crypto'
import { pool } from '@/lib/db'
import { normalizePhoneDigits } from '@/lib/phoneFormat'

export type DuplicateMatch = {
  id: string
  short_id: string
  candidate_name: string
  candidate_email: string | null
  pipeline_stage: string
  status: string
  created_at: string
  client_name: string | null
  owner_name: string | null
  owner_email: string | null
  matched_on: string[]
}

export function normalizePhone(phone: string | null | undefined): string {
  return normalizePhoneDigits(phone)
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function normalizeLinkedIn(url: string | null | undefined): string {
  if (!url) return ''
  return url.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '')
}

export function hashResumeContent(text: string | null | undefined): string {
  const t = (text ?? '').trim()
  if (t.length < 40) return ''
  return createHash('sha256').update(t).digest('hex')
}

export async function findDuplicateCandidates(opts: {
  tenantId: string
  email?: string | null
  phone?: string | null
  passport?: string | null
  linkedin?: string | null
  nric?: string | null
  resumeHash?: string | null
  excludeId?: string | null
}): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>()
  const email = normalizeEmail(opts.email)
  const phone = normalizePhone(opts.phone)
  const passport = (opts.passport ?? '').trim().toUpperCase()
  const linkedin = normalizeLinkedIn(opts.linkedin)
  const nric = (opts.nric ?? '').replace(/[\s\-]/g, '').toUpperCase()
  const hash = opts.resumeHash ?? ''

  async function addRows(
    rows: Record<string, unknown>[],
    matchedOn: string,
  ) {
    for (const row of rows) {
      const id = String(row.id)
      if (opts.excludeId && id === opts.excludeId) continue
      const existing = matches.get(id)
      if (existing) {
        if (!existing.matched_on.includes(matchedOn)) existing.matched_on.push(matchedOn)
        continue
      }
      const profile = typeof row.candidate_profile === 'string'
        ? (() => { try { return JSON.parse(row.candidate_profile) } catch { return {} } })()
        : (row.candidate_profile as Record<string, unknown>) ?? {}
      matches.set(id, {
        id,
        short_id: String(row.short_id ?? id).slice(0, 12),
        candidate_name: String(row.candidate_name ?? ''),
        candidate_email: (row.candidate_email as string) ?? null,
        pipeline_stage: String(row.pipeline_stage ?? ''),
        status: String(row.status ?? ''),
        created_at: new Date(row.created_at as string | Date).toISOString(),
        client_name: (profile.client_name as string) ?? (row.client_name as string) ?? null,
        owner_name: (row.owner_name as string) ?? null,
        owner_email: (row.owner_email as string) ?? null,
        matched_on: [matchedOn],
      })
    }
  }

  const baseSelect = `
    SELECT r.id, r.short_id, r.candidate_name, r.candidate_email, r.pipeline_stage,
           r.status, r.created_at, r.candidate_profile,
           jp.company AS client_name,
           u.name AS owner_name, u.email AS owner_email
    FROM resumes r
    LEFT JOIN job_posts jp ON jp.id = r.job_post_id
    LEFT JOIN auth_users u ON u.id = r.user_id
    WHERE r.tenant_id = $1
  `

  if (email) {
    const { rows } = await pool.query(`${baseSelect} AND LOWER(r.candidate_email) = $2 LIMIT 5`, [opts.tenantId, email])
    await addRows(rows, 'email')
  }

  if (phone.length >= 8) {
    const { rows } = await pool.query(
      `${baseSelect} AND RIGHT(regexp_replace(COALESCE(r.candidate_phone,''), '\\D', '', 'g'), 10) = $2 LIMIT 5`,
      [opts.tenantId, phone.slice(-10)],
    )
    await addRows(rows, 'phone')
  }

  if (passport) {
    const { rows } = await pool.query(
      `${baseSelect} AND UPPER(TRIM(r.candidate_profile->>'passport_number')) = $2 LIMIT 5`,
      [opts.tenantId, passport],
    )
    await addRows(rows, 'passport')
  }

  if (nric.length >= 8) {
    const { rows } = await pool.query(
      `${baseSelect} AND regexp_replace(UPPER(COALESCE(r.candidate_profile->>'nric','')), '[\\s\\-]', '', 'g') = $2 LIMIT 5`,
      [opts.tenantId, nric],
    )
    await addRows(rows, 'nric')
  }

  if (linkedin) {
    const { rows } = await pool.query(
      `${baseSelect} AND LOWER(TRIM(BOTH '/' FROM r.candidate_profile->>'linkedin_url')) LIKE $2 LIMIT 5`,
      [opts.tenantId, `%${linkedin.replace(/^https?:\/\/(www\.)?/, '')}%`],
    )
    await addRows(rows, 'linkedin')
  }

  if (hash) {
    try {
      const { rows } = await pool.query(
        `${baseSelect} AND r.resume_content_hash = $2 LIMIT 5`,
        [opts.tenantId, hash],
      )
      await addRows(rows, 'resume_hash')
    } catch {
      /* column may not exist yet */
    }
  }

  return Array.from(matches.values())
}
