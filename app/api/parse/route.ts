import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractResumeFields } from '@/lib/resumeExtract'
import { extractTextFromUpload } from '@/lib/extractFileText'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let file: File | null = null
  try {
    const form = await req.formData()
    file = form.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  try {
    const { text, filename, size } = await extractTextFromUpload(file)
    const extracted = extractResumeFields(text, filename)
    return NextResponse.json({
      text,
      filename,
      size,
      name: extracted.name,
      email: extracted.email,
      phone: extracted.phone,
    })
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number }
    const status = err.status ?? 500
    console.error('[api/parse]', err.message)
    return NextResponse.json(
      { error: err.message || 'Failed to parse file' },
      { status },
    )
  }
}
