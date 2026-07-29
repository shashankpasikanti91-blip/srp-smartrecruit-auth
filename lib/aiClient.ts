/**
 * Shared OpenAI / OpenRouter client config for all AI routes.
 * Auto-detects OpenRouter when key starts with sk-or- or OPENAI_BASE_URL points to openrouter.
 */

export type AIConfig = {
  apiKey: string
  baseUrl: string
  model: string
  provider: 'openrouter' | 'openai'
}

export function getAIConfig(): AIConfig | null {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || '').trim()
  if (!apiKey) return null

  const explicitBase = (process.env.OPENAI_BASE_URL || '').trim().replace(/\/$/, '')
  const isOpenRouterKey = apiKey.startsWith('sk-or-')
  const isOpenRouter = explicitBase.includes('openrouter.ai') || isOpenRouterKey || Boolean(process.env.OPENROUTER_API_KEY)

  const baseUrl = explicitBase || (isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')
  const provider: AIConfig['provider'] = baseUrl.includes('openrouter.ai') ? 'openrouter' : 'openai'

  let model = (process.env.OPENAI_MODEL || '').trim()
  if (!model) {
    model = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'
  } else if (provider === 'openrouter' && !model.includes('/')) {
    // OpenRouter requires provider/model format for most models
    model = `openai/${model}`
  }

  return { apiKey, baseUrl, model, provider }
}

export type ChatCompletionOptions = {
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' }
  signal?: AbortSignal
}

export type ChatCompletionResult = {
  content: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  duration_ms: number
}

/** Rough USD estimate for gpt-4o-mini / OpenRouter mini-class models. */
export function estimateTokenCostUsd(promptTokens: number, completionTokens: number): number {
  const input = (promptTokens / 1_000_000) * 0.15
  const output = (completionTokens / 1_000_000) * 0.6
  return Math.round((input + output) * 1_000_000) / 1_000_000
}

export async function chatCompletionWithUsage(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const cfg = getAIConfig()
  if (!cfg) throw new Error('AI not configured — set OPENAI_API_KEY in .env')

  const started = Date.now()
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'HTTP-Referer': 'https://recruit.srpailabs.com',
      'X-Title': 'SRP SmartRecruit',
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.35,
      max_tokens: opts.max_tokens ?? 2048,
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const errText = await res.text()
    let message = errText
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } }
      message = parsed.error?.message || errText
    } catch { /* use raw */ }
    throw new Error(`AI API ${res.status}: ${message}`)
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    model?: string
  }
  const prompt_tokens = Number(data.usage?.prompt_tokens ?? 0)
  const completion_tokens = Number(data.usage?.completion_tokens ?? 0)
  const total_tokens = Number(data.usage?.total_tokens ?? prompt_tokens + completion_tokens)

  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: data.model || cfg.model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    duration_ms: Date.now() - started,
  }
}

/** Backward-compatible: returns content string only. */
export async function chatCompletion(opts: ChatCompletionOptions): Promise<string> {
  const result = await chatCompletionWithUsage(opts)
  return result.content
}

/** Safe status for health checks — never exposes the key. */
export function getAIStatus() {
  const cfg = getAIConfig()
  if (!cfg) {
    return { configured: false as const }
  }
  return {
    configured: true as const,
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    keyPrefix: cfg.apiKey.slice(0, 8),
  }
}
