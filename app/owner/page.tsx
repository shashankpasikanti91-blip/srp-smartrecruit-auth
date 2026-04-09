'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Users, Briefcase, FileText, CreditCard, Activity, Zap, AlertCircle,
  TrendingUp, LogOut, RefreshCw, Bell, Shield, ChevronRight, CheckCircle2,
  Clock, XCircle, Send
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number; totalJobs: number; totalResumes: number
  totalSubs: number; totalTokenCostUsd: string; proUsers: number
}
interface User { id: string; name: string | null; email: string; role: string; created_at: string; is_active: boolean }
interface ActivityItem { id: string; user_id: string | null; event_type: string; severity: string; created_at: string; event_data: Record<string, unknown> | null; auth_users?: { name: string; email: string } }

type Tab = 'overview' | 'users' | 'activity' | 'jobs' | 'resumes' | 'subscriptions' | 'tokens'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',       label: 'Overview',       icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'users',          label: 'Users',          icon: <Users className="w-4 h-4" /> },
  { id: 'activity',       label: 'Activity Log',   icon: <Activity className="w-4 h-4" /> },
  { id: 'jobs',           label: 'Job Posts',      icon: <Briefcase className="w-4 h-4" /> },
  { id: 'resumes',        label: 'Resumes',        icon: <FileText className="w-4 h-4" /> },
  { id: 'subscriptions',  label: 'Subscriptions',  icon: <CreditCard className="w-4 h-4" /> },
  { id: 'tokens',         label: 'Token Usage',    icon: <Zap className="w-4 h-4" /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    info:     'bg-blue-500/10 text-blue-400',
    warning:  'bg-amber-500/10 text-amber-400',
    error:    'bg-red-500/10 text-red-400',
    critical: 'bg-red-600/20 text-red-300',
    active:   'bg-emerald-500/10 text-emerald-400',
    pending:  'bg-amber-500/10 text-amber-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] ?? 'bg-white/5 text-gray-400'}`}>
      {status}
    </span>
  )
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<Record<string, unknown[]>>({})
  const [loading, setLoading] = useState(false)
  const [testNotifStatus, setTestNotifStatus] = useState<string | null>(null)

  const user = session?.user
  const role = (user as Record<string, unknown> | undefined)?.role as string | undefined

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated' && role !== 'owner' && role !== 'admin') {
      const ownerEmails = ['pasikantishashank24@gmail.com']
      if (!ownerEmails.includes(user?.email ?? '')) {
        router.replace('/dashboard')
      }
    }
  }, [status, role, user, router])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?view=stats')
      const json = await res.json()
      setStats(json.stats)
    } finally { setLoading(false) }
  }, [])

  const fetchTab = useCallback(async (t: Tab) => {
    if (t === 'overview') { await fetchStats(); return }
    setLoading(true)
    try {
      const map: Record<Tab, string> = {
        overview: 'stats', users: 'users', activity: 'activity',
        jobs: 'jobs', resumes: 'resumes', subscriptions: 'subscriptions', tokens: 'tokens',
      }
      const res = await fetch(`/api/admin?view=${map[t]}`)
      const json = await res.json()
      const key = Object.keys(json)[0]
      setData(prev => ({ ...prev, [t]: json[key] }))
    } finally { setLoading(false) }
  }, [fetchStats])

  useEffect(() => { if (status === 'authenticated') { fetchStats(); fetchTab(tab) } }, [status])

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (!data[t] || t === 'overview') fetchTab(t)
  }

  const testNotifications = async () => {
    setTestNotifStatus('sending…')
    const res = await fetch('/api/notify/test', { method: 'POST' })
    const json = await res.json()
    setTestNotifStatus(`Telegram: ${json.results?.telegram ?? '?'} | Email: ${json.results?.email ?? '?'}`)
    setTimeout(() => setTestNotifStatus(null), 5000)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statCards = [
    { label: 'Total Users',      value: stats?.totalUsers ?? '—',      icon: <Users className="w-5 h-5" />,       color: 'from-indigo-500 to-indigo-700' },
    { label: 'Job Posts',        value: stats?.totalJobs ?? '—',       icon: <Briefcase className="w-5 h-5" />,   color: 'from-purple-500 to-purple-700' },
    { label: 'Resumes',          value: stats?.totalResumes ?? '—',    icon: <FileText className="w-5 h-5" />,    color: 'from-sky-500 to-sky-700' },
    { label: 'Pro Users',        value: stats?.proUsers ?? '—',        icon: <CreditCard className="w-5 h-5" />,  color: 'from-emerald-500 to-emerald-700' },
    { label: 'Subscriptions',    value: stats?.totalSubs ?? '—',       icon: <TrendingUp className="w-5 h-5" />,  color: 'from-amber-500 to-amber-700' },
    { label: 'AI Cost (USD)',     value: `$${stats?.totalTokenCostUsd ?? '0.0000'}`, icon: <Zap className="w-5 h-5" />, color: 'from-pink-500 to-pink-700' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-white/5 bg-[#0d0d1a] flex flex-col">
        <div className="p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm gradient-text">Owner Panel</span>
          </Link>
          <div className="mt-3 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Admin Access</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* Notification test */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <button
            onClick={testNotifications}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
          >
            <Bell className="w-3.5 h-3.5" /> Test Alerts
          </button>
          {testNotifStatus && (
            <p className="text-[10px] text-emerald-400 px-3 leading-relaxed">{testNotifStatus}</p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">
              {TABS.find(t => t.id === tab)?.label}
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">SRP AI Labs · Owner Dashboard</p>
          </div>
          <button
            onClick={() => fetchTab(tab)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-card text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="p-8">
          {/* ── Overview ──────────────────────────────────── */}
          {tab === 'overview' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {statCards.map(s => (
                  <div key={s.label} className="glass-card rounded-2xl p-5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>
                      {s.icon}
                    </div>
                    <div className="text-2xl font-extrabold text-white">{String(s.value)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick info */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> Owner Account
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Logged in as</p>
                    <p className="text-white font-medium">{user?.name}</p>
                    <p className="text-gray-400 text-xs">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Notifications</p>
                    <p className="text-white font-medium flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-indigo-400" /> Telegram + Email
                    </p>
                    <p className="text-gray-400 text-xs">pasikantishashank24@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Generic table view ─────────────────────────── */}
          {tab !== 'overview' && (
            <div className="glass-card rounded-2xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <TableView tab={tab} rows={data[tab] ?? []} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Table renderer ────────────────────────────────────────────────────────────
function TableView({ tab, rows }: { tab: Tab; rows: unknown[] }) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-600">
        <AlertCircle className="w-8 h-8 mb-3" />
        <p className="text-sm">No data yet</p>
      </div>
    )
  }

  const r = rows as Record<string, unknown>[]

  if (tab === 'users') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['Name','Email','Role','Active','Joined'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((u, i) => (
        <tr key={String(u.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-white font-medium">{String(u.name ?? '—')}</td>
          <td className="px-5 py-3 text-gray-400">{String(u.email)}</td>
          <td className="px-5 py-3"><StatusBadge status={String(u.role)} /></td>
          <td className="px-5 py-3">{u.is_active ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}</td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(u.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  if (tab === 'activity') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['Event','User','Severity','Time'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((a, i) => (
        <tr key={String(a.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-white font-mono text-xs">{String(a.event_type)}</td>
          <td className="px-5 py-3 text-gray-400 text-xs">
            {String((a.auth_users as Record<string, unknown> | null)?.email ?? '—')}
          </td>
          <td className="px-5 py-3"><StatusBadge status={String(a.severity)} /></td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(a.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  if (tab === 'jobs') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['ID','Title','Status','Company','Applications','Created'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((j, i) => (
        <tr key={String(j.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-gray-600 font-mono text-[10px]">{String(j.id).slice(0,8)}…</td>
          <td className="px-5 py-3 text-white font-medium">{String(j.title)}</td>
          <td className="px-5 py-3"><StatusBadge status={String(j.status)} /></td>
          <td className="px-5 py-3 text-gray-400 text-xs">{String(j.company ?? '—')}</td>
          <td className="px-5 py-3 text-gray-300">{String(j.applications_count)}</td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(j.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  if (tab === 'resumes') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['ID','Candidate','Email','AI Score','Status','Uploaded'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((rv, i) => (
        <tr key={String(rv.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-gray-600 font-mono text-[10px]">{String(rv.id).slice(0,8)}…</td>
          <td className="px-5 py-3 text-white font-medium">{String(rv.candidate_name ?? '—')}</td>
          <td className="px-5 py-3 text-gray-400 text-xs">{String(rv.candidate_email ?? '—')}</td>
          <td className="px-5 py-3">
            <span className="text-indigo-300 font-bold">
              {rv.ai_score != null ? `${rv.ai_score}%` : '—'}
            </span>
          </td>
          <td className="px-5 py-3"><StatusBadge status={String(rv.status)} /></td>
          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(String(rv.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  if (tab === 'subscriptions') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['User','Plan','Status','Amount','Period End'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((s, i) => (
        <tr key={String(s.id)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-gray-400 text-xs">
            {String((s.auth_users as Record<string, unknown> | null)?.email ?? '—')}
          </td>
          <td className="px-5 py-3 text-white font-semibold">{String(s.plan)}</td>
          <td className="px-5 py-3"><StatusBadge status={String(s.status)} /></td>
          <td className="px-5 py-3 text-gray-300">${((Number(s.amount_cents) ?? 0) / 100).toFixed(2)}</td>
          <td className="px-5 py-3 text-gray-500 text-xs">{s.current_period_end ? fmt(String(s.current_period_end)) : '—'}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  if (tab === 'tokens') return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-white/5">
        {['User','Model','Operation','Tokens','Cost','Time'].map(h => (
          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead>
      <tbody>{r.map((t, i) => (
        <tr key={String(t.id ?? i)} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
          <td className="px-5 py-3 text-gray-500 text-xs">{String(t.user_id ?? '').slice(0,8)}…</td>
          <td className="px-5 py-3 text-gray-300">{String(t.model)}</td>
          <td className="px-5 py-3 text-indigo-300 font-mono text-xs">{String(t.operation)}</td>
          <td className="px-5 py-3 text-white">{String((Number(t.prompt_tokens) + Number(t.completion_tokens)).toLocaleString())}</td>
          <td className="px-5 py-3 text-emerald-400">${Number(t.cost_usd).toFixed(6)}</td>
          <td className="px-5 py-3 text-gray-600 text-xs">{fmt(String(t.created_at))}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  return null
}
