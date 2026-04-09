import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const allowed = ['pipeline_stage', 'status', 'reviewer_notes', 'ai_score', 'ai_summary']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('resumes')
      .update(updates)
      .eq('id', id)
      .select('id, short_id, pipeline_stage, status, match_category')
      .single()

    if (error) throw error
    return NextResponse.json({ candidate: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
