'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, Loader2, MessageSquarePlus, Plus, Search, Send, Sparkles, Trash2,
} from 'lucide-react'

type ChatRole = 'user' | 'assistant' | 'system'
type ChatMessage = { id: string; role: ChatRole; content: string; at: number }
type ChatSession = { id: string; title: string; messages: ChatMessage[]; updatedAt: number }

const STORAGE_KEY = 'srp-smartrecruit-ai-sessions-v1'

const SUGGESTED = [
  { label: 'Daily coaching tips', action: 'coach' as const },
  { label: 'Generate Java JD KL', action: 'coach_prompt' as const, prompt: 'Generate Java JD Kuala Lumpur — full pack with responsibilities, skills, salary guidance MYR, boolean, LinkedIn search, JobStreet search, interview questions, screening questions, hiring difficulty, source strategy, candidate scorecard.' },
  { label: 'WhatsApp follow-up', action: 'coach_prompt' as const, prompt: 'Generate WhatsApp Follow-up for a candidate who interviewed yesterday and we are waiting on client feedback. Ready-to-send.' },
  { label: 'Compare candidates', action: 'coach_prompt' as const, prompt: 'Compare Candidate A vs Candidate B for a senior Java role using my tenant screening data if available. Strengths, weaknesses, hiring recommendation, risk analysis, AI match score.' },
  { label: 'Source SAP FICO MY', action: 'coach_prompt' as const, prompt: 'Where can I source SAP FICO consultants in Malaysia? Portals, communities, keywords, alternative titles, nearby countries, salary, hiring difficulty.' },
  { label: 'Generate Boolean', action: 'coach_prompt' as const, prompt: 'Create boolean search strings for my top open roles using tenant job titles and skills. If no jobs exist in my data, say so and provide a reusable boolean template.' },
  { label: 'Find candidates', action: 'navigate' as const, tab: 'candidates' },
  { label: 'AI Screen', action: 'navigate' as const, tab: 'screen' },
  { label: 'Write email', action: 'compose' as const, channel: 'email' },
  { label: 'Offer letter draft', action: 'coach_prompt' as const, prompt: 'Draft a professional offer letter template suitable for Malaysia hiring. Note any fields that must come from tenant offer data.' },
  { label: 'Interview questions', action: 'compose' as const, channel: 'interview_questions' },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)))
  } catch { /* ignore quota */ }
}

export function CoachTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const existing = loadSessions()
    if (existing.length > 0) {
      setSessions(existing)
      setActiveId(existing[0].id)
      return
    }
    const welcome: ChatSession = {
      id: uid(),
      title: 'New chat',
      updatedAt: Date.now(),
      messages: [{
        id: uid(),
        role: 'assistant',
        at: Date.now(),
        content: 'I am SmartRecruit AI — your Senior Recruitment Director copilot (20+ years).\n\nI detect intent and use your workspace data first. Ask me to:\n• Generate Java JD Kuala Lumpur\n• Generate WhatsApp Follow-up\n• Compare Candidate A vs B\n• Where can I source SAP FICO in Malaysia?\n\nNever expect generic chatbot answers.',
      }],
    }
    setSessions([welcome])
    setActiveId(welcome.id)
    saveSessions([welcome])
  }, [])

  const active = sessions.find(s => s.id === activeId) ?? sessions[0]

  const persist = useCallback((next: ChatSession[]) => {
    setSessions(next)
    saveSessions(next)
  }, [])

  const updateActive = useCallback((updater: (s: ChatSession) => ChatSession) => {
    setSessions(prev => {
      const next = prev.map(s => (s.id === (active?.id) ? updater(s) : s))
      saveSessions(next)
      return next
    })
  }, [active?.id])

  const newChat = () => {
    const s: ChatSession = {
      id: uid(),
      title: 'New chat',
      updatedAt: Date.now(),
      messages: [{
        id: uid(),
        role: 'assistant',
        at: Date.now(),
        content: 'New conversation started. Ask about pipeline priorities, JD writing, boolean search, or messaging templates.',
      }],
    }
    const next = [s, ...sessions]
    persist(next)
    setActiveId(s.id)
    setError(null)
  }

  const deleteChat = (id: string) => {
    const next = sessions.filter(s => s.id !== id)
    if (next.length === 0) {
      newChat()
      return
    }
    persist(next)
    if (activeId === id) setActiveId(next[0].id)
  }

  const runCoach = async (prompt?: string) => {
    if (!active) return
    const userText = (prompt ?? input).trim()
    if (!userText && !prompt) {
      // default KPI coaching when empty refresh
    }

    setLoading(true)
    setError(null)

    if (userText) {
      updateActive(s => ({
        ...s,
        title: s.title === 'New chat' ? userText.slice(0, 42) : s.title,
        updatedAt: Date.now(),
        messages: [...s.messages, { id: uid(), role: 'user', content: userText, at: Date.now() }],
      }))
      setInput('')
    } else {
      updateActive(s => ({
        ...s,
        updatedAt: Date.now(),
        messages: [...s.messages, { id: uid(), role: 'user', content: 'Give me today’s recruitment coaching tips from my KPIs.', at: Date.now() }],
      }))
    }

    try {
      const payloadPrompt = userText || 'Give me today’s recruitment coaching tips from my KPIs.'
      const historyMsgs = (active?.messages ?? [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))
      // include the just-added user turn if not already last
      if (userText && historyMsgs[historyMsgs.length - 1]?.content !== userText) {
        historyMsgs.push({ role: 'user', content: payloadPrompt })
      } else if (!userText) {
        historyMsgs.push({ role: 'user', content: payloadPrompt })
      }
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payloadPrompt,
          messages: historyMsgs,
          session_id: active?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? `Request failed (${res.status})`
        setError(msg)
        updateActive(s => ({
          ...s,
          messages: [...s.messages, { id: uid(), role: 'assistant', content: `I could not complete that request.\n\n${msg}`, at: Date.now() }],
        }))
        return
      }
      const text = data.suggestions ?? 'I could not find this information in your recruitment data.'
      updateActive(s => ({
        ...s,
        updatedAt: Date.now(),
        messages: [...s.messages, { id: uid(), role: 'assistant', content: text, at: Date.now() }],
      }))
    } catch {
      setError('Network error')
      updateActive(s => ({
        ...s,
        messages: [...s.messages, { id: uid(), role: 'assistant', content: 'Network error — could not reach SmartRecruit AI.', at: Date.now() }],
      }))
    } finally {
      setLoading(false)
    }
  }

  const runCompose = async (channel: string) => {
    if (!active) return
    setLoading(true)
    setError(null)
    const label = channel === 'whatsapp' ? 'WhatsApp template' : channel === 'interview_questions' ? 'Interview questions' : 'Email draft'
    updateActive(s => ({
      ...s,
      title: s.title === 'New chat' ? label : s.title,
      updatedAt: Date.now(),
      messages: [...s.messages, { id: uid(), role: 'user', content: `Generate: ${label}`, at: Date.now() }],
    }))

    try {
      const email_type = channel === 'whatsapp' ? 'whatsapp_followup'
        : channel === 'interview_questions' ? 'interview_invite'
        : 'interview_invite'
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          email_type,
          platform: channel === 'whatsapp' ? 'WhatsApp' : 'Email',
          tone: 'professional',
          custom_notes: channel === 'interview_questions'
            ? 'Also include a structured list of technical, HR, and behavioral interview questions in the message body.'
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? `Compose failed (${res.status})`
        setError(msg)
        updateActive(s => ({
          ...s,
          messages: [...s.messages, { id: uid(), role: 'assistant', content: `I could not generate that.\n\n${msg}\n\nYou can also open the Compose tab for full controls.`, at: Date.now() }],
        }))
        return
      }
      const text = data.content ?? data.text ?? data.result ?? 'I could not find this information in your recruitment data.'
      updateActive(s => ({
        ...s,
        messages: [...s.messages, { id: uid(), role: 'assistant', content: String(text), at: Date.now() }],
      }))
    } catch {
      updateActive(s => ({
        ...s,
        messages: [...s.messages, { id: uid(), role: 'assistant', content: 'Compose API unavailable. Open the Compose tab to continue.', at: Date.now() }],
      }))
    } finally {
      setLoading(false)
    }
  }

  const onChip = async (chip: typeof SUGGESTED[number]) => {
    if (chip.action === 'navigate' && chip.tab) {
      onNavigate?.(chip.tab)
      return
    }
    if (chip.action === 'compose') {
      await runCompose(chip.channel ?? 'email')
      return
    }
    if (chip.action === 'coach_prompt' && chip.prompt) {
      await runCoach(chip.prompt)
      return
    }
    await runCoach()
  }

  const filtered = sessions.filter(s =>
    !filter || s.title.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Sparkles className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-xl">SmartRecruit AI</h1>
            <p className="desc-text mt-1">
              Enterprise recruitment assistant — answers prioritize your workspace data only.
            </p>
          </div>
        </div>
      </div>

      <div className="copilot-shell mb-4">
        <aside className="copilot-sidebar">
          <button type="button" onClick={newChat} className="btn-primary w-full !justify-center">
            <Plus className="w-4 h-4" /> New chat
          </button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search chats"
              className="form-input !pl-8 !py-2 !text-xs"
            />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 pt-1">History</p>
          <ul className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {filtered.map(s => (
              <li key={s.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`flex-1 text-left px-2.5 py-2 rounded-lg text-xs font-semibold truncate ${
                    s.id === active?.id ? 'bg-[var(--color-primary)] text-white' : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
                  }`}
                >
                  {s.title}
                </button>
                <button
                  type="button"
                  title="Delete chat"
                  onClick={() => deleteChat(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[10px] font-medium text-slate-400 px-1">
            Pinned folders &amp; attachments come in a later release.
          </p>
        </aside>

        <div className="flex flex-col min-h-0 min-w-0">
          <div className="copilot-messages">
            {(active?.messages ?? []).map(m => (
              <div
                key={m.id}
                className={`copilot-bubble ${m.role === 'user' ? 'copilot-bubble--user' : 'copilot-bubble--assistant'}`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="copilot-bubble copilot-bubble--assistant flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" /> Thinking…
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 max-w-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </div>

          <div className="copilot-prompt">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SUGGESTED.map(chip => (
                <button key={chip.label} type="button" className="copilot-chip" disabled={loading} onClick={() => onChip(chip)}>
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={2}
                placeholder="Ask about pipeline priorities, coaching, or generate messaging…"
                className="form-input flex-1 !min-h-[52px] resize-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!loading) runCoach()
                  }
                }}
              />
              <button type="button" className="btn-ai !px-4 !py-3" disabled={loading} onClick={() => runCoach()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2 flex items-center gap-1">
              <MessageSquarePlus className="w-3 h-3" />
              Grounded on tenant KPIs &amp; compose tools. If data is missing, I will say so.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
