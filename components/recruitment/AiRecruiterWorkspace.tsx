'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Bookmark, Brain, Briefcase, Clock, FileText, HelpCircle,
  Layers, Loader2, Mail, MessageSquare, MessageSquarePlus, PenLine, Pin, Plus,
  Search, Send, Sparkles, Target, Trash2, User, UserCheck, Zap,
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
type TemplateItem = { id: string; label: string; prompt: string; group?: string }
type WorkspaceStore = {
  sessions: ChatSession[]
  pinnedIds: string[]
  savedSearches: SavedSearch[]
  templates: TemplateItem[]
  pinnedTemplateIds?: string[]
  recentTemplateIds?: string[]
}

type CoachContext = {
  candidate?: { id: string; name?: string; email?: string; stage?: string }
  job?: { id: string; title?: string; company?: string }
  notes?: string
  suggested_actions?: { id: string; title: string; rationale?: string }[]
  follow_ups?: { id: string; title?: string; due_at?: string }[]
  recommendations?: { id: string; title: string; agent_type?: string }[]
}

const DEFAULT_TEMPLATES: TemplateItem[] = [
  { id: 'jd', label: 'Generate JD', prompt: 'Generate a full job description pack for my top open role including responsibilities, requirements, and nice-to-haves.', group: 'Jobs' },
  { id: 'boolean', label: 'Boolean search', prompt: 'Create Boolean search strings for LinkedIn, Naukri, and Indeed for my open roles.', group: 'Sourcing' },
  { id: 'linkedin', label: 'LinkedIn search', prompt: 'Write an advanced LinkedIn Recruiter search string and filters for my priority role.', group: 'Sourcing' },
  { id: 'email', label: 'Email template', prompt: 'Draft a professional candidate outreach email and a client submission email for my open role.', group: 'Outreach' },
  { id: 'whatsapp', label: 'WhatsApp template', prompt: 'Draft a WhatsApp follow-up for a candidate awaiting client feedback.', group: 'Outreach' },
  { id: 'interview', label: 'Interview questions', prompt: 'Generate a structured interview kit with screening, technical, and culture questions for my priority role.', group: 'Interview' },
  { id: 'summary', label: 'Candidate summary', prompt: 'Summarize the top candidate in my pipeline with strengths, risks, and hire recommendation.', group: 'Candidates' },
  { id: 'offer', label: 'Offer letter', prompt: 'Draft an offer letter outline with compensation, start date placeholders, and next steps.', group: 'Offer' },
  { id: 'salary', label: 'Salary negotiation', prompt: 'Give salary negotiation talking points for a candidate counter-offer on my open role.', group: 'Offer' },
  { id: 'proposal', label: 'Client proposal', prompt: 'Write a short client proposal for filling this role including SLA and sourcing plan.', group: 'Clients' },
  { id: 'sourcing', label: 'Sourcing strategy', prompt: 'Create a 7-day sourcing strategy with channels, Boolean queries, and outreach cadence.', group: 'Sourcing' },
  { id: 'compare', label: 'Compare candidates', prompt: 'Compare top two candidates for my priority role with strengths, risks, and recommendation.', group: 'Candidates' },
]

const TOOL_CARDS = [
  {
    id: 'coach',
    label: 'Chat',
    desc: 'Recruitment AI Assistant',
    icon: MessageSquare,
    gradient: 'from-indigo-600 via-indigo-500 to-violet-500',
    shadow: 'shadow-indigo-500/25',
    ring: 'ring-indigo-300',
  },
  {
    id: 'screen',
    label: 'AI Screen',
    desc: 'AI-powered candidate screening',
    icon: Brain,
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-500',
    shadow: 'shadow-violet-500/25',
    ring: 'ring-violet-300',
  },
  {
    id: 'compose',
    label: 'Compose',
    desc: 'Generate recruiter emails & messages',
    icon: Mail,
    gradient: 'from-sky-600 via-blue-500 to-cyan-500',
    shadow: 'shadow-sky-500/25',
    ring: 'ring-sky-300',
  },
  {
    id: 'jd',
    label: 'JD Writer',
    desc: 'Create professional job descriptions',
    icon: FileText,
    gradient: 'from-emerald-600 via-teal-500 to-green-500',
    shadow: 'shadow-emerald-500/25',
    ring: 'ring-emerald-300',
  },
  {
    id: 'boolean',
    label: 'Boolean',
    desc: 'Generate advanced Boolean searches',
    icon: Search,
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    shadow: 'shadow-orange-500/25',
    ring: 'ring-orange-300',
  },
  {
    id: 'gen-post',
    label: 'Generate Job Post',
    desc: 'Generate job social posts from your job hub',
    icon: PenLine,
    gradient: 'from-fuchsia-600 via-violet-500 to-indigo-500',
    shadow: 'shadow-fuchsia-500/25',
    ring: 'ring-fuchsia-300',
  },
] as const

const QUICK_ACTIONS = [
  { id: 'screen', label: 'Screen Candidate', icon: Brain, tab: 'screen', prompt: null as string | null },
  { id: 'jd', label: 'Generate JD', icon: FileText, tab: 'jd', prompt: null },
  { id: 'boolean', label: 'Create Boolean', icon: Search, tab: 'boolean', prompt: null },
  { id: 'email', label: 'Generate Email', icon: Mail, tab: 'compose', prompt: null },
  { id: 'whatsapp', label: 'WhatsApp Message', icon: MessageSquare, tab: null, prompt: 'Draft a WhatsApp follow-up for a candidate awaiting client feedback.' },
] as const

const SUGGESTION_CHIPS = [
  { label: 'Screen candidates for my open role', prompt: 'Help me screen and rank candidates for my top open role.' },
  { label: 'Write a follow-up email to a client', prompt: 'Draft a professional client follow-up email about candidate status.' },
  { label: 'Create a JD for a senior role', prompt: 'Generate a full job description for a senior role on my pipeline.' },
  { label: 'Build a Boolean search string', prompt: 'Create Boolean search strings for LinkedIn, Naukri, and Indeed for my open roles.' },
]

const TEMPLATE_ICON: Record<string, typeof Sparkles> = {
  jd: FileText,
  boolean: Search,
  linkedin: Search,
  email: Mail,
  whatsapp: MessageSquare,
  interview: HelpCircle,
  summary: Layers,
  offer: FileText,
  salary: Target,
  proposal: Briefcase,
  sourcing: Zap,
  compare: UserCheck,
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadStore(): WorkspaceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { sessions: [], pinnedIds: [], savedSearches: [], templates: DEFAULT_TEMPLATES, pinnedTemplateIds: [], recentTemplateIds: [] }
    const parsed = JSON.parse(raw) as Partial<WorkspaceStore>
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      savedSearches: Array.isArray(parsed.savedSearches) ? parsed.savedSearches : [],
      templates: Array.isArray(parsed.templates) && parsed.templates.length ? parsed.templates : DEFAULT_TEMPLATES,
      pinnedTemplateIds: Array.isArray(parsed.pinnedTemplateIds) ? parsed.pinnedTemplateIds : [],
      recentTemplateIds: Array.isArray(parsed.recentTemplateIds) ? parsed.recentTemplateIds : [],
    }
  } catch {
    return { sessions: [], pinnedIds: [], savedSearches: [], templates: DEFAULT_TEMPLATES, pinnedTemplateIds: [], recentTemplateIds: [] }
  }
}

function saveStore(store: WorkspaceStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...store,
      sessions: store.sessions.slice(0, 40),
      recentTemplateIds: (store.recentTemplateIds ?? []).slice(0, 12),
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

function normalizeCoachContext(raw: Record<string, unknown>): CoachContext {
  const cand = (raw.candidate ?? raw.candidate_context) as CoachContext['candidate'] | null | undefined
  const job = (raw.job ?? raw.job_context) as CoachContext['job'] | null | undefined
  const notes = String(raw.notes ?? raw.recruiter_notes ?? '')
  const actionsRaw = (raw.suggested_actions ?? []) as Array<string | { id?: string; title?: string; rationale?: string }>
  const followRaw = (raw.follow_ups ?? raw.upcoming_followups ?? []) as Array<{ id?: string; title?: string; due_at?: string }>
  const recRaw = (raw.recommendations ?? raw.ai_recommendations ?? []) as Array<{ id?: string; title?: string; agent_type?: string }>

  return {
    candidate: cand ?? undefined,
    job: job ?? undefined,
    notes: notes || undefined,
    suggested_actions: actionsRaw.map((a, i) => (
      typeof a === 'string'
        ? { id: `action-${i}`, title: a }
        : { id: a.id ?? `action-${i}`, title: a.title ?? 'Action', rationale: a.rationale }
    )).filter(a => a.title),
    follow_ups: followRaw.map((f, i) => ({
      id: f.id ?? `fu-${i}`,
      title: f.title ?? 'Follow-up',
      due_at: f.due_at,
    })),
    recommendations: recRaw.map((r, i) => ({
      id: r.id ?? `rec-${i}`,
      title: r.title ?? 'Recommendation',
      agent_type: r.agent_type,
    })),
  }
}

export function AiRecruiterWorkspace({
  onNavigate,
  bootstrapTemplateId,
}: {
  onNavigate?: (tab: string) => void
  /** Sidebar shortcut: fill input from a known template id, or scroll to templates (`__library__`). */
  bootstrapTemplateId?: string | null
}) {
  const [store, setStore] = useState<WorkspaceStore>({ sessions: [], pinnedIds: [], savedSearches: [], templates: DEFAULT_TEMPLATES, pinnedTemplateIds: [], recentTemplateIds: [] })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<CoachContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [templateQuery, setTemplateQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const templatesRef = useRef<HTMLDivElement>(null)
  const lastBootstrapRef = useRef<string | null>(null)

  const persist = useCallback((next: WorkspaceStore) => {
    setStore(next)
    saveStore(next)
  }, [])

  const active = store.sessions.find(s => s.id === activeId) ?? store.sessions[0]
  const isFreshChat = (active?.messages?.length ?? 0) <= 1
    && (active?.messages?.[0]?.role === 'assistant')

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
          content: 'Welcome to AI Hub.\n\nUse the tool cards for AI Screening, Compose, JD Writer, and Boolean Search — or ask anything about your pipeline.\n\nTip: open a Job Hub page to run Screening / Boolean / Generate Post with the JD already loaded.',
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
        const json = await res.json() as Record<string, unknown>
        setContext(normalizeCoachContext(json))
        return
      }
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
      setContext({})
    } finally {
      setContextLoading(false)
    }
  }, [])

  useEffect(() => { loadContext() }, [loadContext])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages, loading])

  useEffect(() => {
    if (!bootstrapTemplateId) {
      lastBootstrapRef.current = null
      return
    }
    if (lastBootstrapRef.current === bootstrapTemplateId) return
    lastBootstrapRef.current = bootstrapTemplateId

    if (bootstrapTemplateId === '__library__') {
      templatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }

    const templates = store.templates.length ? store.templates : DEFAULT_TEMPLATES
    const match = templates.find(t => t.id === bootstrapTemplateId)
    if (match) setInput(match.prompt)
  }, [bootstrapTemplateId, store.templates])

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

  const toggleTemplatePin = (id: string) => {
    const pinned = store.pinnedTemplateIds ?? []
    const pinnedTemplateIds = pinned.includes(id) ? pinned.filter(x => x !== id) : [...pinned, id]
    persist({ ...store, pinnedTemplateIds })
  }

  const markTemplateUsed = (id: string) => {
    const recent = [id, ...(store.recentTemplateIds ?? []).filter(x => x !== id)].slice(0, 12)
    persist({ ...store, recentTemplateIds: recent })
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

  const runTemplate = (t: TemplateItem) => {
    markTemplateUsed(t.id)
    void send(t.prompt)
  }

  const runQuickAction = (a: (typeof QUICK_ACTIONS)[number]) => {
    if (a.tab && onNavigate) {
      onNavigate(a.tab)
      return
    }
    if (a.prompt) void send(a.prompt)
  }

  const pinned = store.sessions.filter(s => store.pinnedIds.includes(s.id))
  const recent = store.sessions.filter(s => !store.pinnedIds.includes(s.id)).slice(0, 12)

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase()
    const list = store.templates.length ? store.templates : DEFAULT_TEMPLATES
    if (!q) return list
    return list.filter(t => t.label.toLowerCase().includes(q) || (t.group ?? '').toLowerCase().includes(q))
  }, [store.templates, templateQuery])

  const pinnedTemplates = filteredTemplates.filter(t => (store.pinnedTemplateIds ?? []).includes(t.id))
  const recentTemplates = (store.recentTemplateIds ?? [])
    .map(id => filteredTemplates.find(t => t.id === id))
    .filter(Boolean) as TemplateItem[]
  const otherTemplates = filteredTemplates.filter(
    t => !(store.pinnedTemplateIds ?? []).includes(t.id) && !(store.recentTemplateIds ?? []).includes(t.id),
  )

  const recentPrompts = useMemo(() => {
    const prompts: string[] = []
    for (const s of store.sessions) {
      for (const m of s.messages ?? []) {
        if (m.role === 'user' && m.content.trim()) prompts.push(m.content.trim())
        if (prompts.length >= 4) return prompts
      }
    }
    return prompts
  }, [store.sessions])

  return (
    <div className="space-y-4">
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon bg-gradient-to-br from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="page-title text-xl">AI Assistant</h1>
            <p className="desc-text mt-1">Chat, screen, compose, JD, and boolean tools in one place.</p>
          </div>
        </div>
      </div>

      {/* Premium AI tool cards — same navigation as before */}
      {onNavigate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {TOOL_CARDS.map(m => {
            const Icon = m.icon
            const activeTool = m.id === 'coach'
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate(m.id)}
                className={`group relative text-left rounded-2xl p-4 text-white overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 ${m.ring} bg-gradient-to-br ${m.gradient} shadow-lg ${m.shadow} ${
                  activeTool ? 'ring-2 ring-offset-2 ring-indigo-400 scale-[1.01]' : ''
                }`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10" />
                <div className="relative flex flex-col gap-3 min-h-[108px]">
                  <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold tracking-tight">{m.label}</p>
                    <p className="text-[11px] font-medium text-white/85 mt-0.5 leading-snug">{m.desc}</p>
                  </div>
                  <span className="mt-auto text-[11px] font-bold text-white/90 group-hover:translate-x-0.5 transition-transform">
                    Open {m.label} →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Quick actions */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-3 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-2">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {QUICK_ACTIONS.map(a => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                type="button"
                disabled={loading && !a.tab}
                onClick={() => runQuickAction(a)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-3 text-center hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md transition-all duration-150"
              >
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-sm">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">{a.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr_18rem] gap-0 rounded-2xl border border-slate-200 bg-white overflow-hidden min-h-[580px] shadow-md shadow-slate-900/5">
        {/* Left sidebar */}
        <aside className="hidden lg:flex flex-col border-r border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 gap-3 min-h-0">
          <button type="button" onClick={newChat} className="btn-primary w-full !justify-center !py-2.5 shadow-md shadow-indigo-500/20">
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

          <div ref={templatesRef} id="ai-hub-templates" className="min-h-0 flex flex-col gap-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-0.5">Templates</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                value={templateQuery}
                onChange={e => setTemplateQuery(e.target.value)}
                placeholder="Search templates…"
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-[11px] border border-slate-200 bg-white focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-0.5">
              {pinnedTemplates.length > 0 && (
                <TemplateGroup
                  title="Pinned"
                  templates={pinnedTemplates}
                  pinnedIds={store.pinnedTemplateIds ?? []}
                  loading={loading}
                  onRun={runTemplate}
                  onPin={toggleTemplatePin}
                />
              )}
              {recentTemplates.length > 0 && (
                <TemplateGroup
                  title="Recently used"
                  templates={recentTemplates}
                  pinnedIds={store.pinnedTemplateIds ?? []}
                  loading={loading}
                  onRun={runTemplate}
                  onPin={toggleTemplatePin}
                />
              )}
              <TemplateGroup
                title={pinnedTemplates.length || recentTemplates.length ? 'All' : 'Library'}
                templates={otherTemplates.length ? otherTemplates : filteredTemplates}
                pinnedIds={store.pinnedTemplateIds ?? []}
                loading={loading}
                onRun={runTemplate}
                onPin={toggleTemplatePin}
              />
              {filteredTemplates.length === 0 && (
                <p className="text-[10px] font-medium text-slate-400 px-1">No matching templates</p>
              )}
            </div>
          </div>
        </aside>

        {/* Center chat */}
        <div className="flex flex-col min-h-0 min-w-0 border-r border-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/40 via-white to-white">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isFreshChat && (
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 mb-2 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-slate-900 tracking-tight">How can I help you today?</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Screen talent, draft outreach, write JDs, or build Boolean strings — grounded on your tenant data.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTION_CHIPS.map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={loading}
                      onClick={() => send(chip.prompt)}
                      className="text-left rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-800 hover:shadow-md transition-all"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                {recentPrompts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Recent prompts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentPrompts.map(p => (
                        <button
                          key={p}
                          type="button"
                          disabled={loading}
                          onClick={() => send(p)}
                          className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                          title={p}
                        >
                          {p.length > 48 ? `${p.slice(0, 48)}…` : p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(active?.messages ?? []).map(m => (
              <div
                key={m.id}
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-gradient-to-br from-indigo-600 to-violet-600 text-white'
                    : 'mr-auto bg-white border border-slate-200 text-slate-800'
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
              <div className="mr-auto flex items-center gap-2.5 text-sm font-semibold text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                <span className="flex gap-1" aria-hidden>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="sr-only">AI is thinking</span>
                <span aria-hidden>thinking…</span>
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

          <div className="p-3 border-t border-slate-200/80 bg-white/90 backdrop-blur-sm">
            <div className="flex gap-2 items-end rounded-2xl border border-slate-200 bg-slate-50/80 p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-shadow">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={2}
                placeholder="Ask me anything about recruitment…"
                className="flex-1 !min-h-[52px] resize-none bg-transparent border-0 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400 px-2 py-1.5"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!loading) send()
                  }
                }}
              />
              <button
                type="button"
                className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-60"
                disabled={loading || !input.trim()}
                onClick={() => send()}
                aria-label="Send message"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2 flex items-center gap-1">
              <MessageSquarePlus className="w-3 h-3" /> Grounded on tenant data. Sessions sync locally and via API when available.
            </p>
          </div>
        </div>

        {/* Right context */}
        <aside className="hidden lg:flex flex-col p-3 gap-3 bg-gradient-to-b from-slate-50/90 to-white overflow-y-auto">
          <ContextBlock title="Candidate context" icon={User} loading={contextLoading}>
            {context?.candidate ? (
              <div className="text-xs font-semibold text-slate-700 space-y-0.5">
                <p className="font-extrabold text-slate-900">{context.candidate.name}</p>
                <p>{context.candidate.email}</p>
                <p className="capitalize">{context.candidate.stage}</p>
              </div>
            ) : (
              <EmptyHint>No candidate selected. Select a candidate to see context.</EmptyHint>
            )}
          </ContextBlock>

          <ContextBlock title="Job context" icon={Briefcase} loading={contextLoading}>
            {context?.job ? (
              <div className="text-xs font-semibold text-slate-700">
                <p className="font-extrabold text-slate-900">{context.job.title}</p>
                <p>{context.job.company}</p>
              </div>
            ) : (
              <EmptyHint>No active job selected. Select a job to see context.</EmptyHint>
            )}
          </ContextBlock>

          <ContextBlock title="Recruiter notes" icon={Search} loading={contextLoading}>
            {context?.notes?.trim() ? (
              <p className="text-xs font-medium text-slate-600 whitespace-pre-wrap">{context.notes}</p>
            ) : (
              <EmptyHint>No recruiter notes yet.</EmptyHint>
            )}
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
              <EmptyHint>No actions queued.</EmptyHint>
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
              <EmptyHint>No follow-ups scheduled.</EmptyHint>
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
              <EmptyHint>No recommendations available.</EmptyHint>
            )}
          </ContextBlock>
        </aside>
      </div>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-400 leading-relaxed">{children}</p>
}

function TemplateGroup({
  title,
  templates,
  pinnedIds,
  loading,
  onRun,
  onPin,
}: {
  title: string
  templates: TemplateItem[]
  pinnedIds: string[]
  loading: boolean
  onRun: (t: TemplateItem) => void
  onPin: (id: string) => void
}) {
  if (!templates.length) return null
  return (
    <div>
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-0.5">{title}</p>
      <ul className="space-y-0.5">
        {templates.map(t => {
          const Icon = TEMPLATE_ICON[t.id] ?? Sparkles
          const pinned = pinnedIds.includes(t.id)
          return (
            <li key={`${title}-${t.id}`} className="group flex items-center gap-0.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => onRun(t)}
                className="flex-1 flex items-center gap-1.5 text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 truncate transition-colors"
              >
                <Icon className="w-3 h-3 shrink-0 text-indigo-500" />
                <span className="truncate">{t.label}</span>
              </button>
              <button
                type="button"
                title={pinned ? 'Unpin' : 'Pin'}
                onClick={() => onPin(t.id)}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pin className={`w-3 h-3 ${pinned ? 'fill-indigo-600 text-indigo-600 opacity-100' : ''}`} />
              </button>
            </li>
          )
        })}
      </ul>
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
            className={`flex-1 text-left px-2 py-1.5 rounded-lg text-xs font-semibold truncate transition-colors ${
              s.id === activeId ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
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
    <div className="rounded-xl border border-slate-200/90 bg-white/90 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80">
        <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-indigo-600" /> {title}
        </p>
      </div>
      <div className="px-3 py-2.5 min-h-[2.5rem]">
        {loading ? (
          <div className="space-y-1.5 animate-pulse" aria-label="Loading">
            <div className="h-2.5 rounded bg-slate-200 w-3/4" />
            <div className="h-2.5 rounded bg-slate-100 w-1/2" />
          </div>
        ) : children}
      </div>
    </div>
  )
}
