/**
 * Batch embed helper with AI usage logging.
 */
import { embedTexts, type EmbedResult } from '@/lib/aiClient'
import { recordAiUsage } from '@/lib/aiUsage'

const BATCH = 32

export async function embedChunks(opts: {
  texts: string[]
  userId?: string | null
  tenantId?: string | null
  operation?: string
}): Promise<number[][]> {
  const texts = opts.texts.map(t => t.trim()).filter(Boolean)
  if (!texts.length) return []

  const all: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    const result: EmbedResult = await embedTexts(slice)
    all.push(...result.vectors)

    if (opts.userId) {
      await recordAiUsage({
        userId: opts.userId,
        tenantId: opts.tenantId,
        operation: opts.operation ?? 'rag_embed',
        result: {
          content: '',
          model: result.model,
          prompt_tokens: result.prompt_tokens,
          completion_tokens: 0,
          total_tokens: result.total_tokens,
          duration_ms: result.duration_ms,
        },
        metadata: { batch_size: slice.length, batch_offset: i },
      })
    }
  }
  return all
}

/** Format a JS number[] as pgvector literal: [0.1,0.2,...] */
export function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map(n => (Number.isFinite(n) ? n : 0)).join(',')}]`
}
