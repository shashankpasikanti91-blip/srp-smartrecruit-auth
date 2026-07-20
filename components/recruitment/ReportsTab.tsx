'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Loader2, Save, Trash2, TrendingUp } from 'lucide-react'

type ReportFormat = 'csv' | 'xlsx' | 'pdf'

type ReportDef = {
  type: string
  label: string
  desc: string
  days: number
  formats: ReportFormat[]
  admin?: boolean
  href?: string
}

type SavedTemplate = {
  id: string
  name: string
  report_type: string
  format: string
  schedule_cron?: string | null
  is_active?: boolean
  last_run_at?: string | null
}

const REPORTS: ReportDef[] = [
  { type: 'kpi', label: 'Recruiter Performance', desc: 'Personal KPI metrics', days: 30, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'kpi', label: 'Weekly KPI', desc: 'Last 7 days performance', days: 7, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'funnel', label: 'Pipeline Conversion', desc: 'Tenant funnel + submission stages', days: 90, formats: ['csv', 'xlsx', 'pdf'], admin: true },
  { type: 'submissions', label: 'Submission Report', desc: 'All submissions export', days: 90, formats: ['csv'], href: '/api/submissions/export' },
  { type: 'interviews', label: 'Interview Report', desc: 'Interview outcomes & volume', days: 30, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'offers', label: 'Offer Report', desc: 'Offers by status', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'joining', label: 'Joining Report', desc: 'Joined / no-show / dropped', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'clients', label: 'Client Performance', desc: 'Submissions by client', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'sources', label: 'Source Performance', desc: 'Candidates by source', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'drop', label: 'Drop Report', desc: 'Dropped / declined offers', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'visa', label: 'Visa Report', desc: 'Candidates with visa expiry', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'docs_expiry', label: 'Document Expiry', desc: 'Documents nearing expiry', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'tth', label: 'Time To Hire', desc: 'Avg days resume → joined', days: 90, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'fill', label: 'Fill Ratio', desc: 'Hired vs pipeline', days: 30, formats: ['csv', 'xlsx', 'pdf'] },
  { type: 'candidates', label: 'Candidates Export', desc: 'Full candidate tracker', days: 0, formats: ['csv'], href: '/api/candidates/export' },
]

const FORMAT_LABELS: Record<ReportFormat, string> = {
  csv: 'CSV',
  xlsx: 'XLSX',
  pdf: 'PDF',
}

export function ReportsTab() {
  const [loading, setLoading] = useState<string | null>(null)
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [saveName, setSaveName] = useState('')
  const [saveType, setSaveType] = useState('kpi')
  const [saveFormat, setSaveFormat] = useState<ReportFormat>('csv')
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/reports/templates')
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const download = async (type: string, days: number, format: ReportFormat, href?: string) => {
    const key = `${type}-${days}-${format}`
    setLoading(key)
    try {
      const url = href ?? `/api/reports?type=${type}&days=${days}&format=${format}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Export failed')
        return
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        ?? `${type}-report.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } finally {
      setLoading(null)
    }
  }

  const saveTemplate = async () => {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          report_type: saveType,
          format: saveFormat,
          filters: { days: 30 },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Save failed')
        return
      }
      setSaveName('')
      await loadTemplates()
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this saved template?')) return
    await fetch('/api/reports/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    await loadTemplates()
  }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-xl">Enterprise Reports</h1>
            <p className="desc-text mt-1 font-medium">Exportable CSV, XLSX & PDF reports across the Recruitment OS</p>
          </div>
        </div>
      </div>

      <div className="ess-panel mb-5">
        <div className="ess-panel__head">
          <p className="ess-panel__title">Saved templates</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <input
              className="form-input font-bold flex-1 min-w-[160px]"
              placeholder="Template name"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
            />
            <select className="form-input font-bold" value={saveType} onChange={e => setSaveType(e.target.value)}>
              {REPORTS.filter(r => !r.href).map(r => (
                <option key={`${r.type}-${r.days}`} value={r.type}>{r.label}</option>
              ))}
            </select>
            <select className="form-input font-bold" value={saveFormat} onChange={e => setSaveFormat(e.target.value as ReportFormat)}>
              {(['csv', 'xlsx', 'pdf'] as ReportFormat[]).map(f => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
            <button type="button" onClick={saveTemplate} disabled={saving || !saveName.trim()}
              className="btn-primary inline-flex items-center gap-1.5 font-extrabold">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {templatesLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
          ) : templates.length === 0 ? (
            <p className="text-sm font-bold text-slate-500">No saved templates yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {templates.map(t => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">{t.name}</p>
                    <p className="text-xs font-bold text-slate-500">
                      {t.report_type} · {t.format.toUpperCase()}
                      {t.schedule_cron ? ` · cron: ${t.schedule_cron}` : ''}
                      {t.last_run_at ? ` · last run ${new Date(t.last_run_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => deleteTemplate(t.id)}
                    className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(c => {
          const keyBase = `${c.type}-${c.days}`
          return (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm hover:shadow-md transition-shadow">
              <TrendingUp className="w-7 h-7 text-indigo-600 mb-3" />
              <h3 className="font-extrabold text-slate-900">{c.label}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1 mb-4">{c.desc}</p>
              <div className="flex flex-wrap gap-2">
                {c.formats.map(format => {
                  const key = `${keyBase}-${format}`
                  return (
                    <button
                      key={format}
                      disabled={!!loading}
                      onClick={() => download(c.type, c.days, format, c.href)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {loading === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {FORMAT_LABELS[format]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
