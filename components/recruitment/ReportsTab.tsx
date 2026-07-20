'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Loader2, TrendingUp } from 'lucide-react'

export function ReportsTab() {
  const [loading, setLoading] = useState(false)

  const download = async (type: string, days: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?type=${type}&days=${days}`)
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? `${type}-report.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    { type: 'kpi', label: 'My KPI Report', desc: 'Personal recruitment metrics CSV', days: 30 },
    { type: 'kpi', label: 'Weekly KPI', desc: 'Last 7 days', days: 7 },
    { type: 'funnel', label: 'Tenant Funnel (Admin)', desc: 'Pipeline + submission stages', days: 90 },
  ]

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-0.5">Export recruitment data as CSV</p>
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <TrendingUp className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="font-semibold text-slate-900">{c.label}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">{c.desc}</p>
            <button
              disabled={loading}
              onClick={() => download(c.type, c.days)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {loading ? 'Exporting…' : 'Download CSV'}
            </button>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <FileText className="w-8 h-8 text-indigo-600 mb-3" />
          <h3 className="font-semibold text-slate-900">Candidates Export</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Full candidate tracker from Candidates tab filters</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              window.location.href = '/api/candidates/export'
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <FileText className="w-8 h-8 text-indigo-600 mb-3" />
          <h3 className="font-semibold text-slate-900">Submissions Export</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">All submissions queue</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              window.location.href = '/api/submissions/export'
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
        </div>
      </div>
    </div>
  )
}
