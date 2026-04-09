import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOwnerStats, getAllUsers, getActivityLog, getAllJobPosts, getAllResumes, getAllSubscriptions, getTokenStats } from '@/lib/db'

// Guard — only owner/admin may call these endpoints
async function requireOwner() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const ownerEmails = (process.env.OWNER_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== 'owner' && role !== 'admin' && !ownerEmails.includes(session.user.email.toLowerCase())) {
    return null
  }
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireOwner()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'stats'

  switch (view) {
    case 'stats': {
      const stats = await getOwnerStats()
      return NextResponse.json({ stats })
    }
    case 'users': {
      const users = await getAllUsers()
      return NextResponse.json({ users })
    }
    case 'activity': {
      const log = await getActivityLog()
      return NextResponse.json({ log })
    }
    case 'jobs': {
      const jobs = await getAllJobPosts()
      return NextResponse.json({ jobs })
    }
    case 'resumes': {
      const resumes = await getAllResumes()
      return NextResponse.json({ resumes })
    }
    case 'subscriptions': {
      const subs = await getAllSubscriptions()
      return NextResponse.json({ subs })
    }
    case 'tokens': {
      const tokens = await getTokenStats()
      return NextResponse.json({ tokens })
    }
    default:
      return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  }
}
