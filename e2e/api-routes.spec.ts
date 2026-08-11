import { test, expect } from '@playwright/test'

test.describe('Public API routes', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toMatchObject({ ok: true })
    expect(typeof body.ts).toBe('number')
  })

  test('GET /api/auth/csrf returns csrfToken', async ({ request }) => {
    const res = await request.get('/api/auth/csrf')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('csrfToken')
    expect(String(body.csrfToken).length).toBeGreaterThan(8)
  })

  test('GET /api/auth/providers returns JSON', async ({ request }) => {
    const res = await request.get('/api/auth/providers')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(typeof body).toBe('object')
    expect(Object.keys(body).length).toBeGreaterThan(0)
  })

  test('GET /api/candidates without session returns 401', async ({ request }) => {
    const res = await request.get('/api/candidates')
    expect(res.status()).toBe(401)
    const body = await res.json().catch(() => ({}))
    expect(body).toHaveProperty('error')
  })

  test('GET /api/jobs without session returns 401', async ({ request }) => {
    const res = await request.get('/api/jobs')
    expect(res.status()).toBe(401)
  })

  test('GET /api/profile without session returns 401', async ({ request }) => {
    const res = await request.get('/api/profile')
    expect(res.status()).toBe(401)
  })

  test('GET /api/parse returns JSON (never HTML)', async ({ request }) => {
    const res = await request.get('/api/parse')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type'] || ''
    expect(ct).toMatch(/json/i)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true })
  })

  test('POST /api/parse without session returns JSON 401 (never HTML)', async ({ request }) => {
    const res = await request.post('/api/parse', { multipart: { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hello resume text here') } } })
    expect([401, 403]).toContain(res.status())
    const ct = res.headers()['content-type'] || ''
    expect(ct).toMatch(/json/i)
    const text = await res.text()
    expect(text.trimStart().startsWith('<')).toBeFalsy()
    const body = JSON.parse(text) as { error?: string }
    expect(body).toHaveProperty('error')
  })
})
