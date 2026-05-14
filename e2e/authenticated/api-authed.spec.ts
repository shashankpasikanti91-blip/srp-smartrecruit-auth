import { test, expect } from '@playwright/test'

test.describe('Authenticated API (session cookies)', () => {
  test('GET /api/candidates returns JSON list', async ({ request }) => {
    const res = await request.get('/api/candidates?limit=5')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('candidates')
    expect(Array.isArray(body.candidates)).toBe(true)
  })

  test('GET /api/jobs returns JSON list', async ({ request }) => {
    const res = await request.get('/api/jobs')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('jobs')
    expect(Array.isArray(body.jobs)).toBe(true)
  })

  test('GET /api/profile returns user payload', async ({ request }) => {
    const res = await request.get('/api/profile')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('user')
    expect(body.user).toHaveProperty('email')
  })
})
