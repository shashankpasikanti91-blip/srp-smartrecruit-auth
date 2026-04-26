import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { updateResumeStatus } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(req, 'candidates.update')
  if (ctx instanceof NextResponse) return ctx
  try {
    const { id } = await params
    const { status, reviewer_notes } = await req.json()
    if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })
    await updateResumeStatus(id, status, reviewer_notes)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
