'use client'

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, Loader2, Sparkles, TrendingUp, X } from 'lucide-react'
import { AiFitScoreCard } from '@/components/recruitment/AiFitScoreCard'
import type { AiFitScores } from '@/lib/aiFitScore'

const TABS = [
  'overview',
  'pipeline',
  'ranking',
  'submissions',
  'interviews',
  'offers',
  'similar_jobs',
  'market',
  'timeline',
] as const

type Job360Tab = typeof TABS[number]

const TAB_LABELS: Record<Job360Tab, string> = {
  overview: 'Overview',
  pipeline: 'Pipeline',
  ranking: 'Ranking',
  submissions: 'Submissions',
  interviews: 'Interviews',
  offers: 'Offers',
  similar_jobs: 'Similar Jobs',
  market: 'Market',
  timeline: 'Timeline',
}

type RankedCandidate = {
  id: string
  candidate_name?: string
  ai_score?: number
  ai_fit_scores?: Partial<AiFitScores>
  pipeline_stage?: string
}

type Job360Job = {
  id: string
  short_id?: string
  title: string
  company?: string | null
  location?: string | null
  status?: string | null
  type?: string | null
  description?: string | null
  requirements?: string | null
  optional_requirements?: string | null
  raw_jd_text?: string | null
  skills_mandatory?: string[] | null
  skills_required?: string[] | null
  tags?: string[] | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  max_budget?: number | null
  experience_min?: number | null
  experience_max?: number | null
  contract_duration?: string | null
  department?: string | null
  headcount?: number | null
  priority?: string | null
  hiring_manager?: string | null
  hiring_difficulty?: string | null
  client_name?: string | null
}

type Job360Data = {
  job?: Job360Job
  required_skills?: string[]
  pipeline?: Record<string, number>
  ranking?: RankedCandidate[]
  submissions?: unknown[]
  interviews?: unknown[]
  offers?: unknown[]
  similar_jobs?: unknown[]
  market?: { insights?: Record<string, unknown>; salary_benchmark?: Record<string, unknown>; reasons?: string[] }
  timeline?: unknown[]
  hiring_difficulty?: string
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-sm font-bold text-slate-400 text-center py-10">No {label.toLowerCase()} yet</p>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      {children}
    </div>
  )
}

function SkillChips({ skills }: { skills: string[] }) {
  if (!skills.length) return <p className="text-sm font-medium text-slate-400">—</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map(s => (
        <span key={s} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
          {s}
        </span>
      ))}
    </div>
  )
}

function EntityList({
  items,
  onOpenCandidate,
  labelKey = 'candidate_name',
}: {
  items?: unknown[]
  onOpenCandidate?: (id: string) => void
  labelKey?: string
}) {
  if (!items?.length) return <EmptyHint label="records" />
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, i) => {
        const row = item as Record<string, unknown>
        const id = String(row.id ?? row.resume_id ?? '')
        const title = String(row[labelKey] ?? row.title ?? row.name ?? `Item ${i + 1}`)
        return (
          <li key={id || i} className="py-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-slate-900">{title}</p>
              {row.status != null && <p className="text-xs font-medium text-slate-500">{String(row.status)}</p>}
            </div>
            {id && onOpenCandidate && (
              <button
                type="button"
                onClick={() => onOpenCandidate(id)}
                className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900"
              >
                View →
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function fmtMoney(min?: number | null, max?: number | null, currency?: string | null) {
  if (min == null && max == null) return null
  const cur = currency || 'MYR'
  if (min != null && max != null) return `${cur} ${min.toLocaleString()} – ${max.toLocaleString()}`
  if (min != null) return `${cur} ${min.toLocaleString()}+`
  return `${cur} up to ${Number(max).toLocaleString()}`
}

function employmentLabel(type?: string | null) {
  const t = (type || '').toLowerCase()
  if (t === 'full-time') return 'Permanent / Full-time'
  if (t === 'contract') return 'Contract'
  if (t === 'part-time') return 'Part-time'
  if (t === 'remote') return 'Remote'
  if (t === 'internship') return 'Internship'
  return type || '—'
}

export function Job360View({
  jobId,
  onClose,
  onOpenCandidate,
  onNavigate,
  onGeneratePosts,
}: {
  jobId: string
  onClose: () => void
  onOpenCandidate?: (id: string) => void
  onNavigate?: (tab: string) => void
  onGeneratePosts?: (job: Job360Job) => void
}) {
  const [tab, setTab] = useState<Job360Tab>('overview')
  const [data, setData] = useState<Job360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reparsing, setReparsing] = useState(false)
  const [parseMsg, setParseMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/360`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        if (res.status === 404) {
          setData({ job: { id: jobId, title: 'Job' } })
          setError('360 view not available yet — showing shell')
        } else {
          setData({ job: { id: jobId, title: 'Job' } })
          setError(body.error || `Could not load job 360 (${res.status})`)
        }
        return
      }
      setData(await res.json())
    } catch {
      setData({ job: { id: jobId, title: 'Job' } })
      setError('Network error — limited view')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { load() }, [load])

  const job = data?.job

  const keySkills = [
    ...(Array.isArray(job?.skills_mandatory) ? job!.skills_mandatory! : []),
    ...(Array.isArray(job?.tags) ? job!.tags! : []),
    ...(Array.isArray(data?.required_skills) ? data!.required_skills! : []),
  ].filter((v, i, a) => v && a.indexOf(v) === i)

  const salary = fmtMoney(job?.salary_min, job?.salary_max, job?.currency)
  const hasStructured =
    Boolean(job?.description?.trim()) ||
    Boolean(job?.requirements?.trim()) ||
    keySkills.length > 0
  const hasRaw = Boolean(job?.raw_jd_text?.trim())

  const reparseFromRaw = async () => {
    const raw = job?.raw_jd_text?.trim()
    if (!raw) {
      setParseMsg('No raw JD saved on this job. Upload/paste a JD when creating the job.')
      return
    }
    setReparsing(true)
    setParseMsg(null)
    try {
      const parseRes = await fetch('/api/jobs/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw, mode: 'ai' }),
      })
      const parsed = await parseRes.json()
      if (!parseRes.ok && !parsed.fields) {
        setParseMsg(parsed.error || 'Parse failed')
        return
      }
      const f = parsed.fields ?? {}
      const patch = {
        title: f.title || job?.title,
        location: f.location || job?.location,
        type: f.type || job?.type,
        department: f.department || job?.department,
        contract_duration: f.contract_duration || job?.contract_duration,
        experience_min: f.experience_min ?? job?.experience_min,
        experience_max: f.experience_max ?? job?.experience_max,
        salary_min: f.salary_min ?? job?.salary_min,
        salary_max: f.salary_max ?? job?.salary_max,
        currency: f.currency || job?.currency,
        description: f.description || job?.description,
        requirements: f.requirements || job?.requirements,
        optional_requirements: f.optional_requirements || job?.optional_requirements,
        skills_mandatory: f.skills_mandatory?.length ? f.skills_mandatory : job?.skills_mandatory,
        skills_required: f.skills_required?.length ? f.skills_required : job?.skills_required,
        tags: f.skills_mandatory?.length ? f.skills_mandatory : job?.tags,
        max_budget: f.max_budget ?? job?.max_budget,
        headcount: f.headcount ?? job?.headcount,
        priority: f.priority || job?.priority,
        raw_jd_text: raw,
      }
      const saveRes = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) {
        setParseMsg(saveData.error || 'Could not save parsed fields')
        return
      }
      setParseMsg('JD parsed and saved — About Role, Responsibilities, Requirements, Skills updated.')
      await load()
    } catch {
      setParseMsg('Network error while parsing JD')
    } finally {
      setReparsing(false)
    }
  }

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer-panel" style={{ maxWidth: 820 }}>
        <div className="drawer-header">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate page-title">{job?.title ?? 'Job 360°'}</h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {[job?.company || job?.client_name, job?.location, job?.status].filter(Boolean).join(' · ')}
                {job?.short_id ? ` · ${job.short_id}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onGeneratePosts && job && (
              <button
                type="button"
                onClick={() => onGeneratePosts(job)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate Posts
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-slate-200 gap-x-0.5 bg-white px-1 sticky top-0 z-10">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
                tab === t ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              {error && (
                <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{error}</p>
              )}
              {parseMsg && (
                <p className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4">{parseMsg}</p>
              )}

              {tab === 'overview' && (
                <div className="space-y-4">
                  {!hasStructured && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-sm font-extrabold text-amber-950">JD fields are empty</p>
                      <p className="text-xs font-medium text-amber-900">
                        This job was saved without Parse with AI. {hasRaw
                          ? 'Raw JD is available — click below to fill About Role, Responsibilities, Requirements, and Skills.'
                          : 'No raw JD on file. Create the job again with Upload/Paste + Parse with AI.'}
                      </p>
                      {hasRaw && (
                        <button
                          type="button"
                          disabled={reparsing}
                          onClick={reparseFromRaw}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-extrabold disabled:opacity-50"
                        >
                          {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Parse JD now & save fields
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[
                      ['Location', job?.location || '—'],
                      ['Employment', employmentLabel(job?.type)],
                      ['Experience', (job?.experience_min != null || job?.experience_max != null)
                        ? `${job?.experience_min ?? 0}–${job?.experience_max ?? '—'} yrs`
                        : '—'],
                      ['Salary', salary || '—'],
                      ['Budget', job?.max_budget != null ? `${job.currency || 'MYR'} ${Number(job.max_budget).toLocaleString()}` : '—'],
                      ['Headcount', job?.headcount != null ? String(job.headcount) : '—'],
                      ['Department', job?.department || '—'],
                      ['Contract duration', job?.contract_duration || '—'],
                      ['Priority', job?.priority || '—'],
                      ['Hiring manager', job?.hiring_manager || '—'],
                      ['Difficulty', job?.hiring_difficulty || data?.hiring_difficulty || '—'],
                      ['Client', job?.client_name || job?.company || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p>
                        <p className="text-sm font-extrabold text-slate-900 mt-1 capitalize">{value}</p>
                      </div>
                    ))}
                  </div>

                  <Section title="About the Role & Responsibilities">
                    {job?.description?.trim() ? (
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed">{job.description}</pre>
                    ) : (
                      <p className="text-sm font-medium text-slate-400">Not filled yet — parse the JD to populate this.</p>
                    )}
                  </Section>

                  <Section title="Requirements">
                    {job?.requirements?.trim() ? (
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed">{job.requirements}</pre>
                    ) : (
                      <p className="text-sm font-medium text-slate-400">Not filled yet.</p>
                    )}
                  </Section>

                  {job?.optional_requirements?.trim() ? (
                    <Section title="Nice-to-have">
                      <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed">{job.optional_requirements}</pre>
                    </Section>
                  ) : null}

                  <Section title="Key Skills">
                    <SkillChips skills={keySkills} />
                  </Section>

                  {hasRaw && (
                    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-xs font-extrabold text-slate-700">
                        Raw JD ({job!.raw_jd_text!.trim().length.toLocaleString()} chars)
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-slate-600 leading-relaxed">
                        {job!.raw_jd_text}
                      </pre>
                      {!hasStructured && (
                        <button
                          type="button"
                          disabled={reparsing}
                          onClick={reparseFromRaw}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold disabled:opacity-50"
                        >
                          {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Parse raw JD into fields
                        </button>
                      )}
                    </details>
                  )}

                  {hasStructured && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reparsing || !hasRaw}
                        onClick={reparseFromRaw}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Re-parse from raw JD
                      </button>
                      {onGeneratePosts && job && (
                        <button
                          type="button"
                          onClick={() => onGeneratePosts(job)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Generate Email / LinkedIn / WhatsApp posts
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'pipeline' && (
                <div>
                  {data?.pipeline && Object.keys(data.pipeline).length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Object.entries(data.pipeline).map(([stage, count]) => (
                        <div key={stage} className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-xl font-extrabold text-indigo-700">{count}</p>
                          <p className="text-[10px] font-extrabold text-slate-500 capitalize mt-1">{stage.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint label="pipeline stages" />
                  )}
                </div>
              )}

              {tab === 'ranking' && (
                <div className="space-y-3">
                  {!data?.ranking?.length ? (
                    <EmptyHint label="ranked candidates" />
                  ) : (
                    data.ranking.map((c, i) => (
                      <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-400">#{i + 1}</span>
                            <button
                              type="button"
                              onClick={() => onOpenCandidate?.(c.id)}
                              className="text-sm font-extrabold text-indigo-700 hover:underline"
                            >
                              {c.candidate_name ?? c.id.slice(0, 8)}
                            </button>
                          </div>
                          {c.ai_score != null && (
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {c.ai_score}%
                            </span>
                          )}
                        </div>
                        {c.ai_fit_scores?.overall != null && (
                          <AiFitScoreCard scores={c.ai_fit_scores as AiFitScores} compact />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'submissions' && <EntityList items={data?.submissions} onOpenCandidate={onOpenCandidate} />}
              {tab === 'interviews' && <EntityList items={data?.interviews} onOpenCandidate={onOpenCandidate} />}
              {tab === 'offers' && <EntityList items={data?.offers} onOpenCandidate={onOpenCandidate} />}
              {tab === 'similar_jobs' && <EntityList items={data?.similar_jobs} labelKey="title" />}
              {tab === 'market' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Market intelligence
                  </div>
                  {Array.isArray(data?.market?.reasons) && data!.market!.reasons!.length > 0 && (
                    <ul className="space-y-1.5">
                      {data!.market!.reasons!.map((r, i) => (
                        <li key={i} className="text-sm font-medium text-slate-700">• {r}</li>
                      ))}
                    </ul>
                  )}
                  {data?.market?.salary_benchmark && Object.keys(data.market.salary_benchmark).length > 0 ? (
                    <pre className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(data.market.salary_benchmark, null, 2)}
                    </pre>
                  ) : null}
                  {!data?.market?.reasons?.length && !data?.market?.salary_benchmark && (
                    <EmptyHint label="market data" />
                  )}
                </div>
              )}
              {tab === 'timeline' && <EntityList items={data?.timeline} labelKey="title" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
