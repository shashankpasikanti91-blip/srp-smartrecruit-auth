/**
 * Extract plain text from resume / JD uploads (PDF, DOCX, DOC, TXT).
 * Shared by /api/parse and /api/candidates/parse-profile — no self-HTTP.
 */
export async function extractTextFromUpload(file: File): Promise<{
  text: string
  filename: string
  size: number
}> {
  const SUPPORTED = ['.pdf', '.docx', '.doc', '.txt'] as const
  const name = file.name.toLowerCase()
  const ext = SUPPORTED.find(e => name.endsWith(e))
  if (!ext) {
    throw Object.assign(new Error(`Unsupported file type. Upload: ${SUPPORTED.join(', ')}`), { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) {
    throw Object.assign(new Error('File too large (max 15 MB)'), { status: 413 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  let text = ''

  if (ext === '.pdf') {
    let pdfParse: (buf: Buffer, opts?: object) => Promise<{ text: string }>
    try {
      // Prefer inner path (Docker standalone-safe)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfParse = require('pdf-parse/lib/pdf-parse')
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfParse = require('pdf-parse')
    }
    // First 8 pages only — enough for contact/skills; full-PDF parse was too slow
    const result = await pdfParse(buffer, { max: 8 })
    text = result.text
    if (!text || text.trim().length < 10) {
      throw Object.assign(
        new Error('PDF appears scanned or encrypted — use a text PDF, DOCX, or TXT.'),
        { status: 422 },
      )
    }
  } else if (ext === '.docx' || ext === '.doc') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
    }
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  } else {
    text = buffer.toString('utf-8')
  }

  // Cap size for hybrid/AI parsers (contact + skills live in the first pages)
  const trimmed = text.trim().slice(0, 40_000)
  if (trimmed.length < 10) {
    throw Object.assign(new Error('Could not extract readable text from this file'), { status: 422 })
  }

  return { text: trimmed, filename: file.name, size: file.size }
}
