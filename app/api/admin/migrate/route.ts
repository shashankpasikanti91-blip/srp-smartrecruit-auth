import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runPendingMigrations } from '@/lib/runMigrations'

/** POST /api/admin/migrate — apply pending DB migrations (platform owner or dev). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ownerEmails = (process.env.OWNER_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase())
  if (!ownerEmails.includes(session.user.email.toLowerCase()) && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const applied = await runPendingMigrations()
    return NextResponse.json({ applied, count: applied.length })
  } catch (e) {
    console.error('[admin/migrate]', e)
    return NextResponse.json({ error: 'Migration failed', detail: String(e) }, { status: 500 })
  }
}
