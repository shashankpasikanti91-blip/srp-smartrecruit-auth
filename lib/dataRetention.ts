/**
 * Subscription data-retention policy (grace after paid period ends).
 *
 * Policy (configurable constants below):
 * - Monthly billing: keep workspace data for 1 calendar month after `current_period_end`.
 * - Yearly billing: keep workspace data for 3 calendar months after `current_period_end`.
 *
 * Automated purge is NOT executed from this module — it only computes dates and copy for UI
 * and for ops scripts. Destructive jobs must skip tenants marked `retention_exempt` or listed
 * in `SRP_PROTECTED_TENANT_IDS`.
 */

export const RETENTION_GRACE_MONTHS_MONTHLY = 1
export const RETENTION_GRACE_MONTHS_YEARLY = 3

export type RetentionPhase = 'none' | 'active' | 'grace' | 'past_grace' | 'exempt' | 'unknown'

export interface RetentionComputationInput {
  plan: string
  status: string
  billing_cycle: string | null | undefined
  current_period_end: string | null | undefined
  /** From `tenants.retention_exempt` or env-protected list */
  tenantRetentionExempt: boolean
}

export interface RetentionInfo {
  phase: RetentionPhase
  /** When the paid period ended (same as current_period_end for display) */
  periodEnd: string | null
  /** First day after which automated purge would be allowed (policy), if applicable */
  purgeEligibleAfter: string | null
  /** Approximate whole days until purgeEligibleAfter from "now"; negative if past */
  daysUntilPurgeEligible: number | null
  /** User-facing sentence for dashboard banner; null when nothing to show */
  banner: string | null
}

function addMonths(isoDate: Date, months: number): Date {
  const d = new Date(isoDate.getTime())
  const day = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + months)
  if (d.getUTCDate() < day) d.setUTCDate(0)
  return d
}

function graceMonthsForBilling(billing: string | null | undefined): number {
  const b = (billing ?? 'monthly').toLowerCase()
  return b === 'yearly' || b === 'annual' ? RETENTION_GRACE_MONTHS_YEARLY : RETENTION_GRACE_MONTHS_MONTHLY
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function computeRetentionInfo(
  input: RetentionComputationInput,
  now: Date = new Date()
): RetentionInfo {
  if (input.tenantRetentionExempt) {
    return {
      phase: 'exempt',
      periodEnd: input.current_period_end ?? null,
      purgeEligibleAfter: null,
      daysUntilPurgeEligible: null,
      banner: null,
    }
  }

  const plan = (input.plan ?? 'free').toLowerCase()
  if (plan === 'free') {
    return { phase: 'none', periodEnd: null, purgeEligibleAfter: null, daysUntilPurgeEligible: null, banner: null }
  }

  const endRaw = input.current_period_end
  if (!endRaw) {
    return { phase: 'unknown', periodEnd: null, purgeEligibleAfter: null, daysUntilPurgeEligible: null, banner: null }
  }

  const periodEnd = new Date(endRaw)
  if (Number.isNaN(periodEnd.getTime())) {
    return { phase: 'unknown', periodEnd: endRaw, purgeEligibleAfter: null, daysUntilPurgeEligible: null, banner: null }
  }

  const graceMonths = graceMonthsForBilling(input.billing_cycle)
  const purgeEligibleAfter = addMonths(periodEnd, graceMonths)

  if (now <= periodEnd) {
    const daysLeft = daysBetween(now, periodEnd)
    return {
      phase: 'active',
      periodEnd: endRaw,
      purgeEligibleAfter: purgeEligibleAfter.toISOString(),
      daysUntilPurgeEligible: daysLeft,
      banner: null,
    }
  }

  if (now > periodEnd && now < purgeEligibleAfter) {
    const daysLeft = daysBetween(now, purgeEligibleAfter)
    return {
      phase: 'grace',
      periodEnd: endRaw,
      purgeEligibleAfter: purgeEligibleAfter.toISOString(),
      daysUntilPurgeEligible: daysLeft,
      banner:
        `Your paid period ended on ${periodEnd.toLocaleDateString()}. ` +
        `Workspace data is kept for ${graceMonths} more month${graceMonths === 1 ? '' : 's'} (until ${purgeEligibleAfter.toLocaleDateString()}). ` +
        `Renew via your team contact to avoid interruption; export important data if you do not renew.`,
    }
  }

  return {
    phase: 'past_grace',
    periodEnd: endRaw,
    purgeEligibleAfter: purgeEligibleAfter.toISOString(),
    daysUntilPurgeEligible: daysBetween(purgeEligibleAfter, now),
    banner:
      `Your renewal grace ended on ${purgeEligibleAfter.toLocaleDateString()}. ` +
      `Contact your team to restore access. Inactive workspaces may be scheduled for cleanup per policy.`,
  }
}

/** Comma-separated tenant UUIDs that must never be purged by automated jobs. */
export function getProtectedTenantIdSet(): Set<string> {
  const out = new Set<string>()
  const raw = process.env.SRP_PROTECTED_TENANT_IDS ?? ''
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase()
    if (id) out.add(id)
  }
  return out
}

export function isEnvProtectedTenant(tenantId: string | null | undefined): boolean {
  if (!tenantId) return false
  return getProtectedTenantIdSet().has(tenantId.toLowerCase())
}
