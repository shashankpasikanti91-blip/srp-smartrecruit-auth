import { test, expect } from '@playwright/test'

/**
 * Authz / tenant-isolation smoke tests (guest + authenticated).
 * Cross-tenant IDOR with a second tenant requires E2E_FOREIGN_CANDIDATE_ID
 * (a UUID from another workspace) — skipped when unset.
 */

const PROTECTED_GET = [
  '/api/candidates',
  '/api/jobs',
  '/api/clients',
  '/api/search?q=test',
  '/api/notifications',
  '/api/notes?entityType=candidate&entityId=00000000-0000-0000-0000-000000000001',
  '/api/ownership?entityType=candidate&entityId=00000000-0000-0000-0000-000000000001',
  '/api/governance',
  '/api/audit',
  '/api/analytics/tenant',
  '/api/analytics/live',
  '/api/reports',
  '/api/admin?view=stats',
  '/api/rag/status',
  '/api/integrations',
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

  test('integrations catalogue is public but tenant list requires auth', async ({ request }) => {
    const cat = await request.get('/api/integrations?catalogue=true')
    expect(cat.ok()).toBeTruthy()
    const body = await cat.json()
    expect(Array.isArray(body.catalogue)).toBe(true)
  })

  test('POST /api/rag/query returns 401 without session', async ({ request }) => {
    const res = await request.post('/api/rag/query', { data: { query: 'x' } })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/integrations/test returns 401 without session', async ({ request }) => {
    const res = await request.post('/api/integrations/test', {
      data: { type: 'whatsapp', connector_id: 'whatsapp' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/webhooks/whatsapp without verify token is forbidden or not configured', async ({ request }) => {
    const res = await request.get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc')
    expect([403, 503]).toContain(res.status())
  })
})
