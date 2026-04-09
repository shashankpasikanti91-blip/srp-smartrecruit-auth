import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const q          = searchParams.get('q') ?? ''
    const stage      = searchParams.get('stage') ?? ''
    const match      = searchParams.get('match') ?? ''
    const jobId      = searchParams.get('job_id') ?? ''
    const limit      = parseInt(searchParams.get('limit') ?? '50')

    // Get user id
    const { data: user } = await supabaseAdmin
      .from('auth_users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Query resumes as candidates (with pipeline info)
    let query = supabaseAdmin
      .from('resumes')
      .select('id, short_id, candidate_name, candidate_email, candidate_phone, ai_score, match_category, pipeline_stage, status, reviewer_notes, ai_summary, ai_skills, job_post_id, created_at, job_posts(id, short_id, title, company)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (q) {
      query = query.or(`candidate_name.ilike.%${q}%,candidate_email.ilike.%${q}%`)
    }
    if (stage) query = query.eq('pipeline_stage', stage)
    if (match)  query = query.eq('match_category', match)
    if (jobId)  query = query.eq('job_post_id', jobId)

    const { data, error } = await query
    if (error) throw error

    // Pipeline stage counts
    const { data: stageCounts } = await supabaseAdmin
      .from('resumes')
      .select('pipeline_stage')
      .eq('user_id', user.id)

    const counts: Record<string, number> = {}
    for (const row of (stageCounts ?? [])) {
      counts[row.pipeline_stage] = (counts[row.pipeline_stage] ?? 0) + 1
    }

    return NextResponse.json({ candidates: data ?? [], stageCounts: counts })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { candidate_name, candidate_email, candidate_phone, ai_skills, ai_score, ai_summary, job_post_id, pipeline_stage } = body
    if (!candidate_name) {
      return NextResponse.json({ error: 'candidate_name required' }, { status: 400 })
    }

    const { data: user } = await supabaseAdmin
      .from('auth_users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('resumes')
      .insert({
        user_id: user.id,
        candidate_name,
        candidate_email,
        candidate_phone,
        ai_skills: ai_skills ?? [],
        ai_score: ai_score ?? null,
        ai_summary: ai_summary ?? null,
        job_post_id: job_post_id ?? null,
        pipeline_stage: pipeline_stage ?? 'sourced',
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ candidate: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
