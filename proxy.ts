import { withAuth } from 'next-auth/middleware'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'
import {
  logRequest,
  parseUserAgent,
  resolveRequestId,
} from '@/lib/requestLog'

type AuthedRequest = NextRequest & {
  nextauth: { token: { email?: string | null } | null }
}

function shouldSkipLog(pathname: string): boolean {
  if (pathname === '/api/health') return true
  if (pathname.startsWith('/api/auth')) return true
  return false
}

function finish(req: AuthedRequest, response: NextResponse): NextResponse {
  const started = Date.now()
  const requestId = resolveRequestId(req.headers.get('x-request-id'))
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-request-id', requestId)

  const isRedirect = response.status >= 300 && response.status < 400
  const out = isRedirect
    ? response
    : NextResponse.next({ request: { headers: requestHeaders } })
  out.headers.set('x-request-id', requestId)

  const pathname = req.nextUrl.pathname
  if (!shouldSkipLog(pathname)) {
    const ua = req.headers.get('user-agent')
    const { browser, device } = parseUserAgent(ua)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null
    const email =
      typeof req.nextauth?.token?.email === 'string' ? req.nextauth.token.email : null

    logRequest({
      level: 'INFO',
      requestId,
      method: req.method,
      path: pathname + (req.nextUrl.search || ''),
      status: out.status,
      durationMs: Date.now() - started,
      ip,
      browser,
      device,
      userId: email,
      module: pathname.startsWith('/api/') ? 'api' : 'web',
      action: req.method,
      env: process.env.NODE_ENV,
    })
  }

  return out
}

export default withAuth(
  function proxy(req) {
    const authed = req as AuthedRequest
    if (authed.nextUrl.pathname.startsWith('/owner')) {
      const email =
        typeof authed.nextauth.token?.email === 'string' ? authed.nextauth.token.email : null
      if (!isPlatformOwnerEmail(email)) {
        return finish(authed, NextResponse.redirect(new URL('/dashboard', authed.url)))
      }
    }
    return finish(authed, NextResponse.next())
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        // APIs enforce their own auth (requireTenant / requireOwner).
        if (path.startsWith('/api/')) return true
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/owner/:path*', '/api/:path*'],
}
