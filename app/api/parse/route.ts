import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const name = file.name.toLowerCase()
    let text = ''

    if (name.endsWith('.pdf')) {
      // pdf-parse v1 — simple Node.js native, no browser deps
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const result = await pdfParse(buffer)
      text = result.text
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (name.endsWith('.txt')) {
      text = buffer.toString('utf-8')
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, DOCX, or TXT.' }, { status: 400 })
    }

    return NextResponse.json({ text: text.trim(), filename: file.name, size: file.size })
  } catch (err) {
    console.error('[api/parse]', err)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }
}
