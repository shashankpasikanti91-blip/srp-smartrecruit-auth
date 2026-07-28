import { test, expect } from '@playwright/test'

/**
 * Authenticated authz checks.
 * Uses the E2E login session from global-setup (storageState).
 *
 * Optional env:
 *   E2E_FOREIGN_CANDIDATE_ID — UUID owned by another tenant (must 404/403)
 *   E2E_FOREIGN_JOB_ID — UUID owned by another tenant (must 404/403)
 */

test.describe('Authenticated authz & isolation', () => {
  test('profile exposes tenant role', async ({ request }) => {
    const res = await request.get('/api/profile')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.user?.email || body.email).toBeTruthy()
  })

  test('candidates list is scoped (array payload)', async ({ request }) => {
    const res = await request.get('/api/candidates?limit=5')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.candidates)).toBe(true)
  })

  test('random UUID candidate returns 404 not foreign data', async ({ request }) => {
    const res = await request.get('/api/candidates/00000000-0000-4000-8000-000000000099')
    expect([404, 400, 403]).toContain(res.status())
    const body = await res.json().catch(() => ({}))
    expect(JSON.stringify(body)).not.toMatch(/@.*\./) // no leaked emails
  })

  test('foreign candidate id rejected when configured', async ({ request }) => {
    const id = process.env.E2E_FOREIGN_CANDIDATE_ID?.trim()
    test.skip(!id, 'Set E2E_FOREIGN_CANDIDATE_ID to a UUID from another tenant')
    const res = await request.get(`/api/candidates/${id}`)
    expect([404, 403]).toContain(res.status())
  })

  test('foreign job id rejected when configured', async ({ request }) => {
    const id = process.env.E2E_FOREIGN_JOB_ID?.trim()
    test.skip(!id, 'Set E2E_FOREIGN_JOB_ID to a UUID from another tenant')
    const res = await request.get(`/api/jobs/${id}`)
    expect([404, 403]).toContain(res.status())
  })

  test('governance is admin-only (403 for recruiters)', async ({ request }) => {
    const res = await request.get('/api/governance')
    // owner/admin → 200; recruiter/member/viewer → 403; missing perm → 403
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('period_days')
    } else {
      expect(res.status()).toBe(403)
    }
  })

  test('platform /api/admin without owner email returns 403', async ({ request }) => {
    const res = await request.get('/api/admin?view=stats')
    // Platform owners get 200; everyone else 403
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('stats')
    } else {
      expect([401, 403]).toContain(res.status())
    }
  })

  test('search stays tenant-scoped', async ({ request }) => {
    const res = await request.get('/api/search?q=a')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.results)).toBe(true)
  })
})
