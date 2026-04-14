import { Pool, QueryResult, QueryResultRow } from 'pg'

// Lazy pool — only throws at runtime (query time), not at module load / build time
let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL')
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 15,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 30000,
    })
    // Log pool errors instead of crashing
    _pool.on('error', (err) => {
      console.error('[db] Pool background error:', err.message)
    })
  }
  return _pool
}

/**
 * Execute a query with automatic retry on connection errors.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 */
export async function queryWithRetry<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  maxRetries = 3
): Promise<QueryResult<T>> {
  const p = getPool()
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await p.query<T>(text, params)
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const isConnectionError =
        lastError.message.includes('timeout') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('connection terminated') ||
        lastError.message.includes('Connection terminated')
      if (!isConnectionError || attempt === maxRetries) throw lastError
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      console.warn(`[db] Connection error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError!
}

// Convenience re-export — now uses retry wrapper for .query()
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    if (prop === 'query') return queryWithRetry
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop]
  },
})


// ─────────────────────────── Types ───────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string | null
  email: string
  image: string | null
  provider: string
  provider_id: string | null
  role: 'user' | 'owner' | 'admin'
  product_access: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface JobPost {
  id: string
  user_id: string
  title: string
  company: string | null
  location: string | null
  type: string
  description: string | null
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string
  status: string
  applications_count: number
  ai_generated: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Resume {
  id: string
  user_id: string
  job_post_id: string | null
  candidate_name: string | null
  candidate_email: string | null
  candidate_phone: string | null
  file_name: string | null
  file_url: string | null
  file_size_bytes: number | null
  raw_text: string | null
  ai_score: number | null
  ai_summary: string | null
  ai_skills: string[]
  status: string
  reviewer_notes: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: string
  status: string
  billing_cycle: string
  amount_cents: number
  currency: string
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  event_type: string
  event_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  severity: string
  notified: boolean
  created_at: string
}

// ─────────────────────────── Users ───────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const { rows } = await pool.query<AuthUser>(
    'SELECT * FROM auth_users WHERE email = $1', [email]
  )
  return rows[0] ?? null
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { rows } = await pool.query<AuthUser>(
    'SELECT * FROM auth_users WHERE id = $1', [id]
  )
  return rows[0] ?? null
}

export async function createUser(user: {
  name?: string | null; email: string; image?: string | null
  provider: string; provider_id?: string | null
}): Promise<AuthUser | null> {
  try {
    const { rows } = await pool.query<AuthUser>(
      `INSERT INTO auth_users (name, email, image, provider, provider_id, role, product_access)
       VALUES ($1, $2, $3, $4, $5, 'user', ARRAY['recruit']) RETURNING *`,
      [user.name ?? null, user.email, user.image ?? null, user.provider, user.provider_id ?? null]
    )
    return rows[0] ?? null
  } catch (err) {
    console.error('[db] createUser:', err)
    return null
  }
}

export async function upsertUser(user: {
  name?: string | null; email: string; image?: string | null
  provider: string; provider_id?: string | null
}): Promise<{ user: AuthUser | null; isNew: boolean }> {
  const existing = await getUserByEmail(user.email)
  if (existing) {
    await pool.query(
      'UPDATE auth_users SET name = $1, image = $2, updated_at = NOW() WHERE id = $3',
      [user.name ?? existing.name, user.image ?? existing.image, existing.id]
    )
    return { user: existing, isNew: false }
  }
  const created = await createUser(user)
  // Auto-provision free subscription for every new user
  if (created?.id) {
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
       VALUES ($1, 'free', 'active', 'monthly', 0, 'usd')
       ON CONFLICT DO NOTHING`,
      [created.id]
    )
  }
  return { user: created, isNew: true }
}

export async function getAllUsers(limit = 100) {
  const { rows } = await pool.query(
    'SELECT id, name, email, image, role, product_access, is_active, created_at FROM auth_users ORDER BY created_at DESC LIMIT $1',
    [limit]
  )
  return rows
}

// ─────────────────────────── Job Posts ───────────────────────────────────────

export async function createJobPost(job: {
  user_id: string; title: string; company?: string | null; location?: string | null
  type?: string; description?: string | null; requirements?: string | null
  salary_min?: number | null; salary_max?: number | null; currency?: string
  status?: string; ai_generated?: boolean; tags?: string[]
}): Promise<JobPost | null> {
  try {
    const { rows } = await pool.query<JobPost>(
      `INSERT INTO job_posts (user_id, title, company, location, type, description, requirements,
         salary_min, salary_max, currency, status, ai_generated, tags, applications_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0) RETURNING *`,
      [job.user_id, job.title, job.company ?? null, job.location ?? null,
       job.type ?? 'full-time', job.description ?? null, job.requirements ?? null,
       job.salary_min ?? null, job.salary_max ?? null, job.currency ?? 'USD',
       job.status ?? 'active', job.ai_generated ?? false, job.tags ?? []]
    )
    return rows[0] ?? null
  } catch (err) {
    console.error('[db] createJobPost:', err)
    return null
  }
}

export async function getJobPosts(userId: string): Promise<JobPost[]> {
  const { rows } = await pool.query<JobPost>(
    'SELECT * FROM job_posts WHERE user_id = $1 ORDER BY created_at DESC', [userId]
  )
  return rows
}

export async function getJobPostById(id: string): Promise<JobPost | null> {
  const { rows } = await pool.query<JobPost>(
    'SELECT * FROM job_posts WHERE id = $1', [id]
  )
  return rows[0] ?? null
}

export async function getAllJobPosts(limit = 200) {
  const { rows } = await pool.query(
    `SELECT jp.*, json_build_object('name', u.name, 'email', u.email) AS auth_users
     FROM job_posts jp
     LEFT JOIN auth_users u ON u.id = jp.user_id
     ORDER BY jp.created_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}

// ─────────────────────────── Resumes ─────────────────────────────────────────

export async function createResume(resume: {
  user_id: string; job_post_id?: string | null; candidate_name?: string | null
  candidate_email?: string | null; candidate_phone?: string | null
  file_name?: string | null; file_url?: string | null; file_size_bytes?: number | null
  raw_text?: string | null; ai_score?: number | null; ai_summary?: string | null
  ai_skills?: string[]; status?: string
}): Promise<Resume | null> {
  try {
    const { rows } = await pool.query<Resume>(
      `INSERT INTO resumes (user_id, job_post_id, candidate_name, candidate_email, candidate_phone,
         file_name, file_url, file_size_bytes, raw_text, ai_score, ai_summary, ai_skills, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [resume.user_id, resume.job_post_id ?? null, resume.candidate_name ?? null,
       resume.candidate_email ?? null, resume.candidate_phone ?? null,
       resume.file_name ?? null, resume.file_url ?? null, resume.file_size_bytes ?? null,
       resume.raw_text ?? null, resume.ai_score ?? null, resume.ai_summary ?? null,
       resume.ai_skills ?? [], resume.status ?? 'pending']
    )
    return rows[0] ?? null
  } catch (err) {
    console.error('[db] createResume:', err)
    return null
  }
}

export async function getResumes(userId: string, jobPostId?: string): Promise<Resume[]> {
  if (jobPostId) {
    const { rows } = await pool.query<Resume>(
      'SELECT * FROM resumes WHERE user_id = $1 AND job_post_id = $2 ORDER BY ai_score DESC NULLS LAST',
      [userId, jobPostId]
    )
    return rows
  }
  const { rows } = await pool.query<Resume>(
    'SELECT * FROM resumes WHERE user_id = $1 ORDER BY ai_score DESC NULLS LAST', [userId]
  )
  return rows
}

export async function getResumeById(id: string): Promise<Resume | null> {
  const { rows } = await pool.query<Resume>(
    'SELECT * FROM resumes WHERE id = $1', [id]
  )
  return rows[0] ?? null
}

export async function updateResumeStatus(id: string, status: string, notes?: string): Promise<void> {
  await pool.query(
    'UPDATE resumes SET status = $1, reviewer_notes = $2, updated_at = NOW() WHERE id = $3',
    [status, notes ?? null, id]
  )
}

export async function getAllResumes(limit = 500) {
  const { rows } = await pool.query(
    `SELECT r.*,
       json_build_object('name', u.name, 'email', u.email) AS auth_users,
       json_build_object('title', jp.title) AS job_posts
     FROM resumes r
     LEFT JOIN auth_users u ON u.id = r.user_id
     LEFT JOIN job_posts jp ON jp.id = r.job_post_id
     ORDER BY r.created_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}
// ─────────────────────────── Subscriptions ───────────────────────────────────

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { rows } = await pool.query<Subscription>(
    'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  )
  return rows[0] ?? null
}

export async function getAllSubscriptions() {
  const { rows } = await pool.query(
    `SELECT s.*, json_build_object('name', u.name, 'email', u.email) AS auth_users
     FROM subscriptions s
     LEFT JOIN auth_users u ON u.id = s.user_id
     ORDER BY s.created_at DESC`
  )
  return rows
}

// ─────────────────────────── Token Usage ─────────────────────────────────────

export async function logTokenUsage(entry: {
  user_id: string; model: string; operation: string
  prompt_tokens: number; completion_tokens: number
  cost_usd: number; metadata?: Record<string, unknown>
}): Promise<void> {
  await pool.query(
    `INSERT INTO token_usage (user_id, model, operation, prompt_tokens, completion_tokens, cost_usd, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entry.user_id, entry.model, entry.operation, entry.prompt_tokens,
     entry.completion_tokens, entry.cost_usd, entry.metadata ?? null]
  )
}

export async function getTokenStats() {
  const { rows } = await pool.query(
    `SELECT user_id, model, operation, prompt_tokens, completion_tokens, cost_usd, created_at
     FROM token_usage ORDER BY created_at DESC LIMIT 1000`
  )
  return rows
}

// ─────────────────────────── Activity Log ────────────────────────────────────

export async function logActivity(entry: {
  user_id?: string | null; event_type: string
  event_data?: Record<string, unknown>
  ip_address?: string | null; user_agent?: string | null
  severity?: 'info' | 'warning' | 'error' | 'critical'
}): Promise<void> {
  await pool.query(
    `INSERT INTO activity_log (user_id, event_type, event_data, ip_address, user_agent, severity, notified)
     VALUES ($1,$2,$3,$4,$5,$6,false)`,
    [entry.user_id ?? null, entry.event_type, entry.event_data ?? null,
     entry.ip_address ?? null, entry.user_agent ?? null, entry.severity ?? 'info']
  )
}

export async function getActivityLog(limit = 200): Promise<ActivityLog[]> {
  const { rows } = await pool.query(
    `SELECT al.*, json_build_object('name', u.name, 'email', u.email) AS auth_users
     FROM activity_log al
     LEFT JOIN auth_users u ON u.id = al.user_id
     ORDER BY al.created_at DESC LIMIT $1`,
    [limit]
  )
  return rows as ActivityLog[]
}

// ─────────────────────────── Admin Stats ─────────────────────────────────────

export async function getOwnerStats() {
  const [usersRes, jobsRes, resumesRes, subsRes, tokenRes] = await Promise.all([
    pool.query<{ count: string }>('SELECT COUNT(*) FROM auth_users'),
    pool.query<{ count: string }>('SELECT COUNT(*) FROM job_posts'),
    pool.query<{ count: string }>('SELECT COUNT(*) FROM resumes'),
    pool.query<{ plan: string }>('SELECT plan FROM subscriptions'),
    pool.query<{ cost_usd: number }>('SELECT cost_usd FROM token_usage'),
  ])
  const totalTokenCost = tokenRes.rows.reduce(
    (sum, r) => sum + (Number(r.cost_usd) ?? 0), 0)
  return {
    totalUsers: parseInt(usersRes.rows[0]?.count ?? '0'),
    totalJobs: parseInt(jobsRes.rows[0]?.count ?? '0'),
    totalResumes: parseInt(resumesRes.rows[0]?.count ?? '0'),
    totalSubs: subsRes.rows.length,
    totalTokenCostUsd: totalTokenCost.toFixed(4),
    proUsers: subsRes.rows.filter(s => s.plan === 'pro').length,
  }
}

// ─────────────────────────── Job Post Contents ───────────────────────────────

export interface JobPostContents {
  id: string
  job_post_id: string
  user_id: string
  linkedin: string | null
  whatsapp: string | null
  email: string | null
  twitter: string | null
  indeed: string | null
  telegram: string | null
  facebook: string | null
  created_at: string
  updated_at: string
}

export async function upsertJobPostContents(entry: {
  job_post_id: string
  user_id: string
  posts: Record<string, string>
}): Promise<void> {
  await pool.query(
    `INSERT INTO job_post_contents (job_post_id, user_id, linkedin, whatsapp, email, twitter, indeed, telegram, facebook)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (job_post_id) DO UPDATE SET
       linkedin = EXCLUDED.linkedin,
       whatsapp = EXCLUDED.whatsapp,
       email    = EXCLUDED.email,
       twitter  = EXCLUDED.twitter,
       indeed   = EXCLUDED.indeed,
       telegram = EXCLUDED.telegram,
       facebook = EXCLUDED.facebook,
       updated_at = NOW()`,
    [
      entry.job_post_id,
      entry.user_id,
      entry.posts.linkedin ?? null,
      entry.posts.whatsapp ?? null,
      entry.posts.email ?? null,
      entry.posts.twitter ?? null,
      entry.posts.indeed ?? null,
      entry.posts.telegram ?? null,
      entry.posts.facebook ?? null,
    ]
  )
}

export async function getJobPostContents(jobPostId: string): Promise<JobPostContents | null> {
  const { rows } = await pool.query<JobPostContents>(
    'SELECT * FROM job_post_contents WHERE job_post_id = $1', [jobPostId]
  )
  return rows[0] ?? null
}
