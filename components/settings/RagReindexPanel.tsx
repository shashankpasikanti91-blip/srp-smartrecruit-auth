'use client'

import { useCallback, useEffect, useState } from 'react'
import { Database, Loader2, RefreshCw, Sparkles } from 'lucide-react'

type RagStatus = {
  ok: boolean
  vector_ready: boolean
  resume_chunks: number
  job_chunks: number
  resume_sources: number
  job_sources: number
  last_indexed_at: string | null
  error?: string
}

type ReindexResult = {
  dry_run: boolean
  indexed: number
  skipped: number
  total_results: number
  sample?: Array<Record<string, unknown>>
}

export function RagReindexPanel() {
  const [status, setStatus] = useState<RagStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'dry' | 'run' | null>(null)
  const [source, setSource] = useState<'all' | 'resume' | 'job'>('all')
  const [limit, setLimit] = useState(25)
  const [last, setLast] = useState<ReindexResult | null>(null)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rag/status')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not load RAG status')
        setStatus(null)
        return
      }
      setStatus(data as RagStatus)
    } catch {
      setError('Network error')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const runReindex = async (dryRun: boolean) => {
    setBusy(dryRun ? 'dry' : 'run')
    setError('')
    setLast(null)
    try {
      const res = await fetch('/api/rag/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: dryRun, source, limit }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Reindex failed')
        return
      }
      setLast(data as ReindexResult)
      if (!dryRun) await loadStatus()
    } catch {
      setError('Network error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-teal-50/50">
        <Database className="w-4 h-4 text-teal-700" />
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900">Deep RAG index</p>
          <p className="text-[11px] font-medium text-slate-500">
            Embed resumes &amp; jobs for Coach citations and internal match (tenant-only)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="ml-auto text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          </div>
        ) : status ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Vector DB" value={status.vector_ready ? 'Ready' : 'Offline'} warn={!status.vector_ready} />
            <Stat label="Resume chunks" value={String(status.resume_chunks)} />
            <Stat label="Job chunks" value={String(status.job_chunks)} />
            <Stat
              label="Last indexed"
              value={
                status.last_indexed_at
                  ? new Date(status.last_indexed_at).toLocaleString()
                  : '—'
              }
            />
          </div>
        ) : null}

        {!status?.vector_ready && !loading ? (
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            pgvector is not available on this database. Indexing will soft-fail until the vector extension is installed.
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-slate-600">
            Source
            <select
              value={source}
              onChange={e => setSource(e.target.value as 'all' | 'resume' | 'job')}
              className="mt-1 block text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
            >
              <option value="all">Resumes + jobs</option>
              <option value="resume">Resumes only</option>
              <option value="job">Jobs only</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Batch limit
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="mt-1 block text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runReindex(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'dry' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Dry run
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runReindex(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-extrabold hover:bg-teal-800 disabled:opacity-50"
          >
            {busy === 'run' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Reindex now
          </button>
        </div>

        {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

        {last ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700">
            {last.dry_run ? 'Dry run' : 'Indexed'}: {last.indexed} ok · {last.skipped} skipped ·{' '}
            {last.total_results} scanned
            {status && !last.dry_run ? (
              <span className="text-slate-500">
                {' '}
                · corpus {status.resume_sources} resumes / {status.job_sources} jobs
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-extrabold mt-0.5 truncate ${warn ? 'text-amber-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
