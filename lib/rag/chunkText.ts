/**
 * Split resume/JD text into overlapping chunks for embedding.
 * Target ~600–800 chars with ~12% overlap; prefer paragraph / heading boundaries.
 */

export type TextChunk = {
  index: number
  content: string
  tokenEst: number
}

const TARGET_CHARS = 700
const OVERLAP_RATIO = 0.12
const MIN_CHARS = 80
const MAX_CHARS = 1200

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4))
}

function splitParagraphs(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  if (!normalized) return []

  // Keep heading-like lines with following body when possible
  const parts = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  if (parts.length > 1) return parts

  // Fallback: single newlines as soft breaks
  return normalized.split(/\n/).map(p => p.trim()).filter(Boolean)
}

/**
 * Chunk long text for RAG indexing.
 */
export function chunkText(raw: string): TextChunk[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  if (text.length <= TARGET_CHARS) {
    return [{ index: 0, content: text.slice(0, MAX_CHARS), tokenEst: estimateTokens(text) }]
  }

  const paras = splitParagraphs(text)
  const blocks: string[] = []
  let buf = ''

  for (const p of paras) {
    if (!buf) {
      buf = p
      continue
    }
    if (buf.length + 2 + p.length <= TARGET_CHARS) {
      buf = `${buf}\n\n${p}`
    } else {
      blocks.push(buf)
      buf = p
    }
  }
  if (buf) blocks.push(buf)

  // Hard-split any oversized block
  const hard: string[] = []
  for (const b of blocks) {
    if (b.length <= MAX_CHARS) {
      hard.push(b)
      continue
    }
    for (let i = 0; i < b.length; i += TARGET_CHARS) {
      hard.push(b.slice(i, i + MAX_CHARS))
    }
  }

  const overlap = Math.floor(TARGET_CHARS * OVERLAP_RATIO)
  const out: TextChunk[] = []
  for (let i = 0; i < hard.length; i++) {
    let content = hard[i]
    if (i > 0 && overlap > 0) {
      const prev = hard[i - 1]
      const tail = prev.slice(Math.max(0, prev.length - overlap))
      content = `${tail}\n${content}`.slice(0, MAX_CHARS)
    }
    content = content.trim()
    if (content.length < MIN_CHARS && i < hard.length - 1) continue
    if (!content) continue
    out.push({
      index: out.length,
      content,
      tokenEst: estimateTokens(content),
    })
  }

  return out.length ? out : [{ index: 0, content: text.slice(0, MAX_CHARS), tokenEst: estimateTokens(text) }]
}
