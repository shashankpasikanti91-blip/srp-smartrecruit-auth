/**
 * Platform feature flags (Super Admin /owner).
 * Fail-open when migrate_v32 table is missing so deploys without the migration still work.
 */
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'

const cache = new Map<string, { value: boolean; at: number }>()
const TTL_MS = 15_000

export async function isFeatureEnabled(
  key: string,
  defaultEnabled = true,
): Promise<boolean> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  try {
    const { rows } = await pool.query<{ enabled: boolean }>(
      `SELECT enabled FROM platform_feature_flags WHERE key = $1 LIMIT 1`,
      [key],
    )
    if (!rows[0]) {
      cache.set(key, { value: defaultEnabled, at: Date.now() })
      return defaultEnabled
    }
    const value = Boolean(rows[0].enabled)
    cache.set(key, { value, at: Date.now() })
    return value
  } catch {
    return defaultEnabled
  }
}

/** 503 when flag is off (product kill-switch). */
export async function assertFeatureEnabled(
  key: string,
  defaultEnabled = true,
): Promise<NextResponse | null> {
  const ok = await isFeatureEnabled(key, defaultEnabled)
  if (ok) return null
  return NextResponse.json(
    { error: `Feature disabled by platform: ${key}` },
    { status: 503 },
  )
}

/**
 * Block non-platform mutating traffic when maintenance_mode is on.
 * Platform owners (OWNER_EMAILS) may still write.
 */
export async function assertNotMaintenance(
  userEmail?: string | null,
): Promise<NextResponse | null> {
  const maintenance = await isFeatureEnabled('maintenance_mode', false)
  if (!maintenance) return null
  if (isPlatformOwnerEmail(userEmail)) return null
  return NextResponse.json(
    {
      error: 'Platform is in maintenance mode. Please try again shortly.',
      maintenance: true,
    },
    { status: 503 },
  )
}

export function clearFeatureFlagCache() {
  cache.clear()
}
