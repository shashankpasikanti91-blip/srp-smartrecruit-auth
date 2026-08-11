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

  test('POST /api/parse TXT returns JSON text (single CV path)', async ({ request }) => {
    const res = await request.post('/api/parse', {
      multipart: {
        file: {
          name: 'jane_doe_resume.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(
            'Jane Doe\nSenior Engineer\nEmail: jane.doe@example.com\nPhone: +65 8123 4567\n\nExperience at Acme Corp building APIs.',
          ),
        },
      },
    })
    const ct = res.headers()['content-type'] || ''
    expect(ct).toMatch(/json/i)
    const text = await res.text()
    expect(text.trimStart().startsWith('<')).toBeFalsy()
    expect(res.ok(), text).toBeTruthy()
    const body = JSON.parse(text) as { text?: string; name?: string; email?: string }
    expect((body.text || '').length).toBeGreaterThan(20)
  })
})
