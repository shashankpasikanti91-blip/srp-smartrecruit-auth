/** Plan caps — safe for client + server imports (no DB). */
export const PLAN_LIMITS = {
  free: {
    job_posts: 100,
    ai_screens_per_month: 100,
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

export type PlanKey = keyof typeof PLAN_LIMITS
