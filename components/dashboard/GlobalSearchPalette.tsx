'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Loader2, Clock, Bookmark, Users, Briefcase, Building2,
  FileText, StickyNote, UserCheck, Send, Award, X,
} from 'lucide-react'

type Hit = {
  type: string
  id: string
  short_id?: string | null
  title: string
  subtitle?: string | null
  href: string
}

type Recent = {
  id: string
  query: string
  result_type?: string | null
  result_label?: string | null
  created_at: string
}

const TYPE_ICON: Record<string, typeof Search> = {
  candidate: Users,
  job: Briefcase,
  client: Building2,
  document: FileText,
  note: StickyNote,
  recruiter: UserCheck,
  submission: Send,
  interview: Award,
  offer: Award,
}

const TYPE_LABEL: Record<string, string> = {
  candidate: 'Candidate',
  job: 'Job',
  client: 'Client',
  document: 'Document',
  note: 'Note',
  recruiter: 'Recruiter',
  submission: 'Submission',
  interview: 'Interview',
  offer: 'Offer',
}

export function GlobalSearchPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Hit[]>([])
  const [recent, setRecent] = useState<Recent[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch('/api/search?mode=recent')
      const data = await res.json()
      setRecent(data.recent ?? [])
    } catch {
      setRecent([])
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    setQ('')
    setResults([])
    setActive(0)
    loadRecent()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, loadRecent])

  useEffect(() => {
    if (!open) return
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setActive(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q, open])

  const go = async (hit: Hit) => {
    setOpen(false)
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record',
        query: q.trim() || hit.title,
        result_type: hit.type,
        result_id: hit.id,
        result_label: hit.title,
      }),
    }).catch(() => null)
    router.push(hit.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = results[active]
      if (hit) void go(hit)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-700 text-[12px] font-semibold mr-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        title="Search (Ctrl+K)"
        aria-label="Open global search"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search…</span>
        <kbd className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 mr-auto"
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[1px] flex items-start justify-center pt-[12vh] px-4"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search candidates, jobs, clients, notes…"
                aria-label="Search candidates, jobs, clients, and notes"
                className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              />
              {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" aria-label="Searching" />}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {q.trim().length < 2 && recent.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Recent
                  </p>
                  {recent.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setQ(r.query)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    >
                      {r.query}
                      {r.result_label && (
                        <span className="block text-[11px] font-medium text-slate-400">{r.result_label}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {q.trim().length >= 2 && results.length === 0 && !loading && (
                <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">No matches in this workspace</p>
              )}

              {results.length > 0 && (
                <ul className="p-2">
                  {results.map((hit, i) => {
                    const Icon = TYPE_ICON[hit.type] ?? Search
                    return (
                      <li key={`${hit.type}-${hit.id}`}>
                        <button
                          type="button"
                          onClick={() => void go(hit)}
                          onMouseEnter={() => setActive(i)}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left ${
                            i === active ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="mt-0.5 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900 truncate">{hit.title}</span>
                              <span className="text-[10px] font-bold uppercase text-slate-400">{TYPE_LABEL[hit.type] ?? hit.type}</span>
                            </span>
                            {hit.subtitle && (
                              <span className="block text-[11px] font-medium text-slate-500 truncate mt-0.5">{hit.subtitle}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3" /> Tenant-scoped only</span>
              <span>↑↓ navigate · Enter open · Esc close</span>
            </div>
          </div>
          <button type="button" className="fixed inset-0 -z-10" aria-label="Close search" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
