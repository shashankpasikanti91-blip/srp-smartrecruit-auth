import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maxDuration = 60

// Supported MIME types
const SUPPORTED_EXTS = ['.pdf', '.docx', '.doc', '.txt']

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

  // File size guard (15 MB)
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 })
  }

  const name = file.name.toLowerCase()
  const ext = SUPPORTED_EXTS.find(e => name.endsWith(e))
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported file type. Please upload: ${SUPPORTED_EXTS.join(', ')}` },
      { status: 400 }
    )
  }

  let text = ''
  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (ext === '.pdf') {
      // Try inner lib path first (avoids missing test-file in Docker standalone)
      // Fall back to main entry if inner path unavailable
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      let pdfParse: (buf: Buffer, opts?: object) => Promise<{ text: string }>
      try {
        pdfParse = require('pdf-parse/lib/pdf-parse')
      } catch {
        pdfParse = require('pdf-parse')
      }
      const result = await pdfParse(buffer, { max: 0 })
      text = result.text
      if (!text || text.trim().length < 10) {
        return NextResponse.json(
          { error: 'PDF appears to be scanned or encrypted — please upload a text-based PDF, DOCX, or TXT.' },
          { status: 422 }
        )
      }
    } else if (ext === '.docx' || ext === '.doc') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      text = buffer.toString('utf-8')
    }

    return NextResponse.json({ text: text.trim(), filename: file.name, size: file.size })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/parse] error:', msg)
    // Give a clear, actionable error to the user
    const friendly = msg.includes('password') || msg.includes('encrypt')
      ? 'PDF is password-protected. Please remove the password and try again.'
      : `Could not read "${file.name}" — try saving as PDF/A or DOCX and re-uploading.`
    return NextResponse.json({ error: friendly }, { status: 422 })
  }
}
