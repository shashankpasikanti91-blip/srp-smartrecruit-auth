import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

// Server-side admin client — NEVER exposed to the browser
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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
  const { data, error } = await supabaseAdmin
    .from('auth_users').select('*').eq('email', email).single()
  if (error || !data) return null
  return data as AuthUser
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { data, error } = await supabaseAdmin
    .from('auth_users').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as AuthUser
}

export async function createUser(user: {
  name?: string | null; email: string; image?: string | null
  provider: string; provider_id?: string | null
}): Promise<AuthUser | null> {
  const { data, error } = await supabaseAdmin
    .from('auth_users')
    .insert({ name: user.name ?? null, email: user.email, image: user.image ?? null,
              provider: user.provider, provider_id: user.provider_id ?? null,
              role: 'user', product_access: ['recruit'] })
    .select().single()
  if (error) { console.error('[db] createUser:', error.message); return null }
  return data as AuthUser
}

export async function upsertUser(user: {
  name?: string | null; email: string; image?: string | null
  provider: string; provider_id?: string | null
}): Promise<{ user: AuthUser | null; isNew: boolean }> {
  const existing = await getUserByEmail(user.email)
  if (existing) {
    await supabaseAdmin.from('auth_users')
      .update({ name: user.name, image: user.image }).eq('id', existing.id)
    return { user: existing, isNew: false }
  }
  const created = await createUser(user)
  return { user: created, isNew: true }
}

export async function getAllUsers(limit = 100) {
  const { data } = await supabaseAdmin
    .from('auth_users')
    .select('id, name, email, image, role, product_access, is_active, created_at')
    .order('created_at', { ascending: false }).limit(limit)
  return data ?? []
}

// ─────────────────────────── Job Posts ───────────────────────────────────────

export async function createJobPost(job: {
  user_id: string; title: string; company?: string | null; location?: string | null
  type?: string; description?: string | null; requirements?: string | null
  salary_min?: number | null; salary_max?: number | null; currency?: string
  status?: string; ai_generated?: boolean; tags?: string[]
}): Promise<JobPost | null> {
  const { data, error } = await supabaseAdmin
    .from('job_posts')
    .insert({ ...job, applications_count: 0 })
    .select().single()
  if (error) { console.error('[db] createJobPost:', error.message); return null }
  return data as JobPost
}

export async function getJobPosts(userId: string): Promise<JobPost[]> {
  const { data } = await supabaseAdmin
    .from('job_posts').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as JobPost[]
}

export async function getJobPostById(id: string): Promise<JobPost | null> {
  const { data, error } = await supabaseAdmin
    .from('job_posts').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as JobPost
}

export async function getAllJobPosts(limit = 200) {
  const { data } = await supabaseAdmin
    .from('job_posts')
    .select('*, auth_users(name, email)')
    .order('created_at', { ascending: false }).limit(limit)
  return data ?? []
}

// ─────────────────────────── Resumes ─────────────────────────────────────────

export async function createResume(resume: {
  user_id: string; job_post_id?: string | null; candidate_name?: string | null
  candidate_email?: string | null; candidate_phone?: string | null
  file_name?: string | null; file_url?: string | null; file_size_bytes?: number | null
  raw_text?: string | null; ai_score?: number | null; ai_summary?: string | null
  ai_skills?: string[]; status?: string
}): Promise<Resume | null> {
  const { data, error } = await supabaseAdmin
    .from('resumes').insert(resume).select().single()
  if (error) { console.error('[db] createResume:', error.message); return null }
  return data as Resume
}

export async function getResumes(userId: string, jobPostId?: string): Promise<Resume[]> {
  let query = supabaseAdmin.from('resumes').select('*').eq('user_id', userId)
  if (jobPostId) query = query.eq('job_post_id', jobPostId)
  const { data } = await query.order('ai_score', { ascending: false, nullsFirst: false })
  return (data ?? []) as Resume[]
}

export async function getResumeById(id: string): Promise<Resume | null> {
  const { data, error } = await supabaseAdmin
    .from('resumes').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as Resume
}

export async function updateResumeStatus(id: string, status: string, notes?: string): Promise<void> {
  await supabaseAdmin.from('resumes').update({ status, reviewer_notes: notes ?? null }).eq('id', id)
}

export async function getAllResumes(limit = 500) {
  const { data } = await supabaseAdmin
    .from('resumes')
    .select('*, auth_users(name, email), job_posts(title)')
    .order('created_at', { ascending: false }).limit(limit)
  return data ?? []
}

// ─────────────────────────── Subscriptions ───────────────────────────────────

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data } = await supabaseAdmin
    .from('subscriptions').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1).single()
  return (data as Subscription) ?? null
}

export async function getAllSubscriptions() {
  const { data } = await supabaseAdmin
    .from('subscriptions').select('*, auth_users(name, email)')
    .order('created_at', { ascending: false })
  return data ?? []
}

// ─────────────────────────── Token Usage ─────────────────────────────────────

export async function logTokenUsage(entry: {
  user_id: string; model: string; operation: string
  prompt_tokens: number; completion_tokens: number
  cost_usd: number; metadata?: Record<string, unknown>
}): Promise<void> {
  await supabaseAdmin.from('token_usage').insert(entry)
}

export async function getTokenStats() {
  const { data } = await supabaseAdmin
    .from('token_usage')
    .select('user_id, model, operation, prompt_tokens, completion_tokens, cost_usd, created_at')
    .order('created_at', { ascending: false }).limit(1000)
  return data ?? []
}

// ─────────────────────────── Activity Log ────────────────────────────────────

export async function logActivity(entry: {
  user_id?: string | null; event_type: string
  event_data?: Record<string, unknown>
  ip_address?: string | null; user_agent?: string | null
  severity?: 'info' | 'warning' | 'error' | 'critical'
}): Promise<void> {
  await supabaseAdmin.from('activity_log').insert({
    ...entry, severity: entry.severity ?? 'info', notified: false,
  })
}

export async function getActivityLog(limit = 200): Promise<ActivityLog[]> {
  const { data } = await supabaseAdmin
    .from('activity_log')
    .select('*, auth_users(name, email)')
    .order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as ActivityLog[]
}

// ─────────────────────────── Admin Stats ─────────────────────────────────────

export async function getOwnerStats() {
  const [usersRes, jobsRes, resumesRes, subsRes, tokenRes] = await Promise.all([
    supabaseAdmin.from('auth_users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('job_posts').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('resumes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('subscriptions').select('plan'),
    supabaseAdmin.from('token_usage').select('cost_usd'),
  ])
  const totalTokenCost = (tokenRes.data ?? []).reduce(
    (sum: number, r: { cost_usd: number }) => sum + (r.cost_usd ?? 0), 0)
  return {
    totalUsers: usersRes.count ?? 0,
    totalJobs: jobsRes.count ?? 0,
    totalResumes: resumesRes.count ?? 0,
    totalSubs: subsRes.data?.length ?? 0,
    totalTokenCostUsd: totalTokenCost.toFixed(4),
    proUsers: (subsRes.data ?? []).filter((s: { plan: string }) => s.plan === 'pro').length,
  }
}
