'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, Calendar, CheckCircle2, AlertTriangle, Unplug, RefreshCw, Info } from 'lucide-react'

type Conn = {
  id: string
  provider: string
  email_address?: string
  email?: string
  display_name?: string | null
  is_active: boolean
}

const EMAIL_CARDS = [
  { provider: 'gmail', label: 'Gmail', href: '/api/oauth/gmail', hint: 'Send via Google', color: 'text-red-600 bg-red-50 border-red-100' },
  { provider: 'outlook', label: 'Outlook', href: '/api/oauth/outlook', hint: 'Send via Microsoft · Teams meetings via Graph', color: 'text-blue-600 bg-blue-50 border-blue-100' },
] as const

const CAL_CARDS = [
  { provider: 'google', label: 'Google Calendar', href: '/api/oauth/gcal', hint: 'Schedule + Meet links', color: 'text-green-600 bg-green-50 border-green-100', short: 'Cal' },
  { provider: 'outlook', label: 'Outlook Calendar', href: '/api/oauth/outlookcal', hint: 'Schedule + Teams links', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', short: 'OC' },
] as const

export function EmailCalendarHub() {
  const [email, setEmail] = useState<Conn[]>([])
  const [calendar, setCalendar] = useState<Conn[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [e, c] = await Promise.all([
        fetch('/api/email/connections').then(r => r.ok ? r.json() : { connections: [] }),
        fetch('/api/calendar/connections').then(r => r.ok ? r.json() : { connections: [] }).catch(async () => {
          // Fallback: hub_status
          const hub = await fetch('/api/integrations/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'hub_status' }),
          }).then(r => r.ok ? r.json() : null)
          return { connections: hub?.calendar ?? [] }
        }),
      ])
      setEmail(e.connections ?? [])
      setCalendar(c.connections ?? c.calendar ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function findEmail(provider: string) {
    return email.find(c => c.provider === provider)
  }
  function findCal(provider: string) {
    return calendar.find(c => c.provider === provider)
  }

  async function test(type: 'email' | 'calendar', provider: string) {
    setBusy(`${type}:${provider}`)
    setMsg('')
    const res = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, provider }),
    })
    const data = await res.json()
    setBusy('')
    if (data.ok) {
      setMsg(`${provider}: OK (${data.latency_ms}ms)${data.email ? ` · ${data.email}` : ''}`)
    } else if (data.status === 'reconnect_required') {
      setMsg(`${provider}: Reconnect Required — ${data.error || 'token refresh failed'}`)
    } else {
      setMsg(`${provider}: ${data.error || data.status || 'failed'}`)
    }
    void load()
  }

  async function disconnect(kind: 'email' | 'calendar', provider: string) {
    setBusy(`disc:${kind}:${provider}`)
    if (kind === 'email') {
      await fetch(`/api/email/connections?provider=${provider}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/calendar/connections?provider=${provider}`, { method: 'DELETE' }).catch(() => {})
    }
    setBusy('')
    void load()
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Email &amp; Calendar</h2>
        </div>
        <p className="text-xs text-gray-400">
          Per-user Connect — one Azure/Google app for the product; each recruiter connects their own mailbox and calendar once.
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 flex gap-2 text-xs text-blue-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Teams online meetings use Outlook Calendar Graph when connected. WhatsApp Business Cloud (Meta) is configured under Integrations — Connected only after Test succeeds.
          Use Communications Hub for send history — no separate hub.
        </span>
      </div>

      {msg && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${msg.includes('OK') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {msg}
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Email</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EMAIL_CARDS.map(card => {
            const conn = findEmail(card.provider)
            const active = conn?.is_active
            const needsReconnect = conn && !conn.is_active
            return (
              <div key={card.provider} className="p-3 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${card.color}`}>
                      {card.provider === 'gmail' ? 'G' : 'O'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{card.label}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {active ? (conn?.email_address || 'Connected') : needsReconnect ? 'Reconnect required' : card.hint}
                      </p>
                    </div>
                  </div>
                  {active ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> :
                    needsReconnect ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!active && (
                    <a href={card.href} className="text-xs font-semibold text-blue-600 hover:underline">
                      {needsReconnect ? 'Reconnect' : 'Connect'} →
                    </a>
                  )}
                  {conn && (
                    <>
                      <button type="button" disabled={busy === `email:${card.provider}`}
                        onClick={() => void test('email', card.provider)}
                        className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Test
                      </button>
                      <button type="button" disabled={busy.startsWith('disc:email')}
                        onClick={() => void disconnect('email', card.provider)}
                        className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1">
                        <Unplug className="w-3 h-3" /> Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Calendar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAL_CARDS.map(card => {
            const conn = findCal(card.provider)
            const active = conn?.is_active
            const needsReconnect = conn && !conn.is_active
            const emailAddr = conn?.email_address || conn?.email
            return (
              <div key={card.provider} className="p-3 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${card.color}`}>
                      {card.short}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{card.label}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {active ? (emailAddr || 'Connected') : needsReconnect ? 'Reconnect required' : card.hint}
                      </p>
                    </div>
                  </div>
                  {active ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> :
                    needsReconnect ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!active && (
                    <a href={card.href} className="text-xs font-semibold text-green-700 hover:underline">
                      {needsReconnect ? 'Reconnect' : 'Connect'} →
                    </a>
                  )}
                  {conn && (
                    <>
                      <button type="button" disabled={busy === `calendar:${card.provider}`}
                        onClick={() => void test('calendar', card.provider)}
                        className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Test
                      </button>
                      <button type="button"
                        onClick={() => void disconnect('calendar', card.provider)}
                        className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1">
                        <Unplug className="w-3 h-3" /> Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
