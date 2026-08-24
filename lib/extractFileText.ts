/**
 * Extract plain text from resume / JD uploads (PDF, DOCX, DOC, TXT).
 * Shared by /api/parse and /api/candidates/parse-profile — no self-HTTP.
 *
 * - .docx → mammoth
 * - .doc  → word-extractor (legacy OLE Word; mammoth cannot read these)
 * - .pdf  → pdf-parse
 * - .txt  → utf-8
 */

const SUPPORTED = ['.pdf', '.docx', '.doc', '.txt'] as const

function fail(message: string, status: number): never {
  throw Object.assign(new Error(message), { status })
}

async function extractPdfWithPoppler(buffer: Buffer): Promise<string> {
  const fs = await import('fs/promises')
  const os = await import('os')
  const path = await import('path')
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)
  const inPath = path.join(os.tmpdir(), `srp-pdf-${process.pid}-${Date.now()}.pdf`)
  try {
    await fs.writeFile(inPath, buffer)
    const { stdout } = await execFileAsync(
      'pdftotext',
      ['-layout', '-enc', 'UTF-8', '-q', inPath, '-'],
      { timeout: 8_000, maxBuffer: 2 * 1024 * 1024 },
    )
    return (typeof stdout === 'string' ? stdout : Buffer.from(stdout).toString('utf8')).trim()
  } finally {
    await fs.unlink(inPath).catch(() => undefined)
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  let pdfParse: (buf: Buffer, opts?: object) => Promise<{ text: string }>
  try {
    // Prefer inner path (Docker standalone-safe — avoids pdf-parse test PDF crash)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfParse = require('pdf-parse/lib/pdf-parse.js')
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfParse = require('pdf-parse/lib/pdf-parse')
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        pdfParse = require('pdf-parse')
      } catch {
        fail('PDF parser is not available on the server. Export as DOCX or TXT, or paste the text.', 503)
      }
    }
  }

  // Fast path first (pdf-parse). Poppler only if that returns too little text.
  let text = ''
  try {
    const result = await pdfParse(buffer, { max: 8 })
    text = result.text ?? ''
  } catch {
    text = ''
  }
  if (text.trim().length >= 40) return text

  try {
    const poppler = await extractPdfWithPoppler(buffer)
    if (poppler.length >= 10) return poppler
  } catch {
    // pdftotext missing or slow — continue
  }

  if (!text.trim()) {
    try {
      const result = await pdfParse(buffer)
      text = result.text ?? ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PDF parse failed'
      fail(`Could not read this PDF (${msg}). Try exporting as DOCX or TXT.`, 422)
    }
  }
  if (!text.trim() || text.trim().length < 10) {
    fail('PDF appears scanned or encrypted — use a text PDF, DOCX, DOC, or TXT.', 422)
  }
  return text
}

async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
  }
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value ?? ''
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'DOCX parse failed'
    // Mammoth's classic message when a legacy .doc is mislabeled as .docx
    if (/body element|docx file/i.test(msg)) {
      fail(
        'This looks like an older Word .doc file. Rename/save as .doc (or convert to .docx) and upload again.',
        422,
      )
    }
    fail(`Could not read DOCX: ${msg}`, 422)
  }
}

async function extractLegacyDoc(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WordExtractor = require('word-extractor')
    const extractor = new WordExtractor()
    const doc = await extractor.extract(buffer)
    const parts = [
      typeof doc.getBody === 'function' ? doc.getBody() : '',
      typeof doc.getHeaders === 'function' ? doc.getHeaders() : '',
      typeof doc.getFooters === 'function' ? doc.getFooters() : '',
    ]
    return parts.filter(Boolean).join('\n\n')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'DOC parse failed'
    fail(
      `Could not read this .doc file (${msg}). Open it in Word and Save As .docx or PDF, then upload again.`,
      422,
    )
  }
}

export async function extractTextFromUpload(file: File): Promise<{
  text: string
  filename: string
  size: number
}> {
  const name = file.name.toLowerCase()
  const ext = SUPPORTED.find(e => name.endsWith(e))
  if (!ext) {
    fail(`Unsupported file type. Upload: ${SUPPORTED.join(', ')}`, 400)
  }
  if (file.size > 15 * 1024 * 1024) {
    fail('File too large (max 15 MB)', 413)
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  let text = ''

  if (ext === '.pdf') {
    text = await extractPdf(buffer)
  } else if (ext === '.docx') {
    text = await extractDocx(buffer)
  } else if (ext === '.doc') {
    // Detect mislabeled zip-based docx saved as .doc
    const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b
    text = isZip ? await extractDocx(buffer) : await extractLegacyDoc(buffer)
  } else {
    text = buffer.toString('utf-8')
  }

  // NUL bytes from some PDFs/DOC parsers crash Postgres UTF-8 inserts
  const trimmed = text.replace(/\u0000/g, '').trim().slice(0, 40_000)
  if (trimmed.length < 10) {
    fail('Could not extract readable text from this file', 422)
  }

  return { text: trimmed, filename: file.name, size: file.size }
}
