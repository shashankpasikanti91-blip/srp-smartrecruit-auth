import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { createResume, getResumes, logActivity } from '@/lib/db'
import { cleanCandidateName } from '@/lib/nameClean'
import {
  formatPhoneInternational,
  sanitizeCandidateEmail,
  splitGluedPhoneFromEmail,
} from '@/lib/phoneFormat'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.read')
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx
  const { searchParams } = new URL(req.url)
  const jobPostId = searchParams.get('job_post_id') ?? undefined
  const resumes = await getResumes(userId, jobPostId, tenantId)
  return NextResponse.json({ resumes })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req, 'candidates.create')
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx
  try {
    const body = await req.json()

    const glued = splitGluedPhoneFromEmail(body.candidate_email)
    const candidate_name =
      cleanCandidateName(body.candidate_name) ||
      (typeof body.candidate_name === 'string' ? body.candidate_name.trim() : '') ||
      null
    const candidate_email =
      sanitizeCandidateEmail(glued.email || body.candidate_email) || null
    const candidate_phone =
      formatPhoneInternational(body.candidate_phone) ||
      glued.phone ||
      (typeof body.candidate_phone === 'string' ? body.candidate_phone.trim().slice(0, 50) : null) ||
      null

    if (!candidate_name && !candidate_email) {
      return NextResponse.json({ error: 'candidate_name or candidate_email required' }, { status: 400 })
    }

    const resume = await createResume({
      tenant_id: tenantId,
      user_id: userId,
      job_post_id: body.job_post_id ?? null,
      candidate_name,
      candidate_email,
      candidate_phone: candidate_phone ? String(candidate_phone).slice(0, 50) : null,
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
        candidate: candidate_name ?? candidate_email,
        job_post_id: body.job_post_id ?? null,
      },
    })

    return NextResponse.json({ resume }, { status: 201 })
  } catch (err) {
    console.error('[api/resumes] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
