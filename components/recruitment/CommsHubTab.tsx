'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2, Mail, MessageCircle, RefreshCw, Send, Sparkles, Linkedin, Smartphone,
} from 'lucide-react'

type HubSection = 'email' | 'whatsapp' | 'linkedin' | 'sms' | 'send' | 'templates' | 'providers'
type CommLog = Record<string, unknown>

const PIPELINE = ['pending', 'sent', 'delivered', 'opened', 'read', 'failed'] as const

function statusTone(s: string) {
  if (s === 'sent' || s === 'delivered') return 'bg-green-50 text-green-700 border-green-200'
  if (s === 'opened' || s === 'read') return 'bg-sky-50 text-sky-700 border-sky-200'
  if (s === 'failed') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

function displayStatus(log: CommLog) {
  return String(log.delivery_status || log.status || 'pending')
}

export function CommsHubTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [section, setSection] = useState<HubSection>('email')
  const [providers, setProviders] = useState<Record<string, unknown>[]>([])
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([])
  const [logs, setLogs] = useState<CommLog[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState('')
  const [filterResume, setFilterResume] = useState('')
  const [filterJob, setFilterJob] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [channel, setChannel] = useState('smtp')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [linkResume, setLinkResume] = useState('')
  const [linkJob, setLinkJob] = useState('')
  const [linkClient, setLinkClient] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  const [providerChannel, setProviderChannel] = useState('smtp')
  const [providerConfig, setProviderConfig] = useState<Record<string, string>>({})
  const [savingProvider, setSavingProvider] = useState(false)

  const [tmplName, setTmplName] = useState('')
  const [tmplSubject, setTmplSubject] = useState('')
  const [tmplBody, setTmplBody] = useState('')
  const [tmplChannel, setTmplChannel] = useState('email')
  const [tmplPurpose, setTmplPurpose] = useState('custom')
  const [savingTmpl, setSavingTmpl] = useState(false)
  const [tmplResult, setTmplResult] = useState('')
  const [seedingTmpls, setSeedingTmpls] = useState(false)

  const channelToProvider: Record<string, string> = {
    smtp: 'smtp', outlook: 'outlook', sendgrid: 'sendgrid', mailgun: 'mailgun',
    telegram: 'telegram', whatsapp: 'whatsapp',
  }

  const PROVIDER_FIELDS: Record<string, { name: string; label: string; type?: string; placeholder?: string }[]> = {
    smtp: [{ name: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' }, { name: 'port', label: 'Port', placeholder: '587' }, { name: 'username', label: 'Username' }, { name: 'password', label: 'App Password', type: 'password' }, { name: 'from_email', label: 'From Email' }, { name: 'from_name', label: 'From Name' }],
    sendgrid: [{ name: 'api_key', label: 'SendGrid API Key', type: 'password' }, { name: 'from_email', label: 'Verified From Email' }, { name: 'from_name', label: 'From Name' }],
    mailgun: [{ name: 'api_key', label: 'Mailgun API Key', type: 'password' }, { name: 'domain', label: 'Mailgun Domain' }, { name: 'from_email', label: 'From Email' }],
    outlook: [{ name: 'host', label: 'SMTP Host', placeholder: 'smtp.office365.com' }, { name: 'port', label: 'Port', placeholder: '587' }, { name: 'username', label: 'Username' }, { name: 'password', label: 'Password', type: 'password' }, { name: 'from_email', label: 'From Email' }],
    telegram: [{ name: 'bot_token', label: 'Bot Token', type: 'password' }, { name: 'default_chat_id', label: 'Default Chat ID (optional)' }],
    whatsapp: [{ name: 'account_sid', label: 'Twilio Account SID' }, { name: 'auth_token', label: 'Twilio Auth Token', type: 'password' }, { name: 'whatsapp_number', label: 'WhatsApp Number', placeholder: 'whatsapp:+14155238886' }],
  }

  const CHANNELS = [
    { id: 'smtp', label: 'Email (SMTP)' }, { id: 'sendgrid', label: 'SendGrid' },
    { id: 'mailgun', label: 'Mailgun' }, { id: 'outlook', label: 'Outlook/O365' },
    { id: 'telegram', label: 'Telegram' }, { id: 'whatsapp', label: 'WhatsApp' },
  ]

  const loadMeta = useCallback(async () => {
    const [pl, tl] = await Promise.all([
      fetch('/api/comm?type=providers').then(r => r.json()),
      fetch('/api/comm?type=templates').then(r => r.json()),
    ])
    setProviders(pl.providers ?? [])
    setTemplates(tl.templates ?? [])
  }, [])

  const loadInbox = useCallback(async () => {
    if (section !== 'email' && section !== 'whatsapp') return
    setLoading(true)
    try {
      const q = new URLSearchParams({ type: 'logs', limit: '100' })
      q.set('channel', section)
      if (filterStatus) q.set('status', filterStatus)
      if (filterResume) q.set('resume_id', filterResume)
      if (filterJob) q.set('job_post_id', filterJob)
      if (filterClient) q.set('client_id', filterClient)
      if (filterFrom) q.set('date_from', filterFrom)
      if (filterTo) q.set('date_to', filterTo)
      const res = await fetch(`/api/comm?${q}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
      if (!selectedId && data.logs?.[0]?.id) setSelectedId(data.logs[0].id)
    } finally {
      setLoading(false)
    }
  }, [section, filterStatus, filterResume, filterJob, filterClient, filterFrom, filterTo, selectedId])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadInbox() }, [loadInbox])

  const selected = useMemo(() => logs.find(l => l.id === selectedId) ?? null, [logs, selectedId])

  const threadLogs = useMemo(() => {
    if (!selected) return []
    const key = String(selected.thread_key || selected.resume_id || selected.to_address || '')
    if (!key) return selected ? [selected] : []
    return logs.filter(l =>
      String(l.thread_key || l.resume_id || l.to_address || '') === key
    ).slice(0, 12)
  }, [logs, selected])

  async function seedDefaultTemplates() {
    setSeedingTmpls(true)
    try {
      const res = await fetch('/api/comm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_templates' }),
      })
      if (res.ok) await loadMeta()
    } finally {
      setSeedingTmpls(false)
    }
  }

  async function saveProvider() {
    setSavingProvider(true)
    await fetch('/api/comm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_provider', connector_id: providerChannel, config: providerConfig }),
    })
    setSavingProvider(false)
    setProviderConfig({})
    loadMeta()
  }

  async function saveTemplate() {
    setSavingTmpl(true); setTmplResult('')
    const res = await fetch('/api/comm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_template', name: tmplName, subject: tmplSubject, body: tmplBody, channel: tmplChannel, purpose: tmplPurpose }),
    })
    const data = await res.json()
    setSavingTmpl(false)
    setTmplResult(res.ok ? 'Template saved!' : `Error: ${data.error}`)
    if (res.ok) { setTmplName(''); setTmplSubject(''); setTmplBody(''); loadMeta() }
  }

  async function sendMsg() {
    setSending(true); setSendResult('')
    const body: Record<string, unknown> = {
      action: 'send',
      connector_id: channelToProvider[channel] ?? channel,
      to, subject, message,
    }
    if (selectedTemplate) body.template_id = selectedTemplate
    if (linkResume) body.resume_id = linkResume
    if (linkJob) body.job_post_id = linkJob
    if (linkClient) body.client_id = linkClient
    const res = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSending(false)
    setSendResult(res.ok ? '✓ Message sent!' : `Error: ${data.error}`)
    if (res.ok) {
      if (section === 'email' || section === 'whatsapp') loadInbox()
      else loadMeta()
    }
  }

  async function retryLog(id: string) {
    const res = await fetch('/api/comm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry', log_id: id }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error ?? 'Retry failed')
    await loadInbox()
  }

  async function markStatus(id: string, delivery_status: string) {
    await fetch('/api/comm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_status', log_id: id, delivery_status }),
    })
    await loadInbox()
  }

  const inboxTitle = section === 'email' ? 'Email Inbox' : 'WhatsApp Inbox'

  return (
    <div className="max-w-6xl space-y-6">
      <div className="dash-section-head">
        <div className="flex items-start gap-4 min-w-0">
          <div className="dash-section-icon">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              Communication Hub
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Email & WhatsApp inboxes, templates, delivery pipeline, and providers</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'email', label: 'Email Inbox', icon: Mail },
          { key: 'whatsapp', label: 'WhatsApp Inbox', icon: MessageCircle },
          { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
          { key: 'sms', label: 'SMS', icon: Smartphone },
          { key: 'send', label: 'Send' },
          { key: 'templates', label: 'Templates' },
          { key: 'providers', label: 'Providers' },
        ].map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key as HubSection)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border inline-flex items-center gap-1.5 ${
              section === s.key
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md shadow-indigo-900/20'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {'icon' in s && s.icon ? <s.icon className="w-3.5 h-3.5" /> : null}
            {s.label}
          </button>
        ))}
      </div>

      {(section === 'linkedin' || section === 'sms') && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm font-extrabold text-slate-800">{section === 'linkedin' ? 'LinkedIn Messages' : 'SMS'}</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Coming soon — schema hooks are ready; live provider integration is out of scope for this release.
          </p>
        </div>
      )}

      {(section === 'email' || section === 'whatsapp') && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <option value="">All statuses</option>
              {PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={filterResume} onChange={e => setFilterResume(e.target.value)} placeholder="Candidate UUID" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={filterJob} onChange={e => setFilterJob(e.target.value)} placeholder="Job UUID" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={filterClient} onChange={e => setFilterClient(e.target.value)} placeholder="Client UUID" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-4 min-h-[420px]">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-800">{inboxTitle}</h2>
                  <button type="button" onClick={loadInbox} className="text-xs text-indigo-600 inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[520px]">
                  {logs.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">No messages yet</p>
                  ) : logs.map(log => (
                    <button
                      key={String(log.id)}
                      type="button"
                      onClick={() => setSelectedId(String(log.id))}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${selectedId === log.id ? 'bg-indigo-50/70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{String(log.to_address)}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{String(log.subject || log.body_preview || '—')}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(String(log.created_at)).toLocaleString()}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 capitalize ${statusTone(displayStatus(log))}`}>
                          {displayStatus(log)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
                {!selected ? (
                  <p className="text-sm text-slate-400 text-center py-16">Select a thread</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{String(selected.subject || 'Message')}</h3>
                        <p className="text-sm text-slate-600 mt-1">To: {String(selected.to_address)}</p>
                        <p className="text-xs text-slate-400 mt-1 capitalize">
                          {String(selected.channel)} · {displayStatus(selected)}
                          {selected.resume_id ? ` · candidate ${String(selected.resume_id).slice(0, 8)}…` : ''}
                          {selected.job_post_id ? ` · job linked` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {displayStatus(selected) === 'failed' && (
                          <button type="button" onClick={() => retryLog(String(selected.id))} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white">
                            Retry
                          </button>
                        )}
                        <button type="button" onClick={() => markStatus(String(selected.id), 'delivered')} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
                          Mark delivered
                        </button>
                        <button type="button" onClick={() => markStatus(String(selected.id), 'read')} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
                          Mark read
                        </button>
                        {!!selected.resume_id && (
                          <button type="button" onClick={() => onNavigate?.('candidates')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100">
                            Open candidate
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {PIPELINE.map(s => {
                        const cur = displayStatus(selected)
                        const idx = PIPELINE.indexOf(s as typeof PIPELINE[number])
                        const curIdx = PIPELINE.indexOf(cur as typeof PIPELINE[number])
                        const active = idx <= Math.max(0, curIdx)
                        return (
                          <span key={s} className={`text-[10px] px-2 py-1 rounded-full border capitalize ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                            {s}
                          </span>
                        )
                      })}
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm whitespace-pre-wrap text-slate-800 min-h-[120px]">
                      {String(selected.body || selected.body_preview || '—')}
                    </div>

                    <div>
                      <p className="text-xs font-extrabold text-slate-700 mb-2">Thread timeline</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {threadLogs.map(t => (
                          <div key={String(t.id)} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2">
                            <span className="text-slate-600 truncate">{String(t.subject || t.body_preview || t.to_address)}</span>
                            <span className={`ml-2 capitalize px-1.5 py-0.5 rounded border ${statusTone(displayStatus(t))}`}>{displayStatus(t)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'send' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4 max-w-2xl">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
              {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Template (optional)</label>
            <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <option value="">— No template —</option>
              {templates.map(t => <option key={t.id as string} value={t.id as string}>{t.name as string}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">To</label>
            <input value={to} onChange={e => setTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" placeholder="candidate@email.com" />
          </div>
          {['smtp', 'sendgrid', 'mailgun', 'outlook'].includes(channel) && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none" />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={linkResume} onChange={e => setLinkResume(e.target.value)} placeholder="Candidate UUID" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={linkJob} onChange={e => setLinkJob(e.target.value)} placeholder="Job UUID" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={linkClient} onChange={e => setLinkClient(e.target.value)} placeholder="Client UUID" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </div>
          {sendResult && (
            <div className={`p-2 rounded-lg text-xs ${sendResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {sendResult}
            </div>
          )}
          <button type="button" onClick={sendMsg} disabled={sending || !to} className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 bg-blue-600 hover:bg-blue-700 inline-flex items-center justify-center gap-2">
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Send Message</>}
          </button>
        </div>
      )}

      {section === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Create Template</h3>
            <input value={tmplName} onChange={e => setTmplName(e.target.value)} placeholder="Template name" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={tmplChannel} onChange={e => setTmplChannel(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                {['email', 'whatsapp', 'telegram', 'sms', 'all'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={tmplPurpose} onChange={e => setTmplPurpose(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                {['interview_invite', 'shortlist', 'rejection', 'follow_up', 'offer', 'reminder', 'welcome', 'custom'].map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
              </select>
            </div>
            <input value={tmplSubject} onChange={e => setTmplSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <textarea value={tmplBody} onChange={e => setTmplBody(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none" placeholder="Dear {{name}}…" />
            {tmplResult && <div className={`p-2 rounded-lg text-xs ${tmplResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{tmplResult}</div>}
            <button type="button" onClick={saveTemplate} disabled={savingTmpl || !tmplName || !tmplBody} className="w-full py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 bg-blue-600">
              {savingTmpl ? 'Saving…' : 'Save Template'}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Saved Templates ({templates.length})</h3>
              {templates.length === 0 && (
                <button type="button" onClick={seedDefaultTemplates} disabled={seedingTmpls} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs disabled:opacity-50">
                  {seedingTmpls ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Load defaults
                </button>
              )}
            </div>
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id as string} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-sm font-medium text-gray-800">{t.name as string}</p>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">{t.channel as string} · {(t.purpose as string)?.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'providers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Configure Provider</h3>
            <select value={providerChannel} onChange={e => { setProviderChannel(e.target.value); setProviderConfig({}) }} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
              {Object.keys(PROVIDER_FIELDS).map(c => <option key={c} value={c}>{CHANNELS.find(ch => ch.id === c)?.label ?? c}</option>)}
            </select>
            {(PROVIDER_FIELDS[providerChannel] ?? []).map(field => (
              <div key={field.name}>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{field.label}</label>
                <input
                  type={field.type ?? 'text'}
                  value={providerConfig[field.name] ?? ''}
                  placeholder={field.placeholder ?? ''}
                  onChange={e => setProviderConfig(v => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>
            ))}
            <button type="button" onClick={saveProvider} disabled={savingProvider} className="w-full py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 bg-blue-600">
              {savingProvider ? 'Saving…' : 'Save Provider'}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Providers</h3>
            {providers.length === 0 ? <p className="text-xs text-gray-400 text-center py-6">No providers configured</p> : (
              <div className="space-y-2">
                {providers.map(p => (
                  <div key={p.id as string} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">{p.connector_id as string}</p>
                      <p className="text-xs text-gray-500">Channel: {p.channel as string}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
