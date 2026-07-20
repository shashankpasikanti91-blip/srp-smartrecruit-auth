'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle, Bookmark, Briefcase, Clock, Loader2, MessageSquarePlus,
  Pin, Plus, Search, Send, Sparkles, Trash2, User, Zap,
} from 'lucide-react'

const STORAGE_KEY = 'srp-ai-workspace-v1'

type ChatRole = 'user' | 'assistant' | 'system'
type MessageMeta = {
  candidate_id?: string
  candidate_name?: string
  job_id?: string
  job_title?: string
}
type ChatMessage = { id: string; role: ChatRole; content: string; at: number; meta?: MessageMeta }
type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
  pinned?: boolean
}
type SavedSearch = { id: string; name: string; query: string }
type WorkspaceStore = {
  sessions: ChatSession[]
  pinnedIds: string[]
  savedSearches: SavedSearch[]
  templates: { id: string; label: string; prompt: string }[]
}

type CoachContext = {
  candidate?: { id: string; name?: string; email?: string; stage?: string }
  job?: { id: string; title?: string; company?: string }
  notes?: string
  suggested_actions?: { id: string; title: string; rationale?: string }[]
  follow_ups?: { id: string; title?: string; due_at?: string }[]
  recommendations?: { id: string; title: string; agent_type?: string }[]
}

const DEFAULT_TEMPLATES = [
  { id: 'jd', label: 'Generate JD', prompt: 'Generate a full job description pack for my top open role.' },
  { id: 'boolean', label: 'Boolean search', prompt: 'Create boolean search strings for my open roles.' },
  { id: 'compare', label: 'Compare candidates', prompt: 'Compare top two candidates for my priority role with strengths, risks, and recommendation.' },
  { id: 'followup', label: 'WhatsApp follow-up', prompt: 'Draft a WhatsApp follow-up for a candidate awaiting client feedback.' },
]

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadStore(): WorkspaceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { sessions: [], pinnedIds: [], savedSearches: [], templates: DEFAULT_TEMPLATES }
    const parsed = JSON.parse(raw) as Partial<WorkspaceStore>
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      savedSearches: Array.isArray(parsed.savedSearches) ? parsed.savedSearches : [],
      templates: Array.isArray(parsed.templates) && parsed.templates.length ? parsed.templates : DEFAULT_TEMPLATES,
    }
  } catch {
    return { sessions: [], pinnedIds: [], savedSearches: [], templates: DEFAULT_TEMPLATES }
  }
}

function saveStore(store: WorkspaceStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...store,
      sessions: store.sessions.slice(0, 40),
    }))
  } catch { /* quota */ }
}

function renderMarkdownish(text: string) {
  const parts = text.split(/(```[\s\S]*?```|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).replace(/^\w+\n/, '')
      return (
        <pre key={i} className="my-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          {code.trim()}
        </pre>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>
    }
    return <span key={i} className="whitespace-pre-wrap">{part}</span>
  })
}

export function AiRecruiterWorkspace({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [store, setStore] = useState<WorkspaceStore>({ sessions: [], pinnedIds: [], savedSearches: [], templates: DEFAULT_TEMPLATES })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<CoachContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const persist = useCallback((next: WorkspaceStore) => {
    setStore(next)
    saveStore(next)
  }, [])

  const active = store.sessions.find(s => s.id === activeId) ?? store.sessions[0]

  useEffect(() => {
    const local = loadStore()
    let sessions = local.sessions
    if (!sessions.length) {
      const welcome: ChatSession = {
        id: newId(),
        title: 'New conversation',
        updatedAt: Date.now(),
        messages: [{
          id: newId(),
          role: 'assistant',
          at: Date.now(),
          content: 'Welcome to AI Recruiter Workspace.\n\nAsk about pipeline priorities, candidate comparison, JD writing, or messaging — grounded on your tenant data.',
        }],
      }
      sessions = [welcome]
    }
    const merged = { ...local, sessions }
    persist(merged)
    setActiveId(sessions[0]?.id ?? null)

    fetch('/api/coach/sessions')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.sessions?.length) return
        const remote = data.sessions as ChatSession[]
        const byId = new Map(sessions.map(s => [s.id, s]))
        for (const rs of remote) {
          const existing = byId.get(rs.id)
          if (!existing || (rs.updatedAt ?? 0) > existing.updatedAt) byId.set(rs.id, rs)
        }
        const nextSessions = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
        persist({ ...merged, sessions: nextSessions })
      })
      .catch(() => {})
  }, [persist])

  const loadContext = useCallback(async () => {
    setContextLoading(true)
    try {
      const res = await fetch('/api/coach/context')
      if (res.ok) {
        const json = await res.json()
        setContext(json)
        return
      }
    } catch { /* fall through */ }

    try {
      const [agentsRes, followRes] = await Promise.all([
        fetch('/api/agents?status=pending&limit=5'),
        fetch('/api/follow-ups?mine=1&bucket=today'),
      ])
      const agents = agentsRes.ok ? await agentsRes.json() : { suggestions: [] }
      const follow = followRes.ok ? await followRes.json() : { follow_ups: [] }
      setContext({
        recommendations: (agents.suggestions ?? []).map((s: { id: string; title: string; agent_type?: string }) => ({
          id: s.id,
          title: s.title,
          agent_type: s.agent_type,
        })),
        follow_ups: (follow.follow_ups ?? follow.items ?? []).slice(0, 5),
        suggested_actions: (agents.suggestions ?? []).slice(0, 3).map((s: { id: string; title: string; rationale?: string }) => ({
          id: s.id,
          title: s.title,
          rationale: s.rationale,
        })),
      })
    } catch {
      setContext(null)
    } finally {
      setContextLoading(false)
    }
  }, [])

  useEffect(() => { loadContext() }, [loadContext])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages, loading])

  const updateSession = useCallback((sessionId: string, updater: (s: ChatSession) => ChatSession) => {
    setStore(prev => {
      const next = {
        ...prev,
        sessions: prev.sessions.map(s => (s.id === sessionId ? updater(s) : s)),
      }
      saveStore(next)
      return next
    })
  }, [])

  const newChat = () => {
    const s: ChatSession = {
      id: newId(),
      title: 'New conversation',
      updatedAt: Date.now(),
      messages: [{
        id: newId(),
        role: 'assistant',
        at: Date.now(),
        content: 'New conversation started. What would you like to work on?',
      }],
    }
    persist({ ...store, sessions: [s, ...store.sessions] })
    setActiveId(s.id)
    setError(null)
  }

  const deleteChat = (id: string) => {
    const next = store.sessions.filter(s => s.id !== id)
    const pinnedIds = store.pinnedIds.filter(pid => pid !== id)
    if (!next.length) {
      newChat()
      return
    }
    persist({ ...store, sessions: next, pinnedIds })
    if (activeId === id) setActiveId(next[0].id)
  }

  const togglePin = (id: string) => {
    const pinnedIds = store.pinnedIds.includes(id)
      ? store.pinnedIds.filter(pid => pid !== id)
      : [...store.pinnedIds, id]
    persist({ ...store, pinnedIds })
  }

  const send = async (promptText?: string) => {
    if (!active) return
    const userText = (promptText ?? input).trim()
    if (!userText) return

    setLoading(true)
    setError(null)
    setInput('')

    updateSession(active.id, s => ({
      ...s,
      title: s.title === 'New conversation' ? userText.slice(0, 42) : s.title,
      updatedAt: Date.now(),
      messages: [...s.messages, { id: newId(), role: 'user', content: userText, at: Date.now() }],
    }))

    try {
      const historyMsgs = [...(active.messages ?? [])]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))
      historyMsgs.push({ role: 'user', content: userText })

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          messages: historyMsgs,
          session_id: active.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? `Request failed (${res.status})`
        setError(msg)
        updateSession(active.id, s => ({
          ...s,
          messages: [...s.messages, { id: newId(), role: 'assistant', content: `Could not complete request.\n\n${msg}`, at: Date.now() }],
        }))
        return
      }
      const text = data.suggestions ?? data.content ?? data.reply ?? 'No response from AI.'
      const meta: MessageMeta | undefined = data.meta ?? (
        data.candidate_id ? { candidate_id: data.candidate_id, candidate_name: data.candidate_name } : undefined
      )
      updateSession(active.id, s => ({
        ...s,
        updatedAt: Date.now(),
        messages: [...s.messages, { id: newId(), role: 'assistant', content: String(text), at: Date.now(), meta }],
      }))
    } catch {
      setError('Network error')
      updateSession(active.id, s => ({
        ...s,
        messages: [...s.messages, { id: newId(), role: 'assistant', content: 'Network error — could not reach AI coach.', at: Date.now() }],
      }))
    } finally {
      setLoading(false)
    }
  }

  const pinned = store.sessions.filter(s => store.pinnedIds.includes(s.id))
  const recent = store.sessions.filter(s => !store.pinnedIds.includes(s.id)).slice(0, 12)

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Sparkles className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-xl">AI Recruiter Workspace</h1>
            <p className="desc-text mt-1">Three-column copilot with context, sessions, and actionable insights.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr_18rem] gap-0 rounded-2xl border border-slate-200 bg-white overflow-hidden min-h-[560px] shadow-sm">
        {/* Left sidebar */}
        <aside className="hidden lg:flex flex-col border-r border-slate-200 bg-slate-50/80 p-3 gap-3 min-h-0">
          <button type="button" onClick={newChat} className="btn-primary w-full !justify-center !py-2">
            <Plus className="w-4 h-4" /> New
          </button>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-1 flex items-center gap-1">
              <Pin className="w-3 h-3" /> Pinned
            </p>
            <SessionList sessions={pinned} activeId={active?.id} onSelect={setActiveId} onDelete={deleteChat} onPin={togglePin} pinnedIds={store.pinnedIds} />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-1">Recent</p>
            <div className="flex-1 overflow-y-auto space-y-0.5">
              <SessionList sessions={recent} activeId={active?.id} onSelect={setActiveId} onDelete={deleteChat} onPin={togglePin} pinnedIds={store.pinnedIds} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-1 flex items-center gap-1">
              <Bookmark className="w-3 h-3" /> Saved searches
            </p>
            {store.savedSearches.length ? (
              <ul className="space-y-0.5">
                {store.savedSearches.map(ss => (
                  <li key={ss.id}>
                    <button type="button" onClick={() => send(ss.query)} className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 truncate">
                      {ss.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] font-medium text-slate-400 px-1">No saved searches</p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-1">Templates</p>
            <ul className="space-y-0.5">
              {store.templates.map(t => (
                <li key={t.id}>
                  <button type="button" disabled={loading} onClick={() => send(t.prompt)} className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 truncate">
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Center chat */}
        <div className="flex flex-col min-h-0 min-w-0 border-r border-slate-100">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {(active?.messages ?? []).map(m => (
              <div
                key={m.id}
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-indigo-600 text-white'
                    : 'mr-auto bg-slate-50 border border-slate-200 text-slate-800 prose prose-sm max-w-none'
                }`}
              >
                {m.role === 'user' ? m.content : renderMarkdownish(m.content)}
                {m.meta?.candidate_id && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('candidates')}
                    className="mt-2 flex items-center gap-2 w-full text-left rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-800 hover:bg-indigo-50"
                  >
                    <User className="w-3.5 h-3.5" />
                    {m.meta.candidate_name ?? 'View candidate'}
                  </button>
                )}
                {m.meta?.job_id && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('jobs')}
                    className="mt-2 flex items-center gap-2 w-full text-left rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-extrabold text-violet-800 hover:bg-violet-50"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {m.meta.job_title ?? 'View job'}
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-2 text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> thinking…
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50/50">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={2}
                placeholder="Ask about pipeline, candidates, JDs, or messaging…"
                className="form-input flex-1 !min-h-[52px] resize-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!loading) send()
                  }
                }}
              />
              <button type="button" className="btn-ai !px-4 !py-3" disabled={loading} onClick={() => send()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2 flex items-center gap-1">
              <MessageSquarePlus className="w-3 h-3" /> Grounded on tenant data. Sessions sync locally and via API when available.
            </p>
          </div>
        </div>

        {/* Right context */}
        <aside className="hidden lg:flex flex-col p-3 gap-3 bg-slate-50/60 overflow-y-auto">
          <ContextBlock title="Candidate context" icon={User} loading={contextLoading}>
            {context?.candidate ? (
              <div className="text-xs font-semibold text-slate-700 space-y-0.5">
                <p className="font-extrabold text-slate-900">{context.candidate.name}</p>
                <p>{context.candidate.email}</p>
                <p className="capitalize">{context.candidate.stage}</p>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-400">No active candidate context</p>
            )}
          </ContextBlock>

          <ContextBlock title="Job context" icon={Briefcase} loading={contextLoading}>
            {context?.job ? (
              <div className="text-xs font-semibold text-slate-700">
                <p className="font-extrabold text-slate-900">{context.job.title}</p>
                <p>{context.job.company}</p>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-400">No active job context</p>
            )}
          </ContextBlock>

          <ContextBlock title="Recruiter notes" icon={Search} loading={contextLoading}>
            <p className="text-xs font-medium text-slate-600 whitespace-pre-wrap">{context?.notes || '—'}</p>
          </ContextBlock>

          <ContextBlock title="Suggested actions" icon={Zap} loading={contextLoading}>
            {context?.suggested_actions?.length ? (
              <ul className="space-y-1.5">
                {context.suggested_actions.map(a => (
                  <li key={a.id} className="text-xs font-semibold text-slate-700 rounded-lg bg-white border border-slate-200 px-2 py-1.5">
                    {a.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs font-medium text-slate-400">No actions queued</p>
            )}
          </ContextBlock>

          <ContextBlock title="Upcoming follow-ups" icon={Clock} loading={contextLoading}>
            {context?.follow_ups?.length ? (
              <ul className="space-y-1.5">
                {context.follow_ups.map(f => (
                  <li key={f.id} className="text-xs font-semibold text-slate-700">
                    {f.title ?? 'Follow-up'}
                    {f.due_at && <span className="block text-[10px] text-slate-400">{new Date(f.due_at).toLocaleString()}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs font-medium text-slate-400">Nothing due today</p>
            )}
          </ContextBlock>

          <ContextBlock title="AI recommendations" icon={Sparkles} loading={contextLoading}>
            {context?.recommendations?.length ? (
              <ul className="space-y-1.5">
                {context.recommendations.map(r => (
                  <li key={r.id} className="text-xs font-semibold text-violet-800 rounded-lg bg-violet-50 border border-violet-100 px-2 py-1.5">
                    {r.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs font-medium text-slate-400">Run agent sweep for recommendations</p>
            )}
          </ContextBlock>
        </aside>
      </div>
    </div>
  )
}

function SessionList({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onPin,
  pinnedIds,
}: {
  sessions: ChatSession[]
  activeId?: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
  pinnedIds: string[]
}) {
  if (!sessions.length) return <p className="text-[10px] font-medium text-slate-400 px-1">Empty</p>
  return (
    <ul className="space-y-0.5">
      {sessions.map(s => (
        <li key={s.id} className="group flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            className={`flex-1 text-left px-2 py-1.5 rounded-lg text-xs font-semibold truncate ${
              s.id === activeId ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
          >
            {s.title}
          </button>
          <button type="button" title="Pin" onClick={() => onPin(s.id)} className="p-1 rounded text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100">
            <Pin className={`w-3 h-3 ${pinnedIds.includes(s.id) ? 'fill-indigo-600 text-indigo-600' : ''}`} />
          </button>
          <button type="button" title="Delete" onClick={() => onDelete(s.id)} className="p-1 rounded text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3 h-3" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function ContextBlock({
  title,
  icon: Icon,
  loading,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="ess-panel !shadow-none !p-0 overflow-hidden">
      <div className="ess-panel__head !py-2 !px-3">
        <p className="ess-panel__title !text-xs flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-indigo-600" /> {title}
        </p>
      </div>
      <div className="px-3 pb-3">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : children}
      </div>
    </div>
  )
}
