'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  BarChart3, Bell, Briefcase, Check, ClipboardCheck, FileCheck,
  Loader2, RefreshCw, TrendingUp,
} from 'lucide-react'

type OfferRow = {
  id: string
  candidate_name?: string
  status?: string
  approval_status?: string
  offer_salary?: string
}

type NotificationRow = {
  id: string
  title: string
  body?: string
  created_at?: string
  read?: boolean
}

type Insights = {
  funnel?: Record<string, number>
  pending_docs?: number
  offer_acceptance_rate?: number | null
  time_to_hire_avg_days?: number | null
  queues?: {
    offers_pending?: { id: string; candidate_name?: string; status?: string }[]
    missing_documents?: { resume_id: string; candidate_name?: string; n?: number }[]
  }
}

type AttendanceRow = {
  id: string
  user_name?: string
  work_date?: string
  status?: string
}

function MobileCard({
  id,
  title,
  icon: Icon,
  children,
  action,
}: {
  id?: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section id={id} className="ess-panel mb-4">
      <div className="ess-panel__head">
        <p className="ess-panel__title flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-600" /> {title}
        </p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default function MobileManagerPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [offersRes, notifRes, insightsRes, attRes] = await Promise.all([
        fetch('/api/offers').catch(() => null),
        fetch('/api/notifications').catch(() => null),
        fetch('/api/dashboard/insights?days=30').catch(() => null),
        fetch('/api/ess/attendance?pending=1').catch(() => null),
      ])

      if (offersRes?.ok) {
        const d = await offersRes.json()
        const pending = (d.offers ?? []).filter(
          (o: OfferRow) => o.approval_status === 'pending' || o.status === 'pending_approval',
        )
        setOffers(pending.slice(0, 10))
      } else setOffers([])

      if (notifRes?.ok) {
        const d = await notifRes.json()
        setNotifications((d.notifications ?? []).slice(0, 8))
      } else setNotifications([])

      if (insightsRes?.ok) {
        setInsights(await insightsRes.json())
      } else setInsights(null)

      if (attRes?.ok) {
        const d = await attRes.json()
        setAttendance((d.pending ?? d.records ?? d.attendance ?? []).slice(0, 8))
      } else setAttendance([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, load])

  const approveOffer = async (id: string) => {
    setActing(id)
    setMsg(null)
    try {
      const res = await fetch(`/api/offers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: 'approved' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setMsg(d.error ?? 'Approval failed')
        return
      }
      setMsg('Offer approved')
      await load()
    } finally {
      setActing(null)
    }
  }

  const approveAttendance = async (id: string) => {
    setActing(`att-${id}`)
    setMsg(null)
    try {
      const res = await fetch('/api/ess/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' }),
      })
      if (!res.ok) {
        setMsg('Attendance approval unavailable')
        return
      }
      setMsg('Attendance approved')
      await load()
    } finally {
      setActing(null)
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  const pendingDocs = insights?.queues?.missing_documents ?? []
  const kpis = [
    { label: 'Pending docs', value: insights?.pending_docs ?? pendingDocs.length, tone: 'text-amber-700' },
    { label: 'Offer accept %', value: insights?.offer_acceptance_rate != null ? `${Math.round(insights.offer_acceptance_rate)}%` : '—', tone: 'text-emerald-700' },
    { label: 'Avg time to hire', value: insights?.time_to_hire_avg_days != null ? `${insights.time_to_hire_avg_days}d` : '—', tone: 'text-indigo-700' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 page-title">Today</h2>
          <p className="text-xs font-semibold text-slate-500">Manager approvals &amp; KPIs</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {msg && (
        <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">{msg}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          <MobileCard title="Dashboard KPIs" icon={TrendingUp} action={
            <Link href="/dashboard" className="text-[10px] font-extrabold text-indigo-700">Open →</Link>
          }>
            <div className="grid grid-cols-3 gap-2">
              {kpis.map(k => (
                <div key={k.label} className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-center">
                  <p className={`text-lg font-extrabold ${k.tone}`}>{k.value}</p>
                  <p className="text-[10px] font-bold text-slate-500 leading-tight mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold"
            >
              <BarChart3 className="w-4 h-4" /> Full dashboard
            </Link>
          </MobileCard>

          <MobileCard id="offers" title="Approve offers" icon={Briefcase}>
            {offers.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 text-center py-4">No offers pending approval</p>
            ) : (
              <ul className="space-y-2">
                {offers.map(o => (
                  <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 truncate">{o.candidate_name ?? 'Candidate'}</p>
                      <p className="text-[10px] font-semibold text-slate-500 capitalize">{o.status?.replace(/_/g, ' ')}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!!acting}
                      onClick={() => approveOffer(o.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {acting === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </MobileCard>

          <MobileCard id="docs" title="Verify documents" icon={FileCheck}>
            {pendingDocs.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 text-center py-4">No document gaps flagged</p>
            ) : (
              <ul className="space-y-2">
                {pendingDocs.slice(0, 8).map(d => (
                  <li key={d.resume_id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-extrabold text-slate-900">{d.candidate_name ?? 'Candidate'}</p>
                    <p className="text-[10px] font-semibold text-amber-700 mt-0.5">{d.n ?? 'Multiple'} missing</p>
                    <Link href="/dashboard" className="text-[10px] font-extrabold text-indigo-700 mt-1 inline-block">Review in dashboard →</Link>
                  </li>
                ))}
              </ul>
            )}
          </MobileCard>

          <MobileCard id="notifications" title="Notifications" icon={Bell}>
            {notifications.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 text-center py-4">No notifications</p>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-1">
                {notifications.map(n => (
                  <li key={n.id} className="py-2.5 px-1">
                    <p className={`text-sm font-extrabold ${n.read ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</p>
                    {n.body && <p className="text-xs font-medium text-slate-500 line-clamp-2 mt-0.5">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </MobileCard>

          <MobileCard title="Approve attendance (ESS)" icon={ClipboardCheck}>
            {attendance.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 text-center py-4">No attendance pending approval</p>
            ) : (
              <ul className="space-y-2">
                {attendance.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{a.user_name ?? 'Employee'}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{a.work_date} · {a.status}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!!acting}
                      onClick={() => approveAttendance(a.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {acting === `att-${a.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </MobileCard>
        </>
      )}
    </div>
  )
}
