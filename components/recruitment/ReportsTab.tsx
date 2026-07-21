'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download, FileText, Loader2, Save, Trash2,
  BarChart3, PieChart, LineChart, Activity, ExternalLink,
} from 'lucide-react'
import type { RecruiterKpi } from '@/lib/kpiEngine'
import { CardGridSkeleton, KpiStripSkeleton } from '@/components/ui/Skeletons'
import {
  AreaTrendChart,
  ColumnChart,
  FunnelDonut,
  FunnelPyramid,
  GaugeChart,
  PipelineBarChart,
  ReportCardVisual,
  CHART_PALETTE,
  type ReportVisualKind,
} from '@/components/ui/KpiVisuals'

type ReportFormat = 'csv' | 'xlsx' | 'pdf'

type ReportDef = {
  type: string
  label: string
  desc: string
  days: number
  formats: ReportFormat[]
  admin?: boolean
  href?: string
  visual: ReportVisualKind
  color: string
  /** Local 7/30/90 toggle on Recruiter Performance card only */
  kpiDaysToggle?: boolean
  /** Navigation CTA instead of (or in addition to) download */
  navigateTab?: string
  navigateLabel?: string
  /** When true and no onNavigate, keep desc as-is (fallback copy already in desc) */
  navigateOptional?: boolean
}

type ReportCategory = {
  id: string
  title: string
  reports: ReportDef[]
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

type Insights = {
  submission_trend?: { d: string; n: number }[]
  interview_trend?: { d: string; n: number }[]
  offer_trend?: { d: string; n: number }[]
  funnel?: Record<string, number>
  aging?: { bucket: string; n: number }[]
  pending_docs?: number
  time_to_hire_avg_days?: number | null
  offer_acceptance_rate?: number | null
  queues?: {
    source_performance?: { source: string; n: number }[]
  }
}

const CATEGORIZED: ReportCategory[] = [
  {
    id: 'recruitment',
    title: 'Recruitment',
    reports: [
      { type: 'jobs', label: 'Job Report', desc: 'Open roles, status & pipeline depth', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'columns', color: '#4f46e5' },
      { type: 'candidates', label: 'Candidate Report', desc: 'Full candidate tracker export', days: 0, formats: ['csv'], href: '/api/candidates/export', visual: 'bars', color: '#475569' },
      { type: 'submissions', label: 'Submission', desc: 'All submissions export', days: 90, formats: ['csv'], href: '/api/submissions/export', visual: 'area', color: '#0284c7' },
      { type: 'interviews', label: 'Interview', desc: 'Interview outcomes & volume', days: 30, formats: ['csv', 'xlsx', 'pdf'], visual: 'stacked', color: '#d97706' },
      { type: 'offers', label: 'Offer', desc: 'Offers by status', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'donut', color: '#059669' },
      { type: 'joining', label: 'Joining', desc: 'Joined / no-show / dropped', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'funnel', color: '#16a34a' },
      { type: 'drop', label: 'Drop', desc: 'Dropped / declined offers', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'scatter', color: '#e11d48' },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    reports: [
      { type: 'kpi', label: 'Recruiter Performance', desc: 'Personal KPI metrics', days: 30, formats: ['csv', 'xlsx', 'pdf'], visual: 'area', color: '#4f46e5', kpiDaysToggle: true },
      { type: 'productivity', label: 'Recruiter Productivity', desc: 'Activity throughput by recruiter', days: 30, formats: ['csv', 'xlsx', 'pdf'], visual: 'columns', color: '#0ea5e9' },
      { type: 'sources', label: 'Source Performance', desc: 'Candidates by source', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'donut', color: '#14b8a6' },
      { type: 'tth', label: 'Time To Hire', desc: 'Avg days resume → joined', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'gauge', color: '#8b5cf6' },
      { type: 'fill', label: 'Fill Ratio', desc: 'Hired vs pipeline', days: 30, formats: ['csv', 'xlsx', 'pdf'], visual: 'gauge', color: '#059669' },
      { type: 'aging', label: 'Aging Analysis', desc: 'Candidates by age bucket', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'bars', color: '#64748b' },
    ],
  },
  {
    id: 'hr',
    title: 'HR & Compliance',
    reports: [
      { type: 'visa', label: 'Visa Expiry', desc: 'Candidates with visa expiry', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'gauge', color: '#f59e0b' },
      { type: 'docs_expiry', label: 'Document Expiry', desc: 'Documents nearing expiry', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'scatter', color: '#ea580c' },
      {
        type: 'docs_expiry',
        label: 'Missing Documents',
        desc: 'Use Documents registry',
        days: 90,
        formats: [],
        visual: 'stacked',
        color: '#dc2626',
        navigateTab: 'documents',
        navigateLabel: 'Open Documents',
        navigateOptional: true,
      },
      {
        type: 'ess',
        label: 'Attendance / Leave',
        desc: 'Open ESS for attendance and leave',
        days: 0,
        formats: [],
        visual: 'area',
        color: '#0891b2',
        navigateTab: 'ess',
        navigateLabel: 'Open ESS',
      },
    ],
  },
  {
    id: 'executive',
    title: 'Executive',
    reports: [
      { type: 'funnel', label: 'Hiring Funnel', desc: 'Tenant funnel + submission stages', days: 90, formats: ['csv', 'xlsx', 'pdf'], admin: true, visual: 'funnel', color: '#7c3aed' },
      { type: 'clients', label: 'Client Performance', desc: 'Submissions by client', days: 90, formats: ['csv', 'xlsx', 'pdf'], visual: 'bars', color: '#6366f1' },
      {
        type: 'coach',
        label: 'AI Insights',
        desc: 'Open Copilot for hiring insights',
        days: 0,
        formats: [],
        visual: 'donut',
        color: '#4f46e5',
        navigateTab: 'coach',
        navigateLabel: 'Open Copilot',
      },
    ],
  },
]

const ALL_REPORTS = CATEGORIZED.flatMap(c => c.reports)

const FORMAT_LABELS: Record<ReportFormat, string> = {
  csv: 'CSV',
  xlsx: 'XLSX',
  pdf: 'PDF',
}

const VISUAL_ICON: Record<ReportVisualKind, typeof BarChart3> = {
  area: LineChart,
  columns: BarChart3,
  funnel: Activity,
  donut: PieChart,
  bars: BarChart3,
  gauge: Activity,
  stacked: BarChart3,
  scatter: Activity,
}

const KPI_DAY_OPTIONS = [7, 30, 90] as const

export function ReportsTab({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [saveName, setSaveName] = useState('')
  const [saveType, setSaveType] = useState('kpi')
  const [saveFormat, setSaveFormat] = useState<ReportFormat>('csv')
  const [saving, setSaving] = useState(false)
  const [kpi, setKpi] = useState<RecruiterKpi | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [kpiDays, setKpiDays] = useState<number>(30)

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

  const loadDashboard = useCallback(async () => {
    setDashLoading(true)
    try {
      const [kpiRes, insRes] = await Promise.all([
        fetch('/api/analytics/recruiter/me?days=30'),
        fetch('/api/dashboard/insights?days=30'),
      ])
      const kpiData = await kpiRes.json().catch(() => ({}))
      setKpi(kpiData.kpi ?? null)
      const insData = await insRes.json().catch(() => null)
      setInsights(insData)
    } finally {
      setDashLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])
  useEffect(() => { loadDashboard() }, [loadDashboard])

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
          filters: { days: saveType === 'kpi' ? kpiDays : 30 },
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

  const subTrend = useMemo(
    () => (insights?.submission_trend ?? []).map(t => t.n),
    [insights],
  )
  const intTrend = useMemo(
    () => (insights?.interview_trend ?? []).map(t => t.n),
    [insights],
  )
  const offerTrend = useMemo(
    () => (insights?.offer_trend ?? []).map(t => t.n),
    [insights],
  )

  const funnelStages = useMemo(() => {
    const f = insights?.funnel ?? kpi?.pipeline_by_stage ?? {}
    const order = ['sourced', 'applied', 'screening', 'interview', 'offer', 'hired']
    return order.map((k, i) => ({
      label: k,
      value: f[k] ?? 0,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }))
  }, [insights, kpi])

  const sourceSlices = useMemo(() => {
    const src = insights?.queues?.source_performance ?? []
    if (!src.length) {
      return [
        { label: 'LinkedIn', value: Math.max(1, kpi?.candidates_added ?? 0), color: CHART_PALETTE[0] },
        { label: 'Referral', value: Math.max(0, Math.floor((kpi?.submissions ?? 0) / 2)), color: CHART_PALETTE[1] },
        { label: 'Job board', value: Math.max(0, kpi?.candidates_screened ?? 0), color: CHART_PALETTE[2] },
        { label: 'Other', value: 1, color: CHART_PALETTE[3] },
      ]
    }
    return src.slice(0, 6).map((s, i) => ({
      label: s.source || 'Unknown',
      value: s.n,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }))
  }, [insights, kpi])

  const activitySlices = useMemo(() => [
    { label: 'Candidates', value: kpi?.candidates_added ?? 0, color: '#4f46e5' },
    { label: 'Screened', value: kpi?.candidates_screened ?? 0, color: '#7c3aed' },
    { label: 'Submissions', value: kpi?.submissions ?? 0, color: '#0284c7' },
    { label: 'Interviews', value: kpi?.interviews_scheduled ?? 0, color: '#d97706' },
    { label: 'Offers', value: kpi?.offers_active ?? 0, color: '#059669' },
  ], [kpi])

  const agingSeries = useMemo(
    () => (insights?.aging ?? []).map(a => a.n),
    [insights],
  )

  const cardSeries = (c: ReportDef): number[] | undefined => {
    if (c.type === 'submissions' || c.type === 'jobs') return subTrend.length ? subTrend : undefined
    if (c.type === 'interviews' || c.type === 'productivity') return intTrend.length ? intTrend : undefined
    if (c.type === 'offers' || c.type === 'joining' || c.type === 'drop') return offerTrend.length ? offerTrend : undefined
    if (c.type === 'aging') return agingSeries.length ? agingSeries : undefined
    if (c.type === 'kpi') {
      return [
        kpi?.candidates_added ?? 2,
        kpi?.candidates_screened ?? 2,
        kpi?.submissions ?? 1,
        kpi?.interviews_scheduled ?? 1,
        kpi?.offers_active ?? 1,
        kpi?.candidates_added ?? 2,
      ]
    }
    return undefined
  }

  const cardSlices = (c: ReportDef) => {
    if (c.visual === 'funnel' || c.type === 'funnel') return funnelStages
    if (c.type === 'sources' || c.type === 'joining') return sourceSlices
    if (c.type === 'offers') {
      return [
        { label: 'Active', value: kpi?.offers_active ?? 0, color: '#0ea5e9' },
        { label: 'Accepted', value: Math.round(((insights?.offer_acceptance_rate ?? 0) / 100) * (kpi?.offers_active ?? 1)), color: '#059669' },
        { label: 'Other', value: 1, color: '#94a3b8' },
      ]
    }
    return undefined
  }

  const cardGauge = (c: ReportDef) => {
    if (c.type === 'fill') {
      const hired = funnelStages.find(s => s.label === 'hired')?.value ?? 0
      const total = funnelStages.reduce((a, s) => a + s.value, 0) || 1
      return { value: Math.round((hired / total) * 100), max: 100 }
    }
    if (c.type === 'tth') {
      return { value: insights?.time_to_hire_avg_days ?? 0, max: 60 }
    }
    if (c.type === 'docs_expiry' || c.type === 'visa') {
      return { value: insights?.pending_docs ?? 0, max: Math.max(10, (insights?.pending_docs ?? 0) + 5) }
    }
    if (c.visual === 'gauge') {
      return { value: insights?.offer_acceptance_rate ?? kpi?.submission_conversion_rate ?? 0, max: 100 }
    }
    return undefined
  }

  const templateOptions = ALL_REPORTS.filter(r => r.formats.length > 0 && !r.navigateTab)

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-xl">Enterprise Reports</h1>
            <p className="desc-text mt-1 font-medium">
              Power BI–style analytics canvas + exportable CSV, XLSX & PDF packs
            </p>
          </div>
        </div>
      </div>

      {/* ── Dashboard Summary (live analytics canvas) ───────────────────── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-5 shadow-sm ring-1 ring-slate-950/[0.02]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600">Dashboard Summary</p>
            <p className="text-sm font-extrabold text-slate-900">Last 30 days · live tenant data</p>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
          >
            Refresh
          </button>
        </div>

        {dashLoading ? (
          <div className="space-y-4 py-2">
            <KpiStripSkeleton count={4} />
            <CardGridSkeleton count={3} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Candidates', value: kpi?.candidates_added ?? 0, tone: 'text-indigo-800 bg-indigo-50 border-indigo-100' },
                { label: 'Submissions', value: kpi?.submissions ?? 0, tone: 'text-sky-800 bg-sky-50 border-sky-100' },
                { label: 'Interviews', value: kpi?.interviews_scheduled ?? 0, tone: 'text-amber-800 bg-amber-50 border-amber-100' },
                { label: 'Offer accept', value: insights?.offer_acceptance_rate != null ? `${insights.offer_acceptance_rate}%` : `${kpi?.submission_conversion_rate ?? 0}%`, tone: 'text-emerald-800 bg-emerald-50 border-emerald-100' },
              ].map(m => (
                <div key={m.label} className={`rounded-xl border p-3 shadow-sm ${m.tone}`}>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide opacity-70">{m.label}</p>
                  <p className="text-2xl font-extrabold tabular-nums mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4 mb-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-extrabold text-slate-800 mb-2">Submission volume</p>
                <ColumnChart
                  series={(insights?.submission_trend ?? []).map(t => ({ label: t.d, value: t.n }))}
                  color="#4f46e5"
                  height={110}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-extrabold text-slate-800 mb-2">Interview trend</p>
                <AreaTrendChart series={intTrend.length ? intTrend : [0, 1, 0, 2, 1]} color="#d97706" height={110} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col items-center justify-center">
                <p className="text-xs font-extrabold text-slate-800 mb-1 self-start">Time to hire</p>
                <GaugeChart
                  value={insights?.time_to_hire_avg_days ?? 0}
                  max={60}
                  label="avg days"
                  color="#8b5cf6"
                />
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-extrabold text-slate-800 mb-3">Pipeline funnel</p>
                <FunnelPyramid stages={funnelStages} />
              </div>
              <FunnelDonut title="Activity mix" slices={activitySlices} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mt-4">
              <PipelineBarChart
                title="Pipeline by stage"
                data={insights?.funnel ?? kpi?.pipeline_by_stage ?? {}}
              />
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-extrabold text-slate-900 mb-3">Source mix</p>
                <ReportCardVisual kind="donut" color="#14b8a6" slices={sourceSlices} />
                {(insights?.aging?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs font-extrabold text-slate-700 mb-2">Aging buckets</p>
                    <ReportCardVisual
                      kind="bars"
                      color="#64748b"
                      series={(insights?.aging ?? []).map(a => a.n)}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
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
              {templateOptions.map(r => (
                <option key={`${r.type}-${r.label}`} value={r.type}>{r.label}</option>
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

      {CATEGORIZED.map(cat => (
        <section key={cat.id} className="mb-8">
          <h2 className="text-base font-extrabold text-slate-900 mb-3 tracking-tight">{cat.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.reports.map((c, i) => {
              const effectiveDays = c.kpiDaysToggle ? kpiDays : c.days
              const keyBase = `${c.type}-${effectiveDays}-${c.label}`
              const Icon = VISUAL_ICON[c.visual]
              const isNavOnly = c.formats.length === 0 && !!c.navigateTab

              return (
                <div
                  key={`${cat.id}-${c.label}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow ring-1 ring-slate-950/[0.02] flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center border"
                      style={{ background: `${c.color}14`, borderColor: `${c.color}33`, color: c.color }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                      {c.visual}
                    </span>
                  </div>

                  <div className="min-h-[72px] mb-3 flex items-center">
                    <ReportCardVisual
                      kind={c.visual}
                      color={c.color}
                      seed={i + 1 + cat.id.length}
                      series={cardSeries(c)}
                      slices={cardSlices(c)}
                      gauge={cardGauge(c)}
                    />
                  </div>

                  <h3 className="font-extrabold text-slate-900">{c.label}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1 mb-3 flex-1">
                    {c.navigateOptional && !onNavigate ? 'Use Documents registry' : c.desc}
                  </p>

                  {c.kpiDaysToggle && (
                    <div className="flex gap-1 mb-3">
                      {KPI_DAY_OPTIONS.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setKpiDays(d)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold border transition-colors ${
                            kpiDays === d
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-auto">
                    {c.formats.map(format => {
                      const key = `${keyBase}-${format}`
                      return (
                        <button
                          key={format}
                          type="button"
                          disabled={!!loading}
                          onClick={() => download(c.type, effectiveDays, format, c.href)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {loading === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          {FORMAT_LABELS[format]}
                        </button>
                      )
                    })}
                    {c.navigateTab && !(c.navigateOptional && !onNavigate) && (
                      <button
                        type="button"
                        onClick={() => onNavigate?.(c.navigateTab!)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-extrabold border ${
                          isNavOnly
                            ? 'text-indigo-800 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                            : 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <ExternalLink className="w-4 h-4" />
                        {c.navigateLabel ?? 'Open'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
