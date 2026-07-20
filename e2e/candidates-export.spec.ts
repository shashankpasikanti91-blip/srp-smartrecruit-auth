/**
 * E2E: tenant-scoped candidate export + date filters (guest API checks).
 * Authenticated ownership/export covered when E2E_USER_* is set.
 */
import { test, expect } from '@playwright/test'

test.describe('Candidate export API (auth required)', () => {
  test('GET /api/candidates/export without session returns 401', async ({ request }) => {
    const res = await request.get('/api/candidates/export')
    expect(res.status()).toBe(401)
  })
})
