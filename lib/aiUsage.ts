/**
 * Shared AI usage logging — wraps token_usage inserts with tenant_id + metadata.
 */
import { logTokenUsage } from '@/lib/db'
import { estimateTokenCostUsd, type ChatCompletionResult } from '@/lib/aiClient'

export const AI_PROMPT_VERSION = 'v1.0.2'

export async function recordAiUsage(opts: {
  userId: string
  tenantId?: string | null
  operation: string
  result: ChatCompletionResult
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await logTokenUsage({
      user_id: opts.userId,
      tenant_id: opts.tenantId ?? null,
      model: opts.result.model,
      operation: opts.operation,
      prompt_tokens: opts.result.prompt_tokens,
      completion_tokens: opts.result.completion_tokens,
      cost_usd: estimateTokenCostUsd(opts.result.prompt_tokens, opts.result.completion_tokens),
      metadata: {
        prompt_version: AI_PROMPT_VERSION,
        duration_ms: opts.result.duration_ms,
        total_tokens: opts.result.total_tokens,
        ...(opts.metadata ?? {}),
      },
    })
  } catch (err) {
    console.error('[recordAiUsage]', err)
  }
}
