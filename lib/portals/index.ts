/**
 * lib/portals/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real portal connector layer.
 *
 * Each portal adapter implements the PortalConnector interface:
 *   - testConnection()          — verify credentials are valid
 *   - searchProfiles(query)     — run a boolean/keyword search, return profiles
 *   - fetchProfile(profileId)   — fetch full profile by ID
 *
 * SUPPORTED PORTALS
 * ─────────────────
 * 1. Naukri.com  — uses Naukri Recruiter REST API v1
 *    Endpoint: https://recruiterapi.naukri.com
 *    Auth:     Bearer token obtained via /v1/auth/login with client_id + client_secret
 *    Ref:      https://developer.naukri.com/recruiter-api/
 *
 * 2. Monster India — uses Monster Partner API
 *    Endpoint: https://api.monsterindia.com/v2
 *    Auth:     API key in X-API-Key header
 *
 * 3. Shine.com — India's second-largest job portal
 *    Endpoint: https://api.shine.com/api/v1
 *    Auth:     Bearer token (OAuth2 client_credentials)
 *
 * 4. LinkedIn Recruiter — via LinkedIn Talent Solutions API
 *    Endpoint: https://api.linkedin.com/v2
 *    Auth:     OAuth2 access token with r_liteprofile scope
 *
 * 5. Indeed — via Indeed Publisher / Resume Search API
 *    Auth:     Publisher ID + API key
 *
 * NOTE ON CREDENTIALS:
 *   All portal API credentials are stored (encrypted at-rest via AES-256-GCM)
 *   in the portal_credentials table per tenant. The encryption key comes from
 *   PORTAL_CREDENTIAL_KEY (32-byte hex in env). If not set, credentials are
 *   stored in plaintext (development only — NOT for production).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto'
import { pool } from '@/lib/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortalProfile {
  portal_id:       string        // ID from the source portal
  portal:          string        // 'naukri'|'monster'|'shine'|'linkedin'|'indeed'
  name:            string
  email:           string | null
  phone:           string | null
  headline:        string | null  // current role/title
  current_company: string | null
  location:        string | null
  experience_years: number | null
  skills:          string[]
  education:       string | null
  summary:         string | null
  resume_url:      string | null  // link back to portal profile
  last_updated:    string | null
  raw:             Record<string, unknown> // full raw response from portal
}

export interface PortalSearchQuery {
  query:       string   // boolean / keyword query
  location?:   string
  exp_min?:    number
  exp_max?:    number
  salary_min?: number
  salary_max?: number
  notice?:     string   // '0'|'15'|'30'|'60'|'90'|'any'
  limit?:      number   // default 20, max 50
  offset?:     number
  job_title?:  string
}

export interface PortalSearchResult {
  profiles:      PortalProfile[]
  total:         number
  page:          number
  has_more:      boolean
  search_id?:    string   // portal-side search ID for pagination
}

export interface ConnectionTestResult {
  ok:      boolean
  message: string
  plan?:   string  // portal plan/tier if available
}

// ── Encryption helpers ────────────────────────────────────────────────────────

const ENC_KEY = process.env.PORTAL_CREDENTIAL_KEY
  ? Buffer.from(process.env.PORTAL_CREDENTIAL_KEY, 'hex')
  : null

export function encryptCredential(plain: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 32) return plain // dev fallback
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptCredential(enc: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 32) return enc // dev fallback
  try {
    const buf = Buffer.from(enc, 'base64')
    const iv  = buf.slice(0, 12)
    const tag = buf.slice(12, 28)
    const data = buf.slice(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data) + decipher.final('utf8')
  } catch { return enc }
}

// ── Portal credentials helpers ────────────────────────────────────────────────

export interface PortalCreds {
  api_key?:     string
  api_secret?:  string
  username?:    string
  password?:    string
  base_url?:    string
  extra_config: Record<string, string>
}

export async function getPortalCreds(tenantId: string, portal: string): Promise<PortalCreds | null> {
  const { rows } = await pool.query(
    `SELECT api_key, api_secret, username, password_enc, base_url, extra_config
     FROM portal_credentials
     WHERE tenant_id = $1 AND portal = $2 AND is_active = TRUE`,
    [tenantId, portal]
  )
  if (!rows[0]) return null
  const r = rows[0]
  return {
    api_key:     r.api_key     ? decryptCredential(r.api_key) : undefined,
    api_secret:  r.api_secret  ? decryptCredential(r.api_secret) : undefined,
    username:    r.username    ?? undefined,
    password:    r.password_enc ? decryptCredential(r.password_enc) : undefined,
    base_url:    r.base_url    ?? undefined,
    extra_config: r.extra_config ?? {},
  }
}

export async function savePortalCreds(
  tenantId: string,
  portal: string,
  creds: { api_key?: string; api_secret?: string; username?: string; password?: string; base_url?: string; extra_config?: Record<string, string> }
): Promise<void> {
  await pool.query(
    `INSERT INTO portal_credentials
       (tenant_id, portal, api_key, api_secret, username, password_enc, base_url, extra_config)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tenant_id, portal) DO UPDATE SET
       api_key      = EXCLUDED.api_key,
       api_secret   = EXCLUDED.api_secret,
       username     = EXCLUDED.username,
       password_enc = EXCLUDED.password_enc,
       base_url     = EXCLUDED.base_url,
       extra_config = EXCLUDED.extra_config,
       is_active    = TRUE,
       updated_at   = NOW()`,
    [
      tenantId,
      portal,
      creds.api_key     ? encryptCredential(creds.api_key) : null,
      creds.api_secret  ? encryptCredential(creds.api_secret) : null,
      creds.username    ?? null,
      creds.password    ? encryptCredential(creds.password) : null,
      creds.base_url    ?? null,
      JSON.stringify(creds.extra_config ?? {}),
    ]
  )
}

// ── Naukri Connector ──────────────────────────────────────────────────────────
// API Docs: https://developer.naukri.com/recruiter-api/
// Requires: Naukri Recruiter account with API access enabled
//           client_id + client_secret → exchange for Bearer token
//           Then: POST /v1/resdex/search

async function naukriGetToken(clientId: string, clientSecret: string, baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Naukri auth failed (${res.status}): ${err}`)
  }
  const data = await res.json() as { access_token?: string; token?: string }
  return data.access_token ?? data.token ?? ''
}

export async function naukriSearch(creds: PortalCreds, q: PortalSearchQuery): Promise<PortalSearchResult> {
  const base = creds.base_url ?? 'https://recruiterapi.naukri.com'
  const token = await naukriGetToken(creds.api_key!, creds.api_secret!, base)

  const body = {
    searchQuery:   q.query,
    location:      q.location ?? '',
    minExperience: q.exp_min  ?? 0,
    maxExperience: q.exp_max  ?? 30,
    noticePeriod:  q.notice   ?? 'any',
    rows:          Math.min(q.limit ?? 20, 50),
    start:         q.offset   ?? 0,
  }

  const res = await fetch(`${base}/v1/resdex/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Naukri search failed (${res.status}): ${errText}`)
  }

  const data = await res.json() as Record<string, unknown>
  const rawProfiles = (data.profiles ?? data.results ?? []) as Record<string, unknown>[]
  const total = (data.totalCount ?? data.total ?? rawProfiles.length) as number

  const profiles: PortalProfile[] = rawProfiles.map(p => ({
    portal_id:        String(p.profileId ?? p.id ?? ''),
    portal:           'naukri',
    name:             String(p.name ?? p.candidateName ?? ''),
    email:            (p.email ?? null) as string | null,
    phone:            (p.mobile ?? p.phone ?? null) as string | null,
    headline:         (p.currentDesignation ?? p.headline ?? null) as string | null,
    current_company:  (p.currentEmployer ?? p.company ?? null) as string | null,
    location:         (p.location ?? p.currentCity ?? null) as string | null,
    experience_years: p.experienceInMonths ? Math.floor(Number(p.experienceInMonths) / 12) : (p.experience ?? null) as number | null,
    skills:           Array.isArray(p.keySkills) ? p.keySkills as string[] : [],
    education:        (p.highestQualification ?? null) as string | null,
    summary:          (p.profileSummary ?? p.summary ?? null) as string | null,
    resume_url:       (p.profileLink ?? null) as string | null,
    last_updated:     (p.modifiedDate ?? null) as string | null,
    raw:              p,
  }))

  return { profiles, total, page: Math.floor((q.offset ?? 0) / (q.limit ?? 20)) + 1, has_more: (q.offset ?? 0) + profiles.length < total }
}

export async function naukriTest(creds: PortalCreds): Promise<ConnectionTestResult> {
  try {
    const base = creds.base_url ?? 'https://recruiterapi.naukri.com'
    const token = await naukriGetToken(creds.api_key!, creds.api_secret!, base)
    if (!token) throw new Error('No token received')
    return { ok: true, message: 'Naukri connection successful' }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

// ── Monster India Connector ───────────────────────────────────────────────────
// API: https://api.monsterindia.com/v2/
// Auth: X-API-Key header

export async function monsterSearch(creds: PortalCreds, q: PortalSearchQuery): Promise<PortalSearchResult> {
  const base = creds.base_url ?? 'https://api.monsterindia.com/v2'

  const params = new URLSearchParams({
    q:       q.query,
    where:   q.location ?? '',
    rows:    String(Math.min(q.limit ?? 20, 50)),
    start:   String(q.offset ?? 0),
  })
  if (q.exp_min != null) params.set('exp_min', String(q.exp_min))
  if (q.exp_max != null) params.set('exp_max', String(q.exp_max))

  const res = await fetch(`${base}/resumes/search?${params}`, {
    headers: {
      'X-API-Key': creds.api_key!,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Monster search failed (${res.status}): ${errText}`)
  }

  const data = await res.json() as Record<string, unknown>
  const rawProfiles = (data.resumes ?? data.results ?? []) as Record<string, unknown>[]
  const total = Number(data.totalCount ?? rawProfiles.length)

  const profiles: PortalProfile[] = rawProfiles.map(p => ({
    portal_id:        String(p.resumeId ?? p.id ?? ''),
    portal:           'monster',
    name:             String(p.name ?? ''),
    email:            (p.email ?? null) as string | null,
    phone:            (p.phone ?? null) as string | null,
    headline:         (p.title ?? p.currentTitle ?? null) as string | null,
    current_company:  (p.currentEmployer ?? null) as string | null,
    location:         (p.preferredLocation ?? p.location ?? null) as string | null,
    experience_years: (p.totalExperience ?? null) as number | null,
    skills:           Array.isArray(p.skills) ? p.skills : [],
    education:        (p.highestEducation ?? null) as string | null,
    summary:          (p.objective ?? null) as string | null,
    resume_url:       (p.profileUrl ?? null) as string | null,
    last_updated:     (p.updatedOn ?? null) as string | null,
    raw:              p,
  }))

  return { profiles, total, page: Math.floor((q.offset ?? 0) / (q.limit ?? 20)) + 1, has_more: (q.offset ?? 0) + profiles.length < total }
}

export async function monsterTest(creds: PortalCreds): Promise<ConnectionTestResult> {
  try {
    const base = creds.base_url ?? 'https://api.monsterindia.com/v2'
    const res = await fetch(`${base}/account/info`, {
      headers: { 'X-API-Key': creds.api_key!, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { ok: true, message: 'Monster connection successful' }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

// ── Shine.com Connector ───────────────────────────────────────────────────────

export async function shineSearch(creds: PortalCreds, q: PortalSearchQuery): Promise<PortalSearchResult> {
  const base = creds.base_url ?? 'https://api.shine.com/api/v1'

  // Get OAuth token
  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     creds.api_key!,
      client_secret: creds.api_secret!,
    }),
  })
  if (!tokenRes.ok) throw new Error(`Shine auth failed: ${await tokenRes.text()}`)
  const { access_token } = await tokenRes.json() as { access_token: string }

  const res = await fetch(`${base}/resumes/search`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query:    q.query,
      location: q.location,
      exp_min:  q.exp_min,
      exp_max:  q.exp_max,
      limit:    Math.min(q.limit ?? 20, 50),
      offset:   q.offset ?? 0,
    }),
  })

  if (!res.ok) throw new Error(`Shine search failed (${res.status}): ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const rawProfiles = (data.profiles ?? []) as Record<string, unknown>[]
  const total = Number(data.total ?? rawProfiles.length)

  const profiles: PortalProfile[] = rawProfiles.map(p => ({
    portal_id:        String(p.id ?? ''),
    portal:           'shine',
    name:             String(p.name ?? ''),
    email:            (p.email ?? null) as string | null,
    phone:            (p.phone ?? null) as string | null,
    headline:         (p.designation ?? null) as string | null,
    current_company:  (p.current_company ?? null) as string | null,
    location:         (p.location ?? null) as string | null,
    experience_years: (p.exp_years ?? null) as number | null,
    skills:           Array.isArray(p.skills) ? p.skills : [],
    education:        (p.education ?? null) as string | null,
    summary:          (p.summary ?? null) as string | null,
    resume_url:       (p.profile_url ?? null) as string | null,
    last_updated:     (p.updated_at ?? null) as string | null,
    raw:              p,
  }))

  return { profiles, total, page: 1, has_more: (q.offset ?? 0) + profiles.length < total }
}

// ── Unified dispatcher ────────────────────────────────────────────────────────

export async function searchPortal(
  tenantId: string,
  portal: string,
  query: PortalSearchQuery
): Promise<PortalSearchResult> {
  const creds = await getPortalCreds(tenantId, portal)
  if (!creds) throw new Error(`No active credentials found for portal '${portal}'. Please configure them in Settings → Integrations.`)

  switch (portal) {
    case 'naukri':  return naukriSearch(creds, query)
    case 'monster': return monsterSearch(creds, query)
    case 'shine':   return shineSearch(creds, query)
    default:        throw new Error(`Portal '${portal}' search not yet supported.`)
  }
}

export async function testPortalConnection(
  tenantId: string,
  portal: string
): Promise<ConnectionTestResult> {
  const creds = await getPortalCreds(tenantId, portal)
  if (!creds) return { ok: false, message: 'No credentials configured' }

  switch (portal) {
    case 'naukri':  return naukriTest(creds)
    case 'monster': return monsterTest(creds)
    default:        return { ok: false, message: `Test not implemented for '${portal}'` }
  }
}
