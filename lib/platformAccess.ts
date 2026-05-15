/**
 * Platform operator access (owner console + /api/admin).
 *
 * Server: set `OWNER_EMAILS` (comma-separated, case-insensitive).
 * Client (e.g. /owner gate): Next.js only exposes `NEXT_PUBLIC_*` — set
 * `NEXT_PUBLIC_PLATFORM_OWNER_EMAILS` to the same list (or a subset) so the UI can
 * redirect before loading admin APIs.
 *
 * Legacy: `NEXT_PUBLIC_OWNER_EMAIL` is merged in if set.
 *
 * This is separate from workspace `tenant_members.role = owner`, which is per-tenant.
 */

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase()
}

function mergeCsv(set: Set<string>, csv: string) {
  for (const part of csv.split(',')) {
    const e = part.trim()
    if (e) set.add(normalizeEmail(e))
  }
}

/** Set of emails that may use the cross-tenant admin API; client sees public env vars only. */
export function getPlatformOwnerEmailSet(): Set<string> {
  const out = new Set<string>()
  mergeCsv(out, process.env.OWNER_EMAILS ?? '')
  mergeCsv(out, process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAILS ?? '')
  const legacy = process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim()
  if (legacy) out.add(normalizeEmail(legacy))
  return out
}

export function isPlatformOwnerEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return getPlatformOwnerEmailSet().has(normalizeEmail(email))
}
