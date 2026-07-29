'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Shield, Smartphone, Monitor, LogOut, Download, Search,
  KeyRound, AlertTriangle, CheckCircle2, Clock, Lock,
} from 'lucide-react'

type Overview = {
  security_score: number
  mfa_enabled: boolean
  mfa_required: boolean
  active_sessions_mine: number
  active_sessions_tenant: number
  failed_logins_mine: number
  failed_logins_tenant: number
  last_success: { created_at: string; ip_address: string | null } | null
  last_failure: { created_at: string; ip_address: string | null; failure_reason: string | null } | null
  password_policy: {
    min_length: number
    require_uppercase: boolean
    require_lowercase: boolean
    require_number: boolean
    require_special: boolean
    max_login_attempts: number
    lock_duration_minutes: number
    mfa_required: boolean
  }
  recent_events: { action: string; user_email: string; created_at: string; result: string }[]
  is_admin: boolean
  placeholders: { export_pack: boolean; support_access: boolean; backup_status: string }
}

type SessionRow = {
  id: string
  device_name: string
  browser: string
  os: string
  device_type: string
  ip_address: string | null
  started_at: string
  last_activity: string
  is_active: boolean
  is_current: boolean
}

type LoginRow = {
  id: string
  email: string
  user_name: string | null
  success: boolean
  ip_address: string | null
  created_at: string
  failure_reason: string | null
  browser: string | null
  os: string | null
}

function fmt(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString() } catch { return d }
}

export function SecurityCenterTab({ onOpenMfa }: { onOpenMfa?: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [logins, setLogins] = useState<LoginRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [successFilter, setSuccessFilter] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: '30', limit: '50' })
      if (q) params.set('q', q)
      if (successFilter) params.set('success', successFilter)
      const [o, s, l] = await Promise.all([
        fetch('/api/security/overview?days=7').then(r => r.ok ? r.json() : null),
        fetch('/api/security/sessions').then(r => r.ok ? r.json() : { sessions: [] }),
        fetch(`/api/security/login-history?${params}`).then(r => r.ok ? r.json() : { rows: [] }),
      ])
      if (o) setOverview(o)
      setSessions(s.sessions ?? [])
      setLogins(l.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [q, successFilter])

  useEffect(() => { void load() }, [load])

  async function terminate(sessionId: string) {
    setBusy(sessionId)
    await fetch('/api/security/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'terminate', session_id: sessionId }),
    })
    setBusy('')
    void load()
  }

  async function terminateOthers() {
    setBusy('others')
    await fetch('/api/security/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'terminate_others' }),
    })
    setBusy('')
    void load()
  }

  function exportCsv() {
    const params = new URLSearchParams({ export: 'csv', days: '90' })
    if (overview?.is_admin) params.set('scope', 'tenant')
    window.open(`/api/security/login-history?${params}`, '_blank')
  }

  if (loading && !overview) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  const policy = overview?.password_policy
  const current = sessions.filter(s => s.is_active && s.is_current)
  const others = sessions.filter(s => s.is_active && !s.is_current)

  return (
    <div className="max-w-5xl space-y-6">
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Shield className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Security Center</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sessions, login history, password policy, and trust controls</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Security score" value={`${overview?.security_score ?? '—'}%`} />
        <Kpi label="MFA" value={overview?.mfa_enabled ? 'Enabled' : 'Off'} hint={overview?.mfa_required ? 'Required by tenant' : undefined} />
        <Kpi label="Active sessions" value={String(overview?.active_sessions_mine ?? 0)} hint={overview?.is_admin ? `Tenant: ${overview.active_sessions_tenant}` : undefined} />
        <Kpi label="Failed logins (7d)" value={String(overview?.failed_logins_mine ?? 0)} hint={overview?.is_admin ? `Tenant: ${overview.failed_logins_tenant}` : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Last activity</p>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Success: {fmt(overview?.last_success?.created_at)} · {overview?.last_success?.ip_address || '—'}</p>
            <p className="flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" /> Failure: {fmt(overview?.last_failure?.created_at)} · {overview?.last_failure?.failure_reason || 'none'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Lock className="w-4 h-4" /> Password policy</p>
          {policy ? (
            <ul className="text-xs text-slate-600 space-y-1">
              <li>Min length: <strong>{policy.min_length}</strong></li>
              <li>Upper / lower / number: {policy.require_uppercase ? 'Y' : 'N'} / {policy.require_lowercase ? 'Y' : 'N'} / {policy.require_number ? 'Y' : 'N'}</li>
              <li>Special chars: {policy.require_special ? 'Required' : 'Optional'}</li>
              <li>Lockout: {policy.max_login_attempts} attempts · {policy.lock_duration_minutes} min</li>
            </ul>
          ) : <p className="text-sm text-slate-400">Default policy (8+ chars)</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenMfa?.()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50">
              <KeyRound className="w-3.5 h-3.5" /> Manage MFA
            </button>
            <a href="/trust" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50">
              Trust Center
            </a>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900">Active sessions</p>
          {others.length > 0 && (
            <button type="button" disabled={busy === 'others'} onClick={() => void terminateOthers()}
              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
              Sign out other devices
            </button>
          )}
        </div>
        <SessionGroup title="Current device" rows={current.length ? current : sessions.filter(s => s.is_current)} busy={busy} onTerminate={terminate} />
        <SessionGroup title="Other devices" rows={others} busy={busy} onTerminate={terminate} empty="No other active sessions." />
      </div>

      {/* Login history */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm font-bold text-slate-900">Login history</p>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email / IP…"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44" />
            </div>
            <select value={successFilter} onChange={e => setSuccessFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value="">All</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
            <button type="button" onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Result</th>
                <th className="py-2 pr-3">IP</th>
                <th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logins.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-slate-400 text-center">No login history yet.</td></tr>
              ) : logins.map(r => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3">{r.user_name || r.email || '—'}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${r.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {r.success ? 'OK' : 'Fail'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono">{r.ip_address || '—'}</td>
                  <td className="py-2 text-slate-500">{r.failure_reason || [r.browser, r.os].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Placeholders / links */}
      <div className="grid sm:grid-cols-3 gap-3" id="export-pack">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">Export pack</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed mb-3">
            Download candidates, jobs, audit, AI history, comms, and notes (admins).
          </p>
          {overview?.is_admin ? (
            <div className="flex flex-wrap gap-2">
              {['candidates', 'jobs', 'audit', 'ai', 'comms', 'notes', 'all'].map(t => (
                <a key={t} href={`/api/security/export-pack?type=${t}&format=${t === 'all' ? 'json' : 'csv'}`}
                  className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 capitalize">{t}</a>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Admin only</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4" id="support-access">
          <p className="text-sm font-bold text-slate-900">Support access</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed mb-2">
            Approve time-boxed platform support sessions from Governance.
          </p>
          <a href="#support-panel" className="text-xs font-bold text-indigo-700 hover:underline">Open panel ↓</a>
        </div>
        <PlaceholderCard title="Backups" body={`Status: ${overview?.placeholders?.backup_status ?? 'platform_managed'}`} />
      </div>

      <MfaPasswordPanel />
      {overview?.is_admin && <SupportAccessPanel />}
      {overview?.is_admin && <PolicyEditor />}

      {(overview?.recent_events?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">Recent security events</p>
          <ul className="space-y-2 text-xs max-h-48 overflow-y-auto">
            {overview!.recent_events.map((e, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-slate-50 pb-2">
                <span><strong>{e.action}</strong> · {e.user_email}</span>
                <span className="text-slate-400 whitespace-nowrap">{fmt(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function SessionGroup({
  title, rows, busy, onTerminate, empty,
}: {
  title: string
  rows: SessionRow[]
  busy: string
  onTerminate: (id: string) => void
  empty?: string
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{empty ?? 'None'}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(s => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3 min-w-0">
                {s.device_type === 'mobile'
                  ? <Smartphone className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  : <Monitor className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {s.device_name}
                    {s.is_current && <span className="ml-2 text-[10px] font-bold text-emerald-600">THIS DEVICE</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">{s.ip_address || '—'} · Last active {fmt(s.last_activity)}</p>
                </div>
              </div>
              {!s.is_current && s.is_active && (
                <button type="button" disabled={busy === s.id} onClick={() => onTerminate(s.id)}
                  className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50 flex-shrink-0">
                  <LogOut className="w-3.5 h-3.5" /> End
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlaceholderCard({ title, body, href }: { title: string; body: string; href?: string }) {
  const inner = (
    <>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{body}</p>
    </>
  )
  return href ? (
    <a href={href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 block">{inner}</a>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-4">{inner}</div>
  )
}

function MfaPasswordPanel() {
  const [mfa, setMfa] = useState<{ mfa_enabled: boolean } | null>(null)
  const [secret, setSecret] = useState('')
  const [otpUrl, setOtpUrl] = useState('')
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')

  useEffect(() => {
    void fetch('/api/security/mfa').then(r => r.ok ? r.json() : null).then(d => { if (d) setMfa(d) })
  }, [])

  async function beginMfa() {
    const res = await fetch('/api/security/mfa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'begin' }),
    })
    const data = await res.json()
    if (!res.ok) { setMsg(data.error || 'Failed'); return }
    setSecret(data.secret)
    setOtpUrl(data.otpauth_url)
    setMsg('Scan the secret in your authenticator, then confirm.')
  }

  async function confirmMfa() {
    const res = await fetch('/api/security/mfa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', code }),
    })
    const data = await res.json()
    if (!res.ok) { setMsg(data.error || 'Invalid code'); return }
    setRecovery(data.recovery_codes || [])
    setMfa({ mfa_enabled: true })
    setMsg('MFA enabled. Save your recovery codes.')
  }

  async function changePassword() {
    const res = await fetch('/api/security/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: curPw, new_password: newPw }),
    })
    const data = await res.json()
    setMsg(res.ok ? 'Password updated.' : (data.error || 'Failed'))
    if (res.ok) { setCurPw(''); setNewPw('') }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4" id="mfa">
      <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-4 h-4" /> MFA & password</p>
      <p className="text-xs text-slate-500">Authenticator MFA status: <strong>{mfa?.mfa_enabled ? 'Enabled' : 'Off'}</strong></p>
      {msg && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{msg}</p>}
      {!mfa?.mfa_enabled && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void beginMfa()} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white">Set up authenticator</button>
        </div>
      )}
      {secret && (
        <div className="text-xs space-y-2">
          <p className="font-mono break-all bg-slate-50 p-2 rounded border border-slate-100">Secret: {secret}</p>
          <p className="text-slate-400 break-all">{otpUrl}</p>
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
            <button type="button" onClick={() => void confirmMfa()} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200">Confirm</button>
          </div>
        </div>
      )}
      {recovery.length > 0 && (
        <ul className="text-xs font-mono grid sm:grid-cols-2 gap-1">
          {recovery.map(c => <li key={c} className="bg-amber-50 border border-amber-100 rounded px-2 py-1">{c}</li>)}
        </ul>
      )}
      <div className="border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-2">
        <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="Current password" className="border border-slate-200 rounded-lg px-3 py-2 text-xs" />
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" className="border border-slate-200 rounded-lg px-3 py-2 text-xs" />
        <button type="button" onClick={() => void changePassword()} className="sm:col-span-2 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50">Change password</button>
      </div>
    </div>
  )
}

function SupportAccessPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/security/support')
      if (res.ok) {
        const data = await res.json()
        setRows(data.requests ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(action: string, requestId: string) {
    await fetch('/api/security/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, request_id: requestId }),
    })
    void load()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" id="support-panel">
      <p className="text-sm font-bold text-slate-900 mb-3">Support access requests</p>
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No support requests.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {rows.map(r => (
            <li key={String(r.id)} className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-xl p-3">
              <div>
                <p className="font-semibold text-slate-800">{String(r.status).toUpperCase()} · {String(r.requester_email || '')}</p>
                <p className="text-slate-500 mt-0.5">{String(r.reason || '')}</p>
                <p className="text-slate-400 mt-0.5">{r.duration_hours as number}h · {fmt(r.created_at as string)}</p>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => void act('approve', String(r.id))} className="px-2 py-1 rounded bg-emerald-600 text-white font-bold">Approve</button>
                  <button type="button" onClick={() => void act('reject', String(r.id))} className="px-2 py-1 rounded border border-slate-200 font-bold">Reject</button>
                </div>
              )}
              {(r.status === 'approved' || Boolean(r.session_active)) && (
                <button type="button" onClick={() => void act('revoke', String(r.id))} className="px-2 py-1 rounded border border-red-200 text-red-600 font-bold">Revoke</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PolicyEditor() {
  const [minLen, setMinLen] = useState(8)
  const [mfaReq, setMfaReq] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void fetch('/api/security/policy').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.settings) {
        setMinLen(d.settings.min_length ?? 8)
        setMfaReq(Boolean(d.settings.mfa_required))
      }
    })
  }, [])

  async function save() {
    const res = await fetch('/api/security/policy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_length: minLen, mfa_required: mfaReq }),
    })
    setMsg(res.ok ? 'Policy saved.' : 'Failed to save policy')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-bold text-slate-900 mb-3">Tenant password / MFA policy</p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">Min length
          <input type="number" min={8} max={128} value={minLen} onChange={e => setMinLen(parseInt(e.target.value, 10) || 8)}
            className="w-16 border border-slate-200 rounded px-2 py-1" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mfaReq} onChange={e => setMfaReq(e.target.checked)} />
          Require MFA
        </label>
        <button type="button" onClick={() => void save()} className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">Save</button>
        {msg && <span className="text-slate-500">{msg}</span>}
      </div>
    </div>
  )
}
