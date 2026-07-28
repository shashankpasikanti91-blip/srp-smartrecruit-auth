'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase, Calendar, Loader2, Sparkles, TrendingUp, Users, Bell, Send, Award,
  FileWarning, Clock, Target, BarChart3,
} from 'lucide-react'
import type { RecruiterKpi } from '@/lib/kpiEngine'
import { AgentInboxPanel } from '@/components/recruitment/AgentInboxPanel'
import { DailyBriefingPanel } from '@/components/recruitment/DailyBriefingPanel'
import { VisualWorkflow } from '@/components/recruitment/VisualWorkflow'
import { CardGridSkeleton, KpiStripSkeleton } from '@/components/ui/Skeletons'
import { HiringFunnelChart, TrendAreaChart, CHART_COLORS } from '@/components/analytics/HiringCharts'

type FollowUpRow = { id: string; title?: string; due_at?: string; status?: string }
type InterviewRow = {
  id: string; short_id?: string; scheduled_at?: string; status?: string
  candidate_name?: string; job_title?: string
}
type JobRow = { id: string; short_id?: string; title?: string; company?: string; status?: string }
type Insights = {
  submission_trend: { d: string; n: number }[]
  interview_trend: { d: string; n: number }[]
  offer_trend: { d: string; n: number }[]
  leaderboard: { name: string; email: string; submissions: number; interviews: number; offers: number }[]
  funnel: Record<string, number>
  aging: { bucket: string; n: number }[]
  pending_docs: number
  time_to_hire_avg_days: number | null
  offer_acceptance_rate: number | null
  recent_activities: { title: string; at: string; actor?: string }[]
  queues?: {
    jobs_attention?: { id: string; short_id?: string; title?: string; reason?: string }[]
    candidates_waiting?: { bucket: string; n: number }[]
    interviews_pending_feedback?: { id: string; short_id?: string; candidate_name?: string }[]
    offers_pending?: { id: string; short_id?: string; candidate_name?: string; status?: string }[]
    missing_documents?: { resume_id: string; candidate_name?: string; n?: number }[]
    joining_tomorrow?: { id: string; candidate_name?: string; expected_joining?: string }[]
    visa_expiry?: { id: string; candidate_name?: string; visa_expiry?: string }[]
    source_performance?: { source: string; n: number }[]
    ai_recommendations?: { id: string; title: string; agent_type?: string; rationale?: string | null }[]
  }
}

const FUNNEL_STAGES = ['sourced', 'applied', 'screening', 'interview', 'offer', 'hired'] as const

const FUNNEL_LABELS: Record<(typeof FUNNEL_STAGES)[number], string> = {
  sourced: 'Sourced',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
}

export function WorkspaceTab({
  onNavigate,
  userName,
}: {
  onNavigate?: (tab: string) => void
  userName?: string | null
}) {
  const [kpi, setKpi] = useState<RecruiterKpi | null>(null)
  const [coach, setCoach] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachLoading, setCoachLoading] = useState(false)
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date()
      const dateFrom = today.toISOString().slice(0, 10)
      const dateTo = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)

      const [kpiRes, fuRes, intRes, jobsRes, insRes] = await Promise.all([
        fetch('/api/analytics/recruiter/me?days=30'),
        fetch('/api/follow-ups?mine=1&bucket=today'),
        fetch(`/api/interviews?date_from=${dateFrom}&date_to=${dateTo}&status=scheduled`),
        fetch('/api/jobs'),
        fetch('/api/dashboard/insights?days=30'),
      ])

      const kpiData = await kpiRes.json().catch(() => ({}))
      setKpi(kpiData.kpi ?? null)

      const fuData = await fuRes.json().catch(() => ({}))
      setFollowUps(Array.isArray(fuData.follow_ups) ? fuData.follow_ups.slice(0, 5)
        : Array.isArray(fuData.items) ? fuData.items.slice(0, 5)
        : Array.isArray(fuData) ? fuData.slice(0, 5) : [])

      const intData = await intRes.json().catch(() => ({}))
      const intList = Array.isArray(intData.interviews) ? intData.interviews
        : Array.isArray(intData.items) ? intData.items
        : Array.isArray(intData) ? intData : []
      setInterviews(intList.slice(0, 5))

      const jobsData = await jobsRes.json().catch(() => ({}))
      const jobList = Array.isArray(jobsData.jobs) ? jobsData.jobs
        : Array.isArray(jobsData) ? jobsData : []
      setJobs(jobList.slice(0, 5))

      const insData = await insRes.json().catch(() => null)
      setInsights(insData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    // Auto-load AI insights once workspace data is ready (non-blocking)
    void loadCoach()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCoach = async () => {
    setCoachLoading(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Give me today\'s AI insights as a Senior Recruitment Director: hiring velocity risks, pipeline bottlenecks, and 3 concrete actions. Use tenant KPI data only.',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCoach(data.error ?? `SmartRecruit AI unavailable (${res.status})`)
        return
      }
      setCoach(data.suggestions ?? 'No suggestions returned')
    } catch {
      setCoach('Network error — could not reach SmartRecruit AI')
    } finally {
      setCoachLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <KpiStripSkeleton count={8} />
        <CardGridSkeleton count={3} />
      </div>
    )
  }

  const pipeline = { ...(kpi?.pipeline_by_stage ?? {}), ...(insights?.funnel ?? {}) }
  const openJobs = jobs.filter(j => (j.status ?? 'active') === 'active').length || jobs.length
  const activeCandidates = Object.values(pipeline).reduce((a, b) => a + b, 0)
  // kpiEngine already returns 0–100 percentages — do not multiply again
  const convRate = kpi ? Math.round(kpi.submission_conversion_rate || 0) : null
  const intConv = kpi ? Math.round(kpi.interview_conversion_rate || 0) : null
  const fillProxy = activeCandidates > 0 && kpi
    ? Math.round(((pipeline.hired ?? 0) / Math.max(activeCandidates, 1)) * 100)
    : null

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const greetName = userName?.split(' ')[0] || 'there'

  const kpis: { label: string; value: string | number; sub: string; warn?: boolean; tone: string }[] = [
    { label: 'Open Jobs', value: openJobs, sub: 'Active postings', tone: 'kpi-card--g1' },
    { label: 'Active Candidates', value: activeCandidates, sub: 'In pipeline', tone: 'kpi-card--g2' },
    { label: 'Submissions', value: kpi?.submissions ?? 0, sub: 'Last 30 days', tone: 'kpi-card--g3' },
    { label: 'Interviews', value: `${kpi?.interviews_scheduled ?? 0}`, sub: `${kpi?.interviews_completed ?? 0} completed`, tone: 'kpi-card--g4' },
    { label: 'Offers', value: kpi?.offers_active ?? 0, sub: 'Active offers', tone: 'kpi-card--g5' },
    { label: 'Time To Hire', value: insights?.time_to_hire_avg_days != null ? `${insights.time_to_hire_avg_days}d` : '—', sub: 'Avg days to join', tone: 'kpi-card--g6' },
    { label: 'Offer Accept %', value: insights?.offer_acceptance_rate != null ? `${insights.offer_acceptance_rate}%` : '—', sub: 'Acceptance rate', tone: 'kpi-card--g7' },
    { label: 'Fill Rate', value: fillProxy != null ? `${fillProxy}%` : '—', sub: 'Hired / pipeline', tone: 'kpi-card--g1' },
    { label: 'Pipeline Conv. %', value: convRate != null ? `${convRate}%` : '—', sub: 'Submission conversion', tone: 'kpi-card--g2' },
    { label: 'Interview Conv. %', value: intConv != null ? `${intConv}%` : '—', sub: 'Interview conversion', tone: 'kpi-card--g4' },
    { label: 'Pending Documents', value: insights?.pending_docs ?? 0, sub: 'Doc collection', warn: (insights?.pending_docs ?? 0) > 0, tone: 'kpi-card--g5' },
    { label: 'Follow-ups overdue', value: kpi?.follow_ups_overdue ?? 0, sub: 'Needs attention', warn: (kpi?.follow_ups_overdue ?? 0) > 0, tone: 'kpi-card--g3' },
  ]

  return (
    <div className="space-y-5">
      <div className="dash-section-head !border-0 !pb-0 !mb-2">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><TrendingUp className="w-5 h-5" /></div>
          <div>
            <h1 className="page-title text-xl sm:text-2xl">Dashboard</h1>
            <p className="desc-text mt-1">Welcome back, {greetName}. {dateLabel}</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Your recruitment command center — KPIs, queues, and AI briefing
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {kpis.map(c => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              const map: Record<string, string> = {
                'Open Jobs': 'jobs',
                'Active Candidates': 'candidates',
                Submissions: 'submissions',
                Interviews: 'interviews',
                Offers: 'selected',
                'Pending Documents': 'documents',
                'Follow-ups overdue': 'followups',
              }
              onNavigate?.(map[c.label] ?? 'workspace')
            }}
            className={`kpi-card kpi-card--gradient ${c.tone} ${c.warn ? 'ring-2 ring-amber-300' : ''} text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
          >
            <p className="kpi-card__label">{c.label}</p>
            <p className="kpi-card__value">{c.value}</p>
            <p className="kpi-card__sub">{c.sub}</p>
          </button>
        ))}
      </div>

      <DailyBriefingPanel onNavigate={onNavigate} />

      <VisualWorkflow
        counts={{
          requirement: openJobs,
          job: openJobs,
          candidates: activeCandidates,
          submissions: kpi?.submissions ?? 0,
          interviews: kpi?.interviews_scheduled ?? 0,
          offers: kpi?.offers_active ?? 0,
          joining: insights?.queues?.joining_tomorrow?.length ?? 0,
          completed: pipeline.hired ?? 0,
        }}
        onStageClick={(stage) => {
          const map: Record<string, string> = {
            requirement: 'jobs', job: 'jobs', candidates: 'candidates',
            submissions: 'submissions', interviews: 'interviews',
            offers: 'selected', joining: 'selected', completed: 'candidates',
          }
          onNavigate?.(map[stage] ?? 'workspace')
        }}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Briefcase className="w-4 h-4 text-rose-600" /> Jobs needing attention</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('jobs')}>Jobs</button>
          </div>
          <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {(insights?.queues?.jobs_attention ?? []).length === 0 ? (
              <li className="px-4 py-5 text-sm font-bold text-slate-500 text-center">All clear</li>
            ) : (insights?.queues?.jobs_attention ?? []).map(j => (
              <li key={j.id} className="px-4 py-2.5 text-sm">
                <p className="font-extrabold text-slate-900 truncate">{j.title || j.short_id}</p>
                <p className="text-xs font-medium text-rose-600">{j.reason}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> Interviews pending feedback</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('interviews')}>Open</button>
          </div>
          <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {(insights?.queues?.interviews_pending_feedback ?? []).length === 0 ? (
              <li className="px-4 py-5 text-sm font-bold text-slate-500 text-center">None waiting</li>
            ) : (insights?.queues?.interviews_pending_feedback ?? []).map(i => (
              <li key={i.id} className="px-4 py-2.5 text-sm font-extrabold text-slate-900 truncate">{i.candidate_name || i.short_id}</li>
            ))}
          </ul>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Award className="w-4 h-4 text-indigo-600" /> Offers pending acceptance</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('selected')}>Offers</button>
          </div>
          <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {(insights?.queues?.offers_pending ?? []).length === 0 ? (
              <li className="px-4 py-5 text-sm font-bold text-slate-500 text-center">None pending</li>
            ) : (insights?.queues?.offers_pending ?? []).map(o => (
              <li key={o.id} className="px-4 py-2.5 text-sm">
                <p className="font-extrabold text-slate-900 truncate">{o.candidate_name || o.short_id}</p>
                <p className="text-xs font-medium text-slate-500 capitalize">{(o.status ?? '').replace(/_/g, ' ')}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><FileWarning className="w-4 h-4 text-rose-500" /> Missing / rejected docs</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('documents')}>Docs</button>
          </div>
          <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {(insights?.queues?.missing_documents ?? []).length === 0 ? (
              <li className="px-4 py-4 text-xs font-bold text-slate-500 text-center">No gaps</li>
            ) : (insights?.queues?.missing_documents ?? []).map(d => (
              <li key={d.resume_id} className="px-4 py-2 text-xs font-bold text-slate-800">{d.candidate_name} · {d.n} docs</li>
            ))}
          </ul>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title">Joining tomorrow</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('selected')}>Open</button>
          </div>
          <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {(insights?.queues?.joining_tomorrow ?? []).length === 0 ? (
              <li className="px-4 py-4 text-xs font-bold text-slate-500 text-center">None</li>
            ) : (insights?.queues?.joining_tomorrow ?? []).map(j => (
              <li key={j.id} className="px-4 py-2 text-xs font-bold text-slate-800">{j.candidate_name}</li>
            ))}
          </ul>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title">Visa expiry (30d)</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('candidates')}>Candidates</button>
          </div>
          <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {(insights?.queues?.visa_expiry ?? []).length === 0 ? (
              <li className="px-4 py-4 text-xs font-bold text-slate-500 text-center">None soon</li>
            ) : (insights?.queues?.visa_expiry ?? []).map(v => (
              <li key={v.id} className="px-4 py-2 text-xs font-bold text-slate-800">{v.candidate_name} · {v.visa_expiry}</li>
            ))}
          </ul>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal-600" /> Source performance</p>
          </div>
          <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {(insights?.queues?.source_performance ?? []).length === 0 ? (
              <li className="px-4 py-4 text-xs font-bold text-slate-500 text-center">No source data</li>
            ) : (insights?.queues?.source_performance ?? []).map(s => (
              <li key={s.source} className="px-4 py-2 text-xs flex justify-between gap-2">
                <span className="font-bold text-slate-800 truncate">{s.source}</span>
                <span className="font-extrabold text-slate-900">{s.n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(insights?.queues?.ai_recommendations?.length ?? 0) > 0 && (
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" /> AI recommendations</p>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {(insights?.queues?.ai_recommendations ?? []).map(a => (
              <div key={a.id} className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs max-w-xs">
                <p className="font-extrabold text-indigo-900">{a.title}</p>
                {a.rationale && <p className="text-indigo-700/80 mt-0.5">{a.rationale}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-600" /> Submission Trend</p>
          </div>
          <div className="p-3"><TrendAreaChart data={insights?.submission_trend ?? []} color={CHART_COLORS.secondary} /></div>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-600" /> Interview Trend</p>
          </div>
          <div className="p-3"><TrendAreaChart data={insights?.interview_trend ?? []} color={CHART_COLORS.success} /></div>
        </div>
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Award className="w-4 h-4 text-amber-600" /> Offer Trend</p>
          </div>
          <div className="p-3"><TrendAreaChart data={insights?.offer_trend ?? []} color={CHART_COLORS.warning} /></div>
        </div>
      </div>

      <div className="ess-panel">
        <div className="ess-panel__head">
          <div>
            <p className="ess-panel__title">Hiring Funnel</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Pipeline conversion across stages · live tenant data</p>
          </div>
          <button type="button" className="btn-ghost text-xs !py-1.5 !px-2.5 font-bold" onClick={() => onNavigate?.('candidates')}>
            Open candidates
          </button>
        </div>
        <div className="p-4">
          <HiringFunnelChart
            stages={FUNNEL_STAGES.map(stage => ({
              key: stage,
              label: FUNNEL_LABELS[stage],
              count: pipeline[stage] ?? 0,
            }))}
            onStageClick={() => onNavigate?.('candidates')}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Target className="w-4 h-4 text-indigo-600" /> Recruiter Leaderboard</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {(insights?.leaderboard ?? []).length === 0 ? (
              <li className="px-4 py-6 text-sm font-bold text-slate-500 text-center">No recruiter activity yet.</li>
            ) : (insights?.leaderboard ?? []).map((r, i) => (
              <li key={r.email} className="px-4 py-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{r.name}</p>
                  <p className="text-[11px] font-medium text-slate-500">
                    {r.submissions} sub · {r.interviews} int · {r.offers} offers
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> Candidate Aging</p>
          </div>
          <div className="p-4 space-y-2">
            {(insights?.aging ?? []).length === 0 ? (
              <p className="text-sm font-bold text-slate-500 text-center py-4">No aging data</p>
            ) : (insights?.aging ?? []).map(a => {
              const max = Math.max(...(insights?.aging ?? []).map(x => x.n), 1)
              return (
                <div key={a.bucket} className="flex items-center gap-3">
                  <span className="w-14 text-xs font-extrabold text-slate-700">{a.bucket}</span>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-400" style={{ width: `${(a.n / max) * 100}%` }} />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800 w-8 text-right">{a.n}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Calendar className="w-4 h-4 text-[var(--color-primary)]" /> Upcoming Interviews</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('interviews')}>View all</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {interviews.length === 0 ? (
              <li className="px-4 py-6 text-sm font-bold text-slate-500 text-center">No interviews in the next 7 days.</li>
            ) : interviews.map(i => (
              <li key={i.id} className="px-4 py-3 text-sm">
                <p className="font-extrabold text-slate-900 truncate">{i.candidate_name || i.short_id || 'Interview'}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {i.job_title ? `${i.job_title} · ` : ''}
                  {i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : i.status}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" /> Upcoming Follow-ups</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('followups')}>View all</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {followUps.length === 0 ? (
              <li className="px-4 py-6 text-sm font-bold text-slate-500 text-center">No follow-ups due today.</li>
            ) : followUps.map(f => (
              <li key={f.id} className="px-4 py-3 text-sm">
                <p className="font-extrabold text-slate-900 truncate">{f.title || 'Follow-up'}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {f.due_at ? new Date(f.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : f.status}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="ess-panel">
          <div className="ess-panel__head">
            <p className="ess-panel__title flex items-center gap-2"><FileWarning className="w-4 h-4 text-rose-500" /> Pending Documents</p>
            <button type="button" className="text-xs font-extrabold text-[var(--color-primary)]" onClick={() => onNavigate?.('selected')}>Offers</button>
          </div>
          <div className="p-4">
            <p className="text-3xl font-extrabold text-slate-900">{insights?.pending_docs ?? 0}</p>
            <p className="text-xs font-bold text-slate-500 mt-1">Candidates in document collection / verification</p>
            <ul className="mt-4 divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {(insights?.recent_activities ?? []).slice(0, 5).map((a, i) => (
                <li key={i} className="py-2 text-xs">
                  <p className="font-bold text-slate-800 capitalize">{a.title}</p>
                  <p className="text-slate-500 font-medium">{new Date(a.at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <AgentInboxPanel onNavigate={(tab) => onNavigate?.(tab)} />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm text-slate-800">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-sm font-extrabold flex items-center gap-2 text-slate-800">
              <Sparkles className="w-4 h-4 text-indigo-600" /> AI Insights
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onNavigate?.('coach')} className="text-xs font-extrabold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
                Open AI
              </button>
              <button type="button" onClick={loadCoach} disabled={coachLoading} className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
                {coachLoading ? 'Thinking…' : 'Refresh'}
              </button>
            </div>
          </div>
          {coach ? (
            <div className="text-sm whitespace-pre-line leading-relaxed font-medium text-slate-700">{coach}</div>
          ) : (
            <p className="text-sm font-medium text-slate-500">
              Senior Recruitment Director insights grounded in your tenant KPIs, funnel, and hiring velocity.
            </p>
          )}
        </div>
      </div>

      <div className="ess-panel">
        <div className="ess-panel__head">
          <p className="ess-panel__title">Recent Activities</p>
        </div>
        <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
          {(insights?.recent_activities ?? []).length === 0 ? (
            <li className="px-4 py-6 text-sm font-bold text-slate-500 text-center">No recent activity.</li>
          ) : (insights?.recent_activities ?? []).map((a, i) => (
            <li key={i} className="px-4 py-2.5">
              <p className="text-sm font-bold text-slate-900 capitalize">{a.title}</p>
              <p className="text-[11px] font-medium text-slate-500">
                {new Date(a.at).toLocaleString()}{a.actor ? ` · ${a.actor}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="ess-panel">
        <div className="ess-panel__head">
          <p className="ess-panel__title">Quick links</p>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {[
            { tab: 'candidates', label: 'Candidates', icon: Users },
            { tab: 'followups', label: 'Follow-ups', icon: Bell },
            { tab: 'interviews', label: 'Interviews', icon: Calendar },
            { tab: 'submissions', label: 'Submissions', icon: Send },
            { tab: 'selected', label: 'Offers', icon: Award },
            { tab: 'jobs', label: 'Jobs', icon: Briefcase },
            { tab: 'coach', label: 'SmartRecruit AI', icon: Sparkles },
            { tab: 'hrconfig', label: 'HR Config', icon: FileWarning },
          ].map(l => (
            <button key={l.tab} type="button" onClick={() => onNavigate?.(l.tab)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-extrabold text-[var(--color-primary)] bg-indigo-50 border border-indigo-100 hover:bg-indigo-100">
              <l.icon className="w-3.5 h-3.5" /> {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
