import { test, expect } from '@playwright/test'

/**
 * Production security headers + public surface hardening checks.
 */
test.describe('Security headers & public safety', () => {
  test('health endpoint is public and does not leak secrets', async ({ request }) => {
    test.setTimeout(90_000)
    const res = await request.get('/api/health', { timeout: 60_000 })
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json.ok).toBeTruthy()
    expect(json.database?.ok ?? json.db?.ok).toBeTruthy()
    const raw = JSON.stringify(json)
    expect(raw).not.toMatch(/password|POSTGRES|BEGIN PRIVATE|sk-[a-z0-9]{20,}/i)
    // keyPrefix may exist on older builds; full keys must never appear
    expect(raw).not.toMatch(/sk-or-v1-[A-Za-z0-9]{20,}/)
  })

  test('login page has secure response headers', async ({ request }) => {
    const res = await request.get('/login')
    expect(res.ok()).toBeTruthy()
    const headers = res.headers()
    // CSP / frame / content-type protections (set via next.config and/or nginx)
    const csp = headers['content-security-policy'] || headers['content-security-policy-report-only']
    const xfo = headers['x-frame-options']
    const xcto = headers['x-content-type-options']
    expect(Boolean(csp) || Boolean(xfo), 'expected CSP or X-Frame-Options').toBeTruthy()
    if (xcto) expect(xcto.toLowerCase()).toContain('nosniff')
  })

  test('sensitive API mutations reject guests', async ({ request }) => {
    const posts: Array<{ path: string; body: Record<string, unknown> }> = [
      { path: '/api/candidates', body: { full_name: 'E2E Probe' } },
      { path: '/api/jobs', body: { title: 'E2E Probe' } },
      { path: '/api/jobs/generate-posts', body: { title: 'E2E Probe' } },
      { path: '/api/screen', body: { resume_text: 'x', jd_text: 'y' } },
      { path: '/api/boolean-search', body: { job_title: 'E2E Probe' } },
      { path: '/api/compose', body: { email_type: 'followup' } },
      { path: '/api/jd', body: { action: 'generate', job_title: 'E2E Probe' } },
      { path: '/api/rag/query', body: { q: 'test' } },
      { path: '/api/coach', body: { messages: [{ role: 'user', content: 'hi' }] } },
      { path: '/api/notes', body: { entityType: 'candidate', entityId: '00000000-0000-0000-0000-000000000001', body: 'x' } },
      { path: '/api/ownership', body: { action: 'assign', entityType: 'candidate', entityId: '00000000-0000-0000-0000-000000000001' } },
      { path: '/api/comm', body: { action: 'send', to: 'probe@example.com', subject: 'x', body: '<script>alert(1)</script>' } },
    ]
    for (const p of posts) {
      const res = await request.post(p.path, { data: p.body })
      expect([401, 403, 405], `${p.path} must not allow guest write`).toContain(res.status())
    }
  })

  test('forgot-password does not enumerate accounts', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: 'definitely-not-a-user-xyz@example.com' },
    })
    // Anti-enumeration: 200 success OR 503 if SMTP down — never 404 user-not-found
    expect([200, 503]).toContain(res.status())
    if (res.status() === 200) {
      const json = await res.json()
      expect(JSON.stringify(json).toLowerCase()).not.toContain('not found')
    }
  })
})
