'use client'

import { RefreshCw, Eye } from 'lucide-react'

export type GenerationMeta = {
  status?: string
  generated_at?: string | null
  generated_by?: string | null
  model?: string | null
  tokens?: number | null
  duration_ms?: number | null
  cached?: boolean
}

function fmtWhen(v?: string | null) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return String(v)
  }
}

/** Last Generated / View Result / Generate Again strip — reuse across AI tools. */
export function GenerationMetaStrip({
  meta,
  cached,
  onView,
  onGenerateAgain,
  generating,
}: {
  meta?: GenerationMeta | null
  cached?: boolean
  onView?: () => void
  onGenerateAgain?: () => void
  generating?: boolean
}) {
  if (!meta && !cached) return null
  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/60 px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
          {cached || meta?.cached ? 'Cached result — no new tokens used' : 'Last generated'}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] font-semibold text-slate-700">
          <span>Date: {fmtWhen(meta?.generated_at)}</span>
          {meta?.generated_by ? <span>By: {meta.generated_by}</span> : null}
          {meta?.model ? <span>Model: {meta.model}</span> : null}
          {meta?.tokens != null ? <span>Tokens: {meta.tokens.toLocaleString()}</span> : null}
          {meta?.status ? <span>Status: {meta.status}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onView && (
          <button type="button" onClick={onView}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Eye className="w-3.5 h-3.5" /> View Result
          </button>
        )}
        {onGenerateAgain && (
          <button type="button" onClick={onGenerateAgain} disabled={generating}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> Generate Again
          </button>
        )}
      </div>
    </div>
  )
}
