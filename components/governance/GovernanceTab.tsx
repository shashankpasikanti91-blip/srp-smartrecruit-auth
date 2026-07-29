'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Shield, Users } from 'lucide-react'

type GovData = {
  period_days: number
  logins_count: number
  failed_logins_count: number
  active_sessions: number
  online_now?: number
  top_recruiters?: { name: string; email: string; screens: number }[]
  funnel?: { candidates?: number; submissions?: number; interviews?: number; offers?: number }
  activity_breakdown: { action: string; c: string }[]
  data_access_breakdown: { access_type: string; c: string }[]
  recent_logins: { name: string; email: string; created_at: string; ip_address: string | null }[]
  audit_logs: { action: string; resource_type: string; user_email: string; created_at: string; result: string }[]
}

export function GovernanceTab() {
  const [data, setData] = useState<GovData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/governance?days=7')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Shield className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">System Governance</h1>
            <p className="text-sm text-slate-500 mt-0.5">Login activity, sessions, and data access (last 7 days)</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400 uppercase font-bold">Successful logins</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{data?.logins_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400 uppercase font-bold">Failed logins</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{data?.failed_logins_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400 uppercase font-bold">Active sessions</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{data?.active_sessions ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400 uppercase font-bold">Online now</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{data?.online_now ?? 0}</p>
        </div>
      </div>

      {(data?.funnel || (data?.top_recruiters?.length ?? 0) > 0) && (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-bold text-slate-900 mb-3">Pipeline funnel</p>
            <ul className="text-sm space-y-1">
              <li className="flex justify-between"><span>Candidates</span><strong>{data?.funnel?.candidates ?? 0}</strong></li>
              <li className="flex justify-between"><span>Submissions</span><strong>{data?.funnel?.submissions ?? 0}</strong></li>
              <li className="flex justify-between"><span>Interviews</span><strong>{data?.funnel?.interviews ?? 0}</strong></li>
              <li className="flex justify-between"><span>Offers</span><strong>{data?.funnel?.offers ?? 0}</strong></li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-bold text-slate-900 mb-3">Top recruiters (AI screens)</p>
            {(data?.top_recruiters ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No screening activity in period.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {data!.top_recruiters!.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{r.name || r.email}</span>
                    <strong>{r.screens}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">Activity breakdown</p>
          {(data?.activity_breakdown ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No activity logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data!.activity_breakdown.map(r => (
                <li key={r.action} className="flex justify-between"><span>{r.action}</span><strong>{r.c}</strong></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">Data access breakdown</p>
          {(data?.data_access_breakdown ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No data access logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data!.data_access_breakdown.map(r => (
                <li key={r.access_type} className="flex justify-between"><span>{r.access_type}</span><strong>{r.c}</strong></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Recent logins</p>
          {(data?.recent_logins ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No login history yet.</p>
          ) : (
            <ul className="space-y-2 text-xs max-h-64 overflow-y-auto">
              {data!.recent_logins.map((l, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 pb-2">
                  <span>{l.name || l.email}</span>
                  <span className="text-slate-400">{new Date(l.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-bold text-slate-900 mb-3">Recent audit logs</p>
        {(data?.audit_logs ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No audit logs available.</p>
        ) : (
          <ul className="space-y-2 text-xs max-h-64 overflow-y-auto">
            {data!.audit_logs.map((log, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="min-w-0 truncate">{log.action} · {log.resource_type} · {log.user_email}</span>
                <span className="shrink-0 text-slate-400">{new Date(log.created_at).toLocaleString()} · {log.result}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
