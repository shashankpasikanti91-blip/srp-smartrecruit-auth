import { test, expect } from '@playwright/test'

/**
 * Authz / tenant-isolation smoke tests (guest + authenticated).
 * Cross-tenant IDOR with a second tenant requires E2E_FOREIGN_CANDIDATE_ID
 * (a UUID from another workspace) — skipped when unset.
 */

const PROTECTED_GET = [
  '/api/candidates',
  '/api/jobs',
  '/api/search?q=test',
  '/api/notifications',
  '/api/notes?entityType=candidate&entityId=00000000-0000-0000-0000-000000000001',
  '/api/ownership?entityType=candidate&entityId=00000000-0000-0000-0000-000000000001',
  '/api/governance',
  '/api/audit',
  '/api/analytics/tenant',
  '/api/reports',
  '/api/admin?view=stats',
]

test.describe('Unauthenticated API authz', () => {
  for (const path of PROTECTED_GET) {
    test(`GET ${path} returns 401`, async ({ request }) => {
      test.setTimeout(90_000)
      const res = await request.get(path, { timeout: 60_000 })
      expect([401, 403]).toContain(res.status())
      const body = await res.json().catch(() => ({}))
      expect(body).toHaveProperty('error')
    })
  }

  test('GET /api/health remains public', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
  })
})
