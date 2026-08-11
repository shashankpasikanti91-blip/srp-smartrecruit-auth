/**
 * Browser helper: extract text from an uploaded resume/JD file.
 * TXT is read locally (never depends on the parser). PDF/DOCX go to /api/parse.
 * Never throws on HTML error pages — returns a recruiter-facing message instead.
 */

export type ParsedUpload = {
  text: string
  filename: string
  name?: string
  email?: string
  phone?: string
}

function looksLikeHtml(body: string, contentType: string): boolean {
  const ct = contentType.toLowerCase()
  if (ct.includes('text/html')) return true
  const start = body.trimStart().slice(0, 32).toLowerCase()
  return start.startsWith('<!doctype') || start.startsWith('<html')
}

export function friendlyHttpError(status: number, html = false): string {
  if (status === 401 || status === 403) {
    return 'Session expired — refresh the page and sign in, then upload again.'
  }
  if (status === 413) return 'File too large (max 15 MB). Try a smaller PDF or export to TXT.'
  if (status === 429) return 'Too many uploads — wait a few seconds and try again.'
  if (status === 422) return 'Could not read text from this file. Export as TXT or paste the contents.'
  if (status >= 500 || html) {
    return 'File parser is busy. Wait 10 seconds and retry, or paste the text into the box.'
  }
  return `Upload failed (HTTP ${status}). Paste the text if this continues.`
}

async function readResponseJson(res: Response): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const contentType = res.headers.get('content-type') || ''
  let body = ''
  try {
    body = await res.text()
  } catch {
    return { data: null, error: friendlyHttpError(res.status) }
  }
  if (!body.trim()) {
    return { data: null, error: friendlyHttpError(res.status || 502) }
  }
  if (looksLikeHtml(body, contentType)) {
    return { data: null, error: friendlyHttpError(res.status || 502, true) }
  }
  try {
    const data = JSON.parse(body) as Record<string, unknown>
    if (!res.ok) {
      const msg = typeof data.error === 'string' ? data.error : friendlyHttpError(res.status)
      return { data, error: msg }
    }
    return { data, error: null }
  } catch {
    return { data: null, error: friendlyHttpError(res.status || 502, true) }
  }
}

function isPlainTextFile(file: File): boolean {
  const n = file.name.toLowerCase()
  return n.endsWith('.txt') || n.endsWith('.md') || file.type === 'text/plain'
}

async function extractPlainText(file: File): Promise<string> {
  const text = await file.text()
  return text.trim()
}

/** Parse a resume/JD File into text. TXT never hits the server. */
export async function parseUploadedFile(file: File): Promise<ParsedUpload> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('File too large (max 15 MB)')
  }

  if (isPlainTextFile(file)) {
    const text = await extractPlainText(file)
    if (text.length < 10) throw new Error('This text file is empty')
    return { text: text.slice(0, 40_000), filename: file.name }
  }

  const postOnce = async (): Promise<Response> => {
    const fd = new FormData()
    fd.append('file', file)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 45_000)
    try {
      return await fetch('/api/parse', { method: 'POST', body: fd, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  let res: Response
  try {
    res = await postOnce()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('File parser timed out. Try a smaller PDF, or paste the text.')
    }
    throw new Error('Could not reach the file parser. Check your connection, or paste the text.')
  }

  let { data, error } = await readResponseJson(res)
  if (error && res.status >= 500) {
    await new Promise(r => setTimeout(r, 1200))
    try {
      res = await postOnce()
      ;({ data, error } = await readResponseJson(res))
    } catch {
      /* keep first error */
    }
  }
  if (error) throw new Error(error)
  const text = typeof data?.text === 'string' ? data.text.trim() : ''
  if (!text) throw new Error('Parser returned no text. Paste the contents instead.')
  return {
    text: text.slice(0, 40_000),
    filename: file.name,
    name: typeof data?.name === 'string' ? data.name : undefined,
    email: typeof data?.email === 'string' ? data.email : undefined,
    phone: typeof data?.phone === 'string' ? data.phone : undefined,
  }
}
