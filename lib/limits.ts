import { pool } from './db'
import { getUserSubscription } from './db'

export const PLAN_LIMITS = {
  free: {
    job_posts: 5,
    ai_screens_per_month: 20,
    label: 'Free',
  },
  pro: {
    job_posts: Infinity,
    ai_screens_per_month: Infinity,
    label: 'Pro',
  },
  enterprise: {
    job_posts: Infinity,
    ai_screens_per_month: Infinity,
    label: 'Enterprise',
  },
} as const

type PlanKey = keyof typeof PLAN_LIMITS

export async function checkJobPostLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getUserSubscription(userId)
  const plan = (sub?.plan ?? 'free') as PlanKey
  const limit = PLAN_LIMITS[plan]?.job_posts ?? PLAN_LIMITS.free.job_posts

  if (limit === Infinity) return { allowed: true }

  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM job_posts WHERE user_id = $1 AND status != 'archived'`,
    [userId]
  )
  const current = parseInt(rows[0]?.count ?? '0')
  if (current >= limit) {
    return {
      allowed: false,
      reason: `Free plan allows up to ${limit} active job posts. Upgrade to Pro for unlimited.`,
    }
  }
  return { allowed: true }
}

export async function checkAiScreenLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getUserSubscription(userId)
  const plan = (sub?.plan ?? 'free') as PlanKey
  const limit = PLAN_LIMITS[plan]?.ai_screens_per_month ?? PLAN_LIMITS.free.ai_screens_per_month

  if (limit === Infinity) return { allowed: true }

  // Count AI screens this calendar month
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM token_usage
     WHERE user_id = $1
       AND operation LIKE '%screen%'
       AND created_at >= date_trunc('month', NOW())`,
    [userId]
  )
  const current = parseInt(rows[0]?.count ?? '0')
  if (current >= limit) {
    return {
      allowed: false,
      reason: `Free plan allows ${limit} AI screenings per month. Upgrade to Pro for unlimited.`,
    }
  }
  return { allowed: true }
}
