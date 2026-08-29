/** Plan caps — safe for client + server imports (no DB).
 * Aligned with marketing PRICING (App 1.4.x):
 *   free  → Starter
 *   pro   → Professional / Agency (Agency = sales packaging on pro+)
 *   enterprise → Enterprise
 */
export const PLAN_LIMITS = {
  free: {
    job_posts: 5,
    ai_screens_per_month: 50,
    seats: 1,
    label: 'Starter',
    listPriceInr: 0,
    listPriceUsd: 0,
  },
  pro: {
    job_posts: Infinity,
    ai_screens_per_month: 1000,
    seats: 5,
    label: 'Professional',
    listPriceInr: 9999,
    listPriceUsd: 119,
  },
  enterprise: {
    job_posts: Infinity,
    ai_screens_per_month: Infinity,
    seats: Infinity,
    label: 'Enterprise',
    listPriceInr: null as number | null,
    listPriceUsd: null as number | null,
  },
} as const

/** Agency marketing tier — same runtime plan as pro with higher commercial packaging. */
export const AGENCY_PACKAGING = {
  label: 'Agency',
  listPriceInr: 24999,
  listPriceUsd: 299,
  seats: 15,
  ai_screens_per_month: Infinity,
} as const

export type PlanKey = keyof typeof PLAN_LIMITS

export function formatPlanLimitLabel(plan: PlanKey): string {
  const p = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  if (plan === 'free') {
    return `${p.ai_screens_per_month} AI screens/mo, ${p.job_posts} active jobs`
  }
  if (plan === 'pro') {
    return `${p.ai_screens_per_month === Infinity ? 'Unlimited' : p.ai_screens_per_month} AI screens/mo, unlimited jobs`
  }
  return 'Unlimited AI screens & jobs'
}
