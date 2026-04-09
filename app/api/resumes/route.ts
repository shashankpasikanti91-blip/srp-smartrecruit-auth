import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createResume, getResumes, logActivity } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as Record<string, unknown>).userId as string
  const { searchParams } = new URL(req.url)
  const jobPostId = searchParams.get('job_post_id') ?? undefined
  const resumes = await getResumes(userId, jobPostId)
  return NextResponse.json({ resumes })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const userId = (session.user as Record<string, unknown>).userId as string

    if (!body.candidate_name && !body.candidate_email) {
      return NextResponse.json({ error: 'candidate_name or candidate_email required' }, { status: 400 })
    }

    const resume = await createResume({
      user_id: userId,
      job_post_id: body.job_post_id ?? null,
      candidate_name: body.candidate_name ?? null,
      candidate_email: body.candidate_email ?? null,
      candidate_phone: body.candidate_phone ?? null,
      file_name: body.file_name ?? null,
      file_url: body.file_url ?? null,
      file_size_bytes: body.file_size_bytes ?? null,
      raw_text: body.raw_text ?? null,
      ai_score: body.ai_score ?? null,
      ai_summary: body.ai_summary ?? null,
      ai_skills: body.ai_skills ?? [],
      status: body.status ?? 'pending',
    })

    if (!resume) {
      return NextResponse.json({ error: 'Failed to save resume' }, { status: 500 })
    }

    await logActivity({
      user_id: userId,
      event_type: 'resume_uploaded',
      event_data: {
        resume_id: resume.id,
        candidate: body.candidate_name ?? body.candidate_email,
        job_post_id: body.job_post_id ?? null,
      },
    })

    return NextResponse.json({ resume }, { status: 201 })
  } catch (err) {
    console.error('[api/resumes] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
