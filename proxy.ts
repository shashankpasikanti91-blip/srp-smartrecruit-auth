import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { isPlatformOwnerEmail } from '@/lib/platformAccess'

export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname.startsWith('/owner')) {
      const email = typeof req.nextauth.token?.email === 'string' ? req.nextauth.token.email : null
      if (!isPlatformOwnerEmail(email)) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  // Protect dashboard and owner admin panel
  matcher: ['/dashboard/:path*', '/owner/:path*'],
}
