import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'

// Root /api/calendar — redirects client to the correct sub-routes.
// Having this handler ensures unauthenticated requests get 401, not 404.
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  return NextResponse.json({
    message: 'Use /api/calendar/connections for OAuth calendar integration',
    endpoints: {
      connections: '/api/calendar/connections',
    },
  })
}
