'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Phone, Sparkles, UserPlus, Eye } from 'lucide-react'
import type { InternalMatchRow } from '@/lib/internalMatchTypes'

export function InternalMatchesTab({
  jobId,
  onOpenCandidate,
}: {
  jobId: string
  onOpenCandidate?: (id: string) => void
}) {
  const [matches, setMatches] = useState<InternalMatchRow[]>([])
  const [jobTitle, setJobTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [skill, setSkill] = useState('')
  const [minScore, setMinScore] = useState('0')
  const [notice, setNotice] = useState('')
  const [nationality, setNationality] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (location.trim()) params.set('location', location.trim())
      if (skill.trim()) params.set('skill', skill.trim())
      if (notice.trim()) params.set('notice', notice.trim())
      if (nationality.trim()) params.set('nationality', nationality.trim())
      if (minScore && minScore !== '0') params.set('min_score', minScore)
      const res = await fetch(`/api/jobs/${jobId}/internal-matches?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load matches')
        return
      }
      setMatches(data.matches ?? [])
      setJobTitle(data.job_title ?? '')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [jobId, location, skill, minScore, notice, nationality])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5">
        <p className="text-sm font-extrabold text-teal-950">Best Internal Match</p>
        <p className="text-xs font-medium text-teal-900/80 mt-1">
          Tenant-only talent pool ranked for {jobTitle || 'this job'}. Hybrid score uses deep RAG + skills + graph when indexed. Never searches other workspaces.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
        <input value={skill} onChange={e => setSkill(e.target.value)} placeholder="Skill" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
        <input value={notice} onChange={e => setNotice(e.target.value)} placeholder="Notice" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
        <input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="Nationality" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
        <select value={minScore} onChange={e => setMinScore(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
          <option value="0">Any score</option>
          <option value="50">50+</option>
          <option value="70">70+</option>
          <option value="85">85+</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-teal-600" /></div>
      ) : error ? (
        <p className="text-sm font-bold text-rose-700 text-center py-8">{error}</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">No internal matches for these filters.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {matches.map(m => (
            <li key={m.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/80">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-slate-900">{m.candidate_name}</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {m.match_percent}% match
                  </span>
                  {m.ai_score != null && (
                    <span className="text-[10px] font-bold text-slate-500">AI {m.ai_score}</span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {[m.location, m.experience, m.notice_period, m.nationality, m.recruiter_name].filter(Boolean).join(' · ')}
                </p>
                {m.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {m.skills.slice(0, 6).map(s => (
                      <span key={s} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{s}</span>
                    ))}
                  </div>
                )}
                  {m.explain?.summary && (
                  <p className="text-[11px] font-semibold text-teal-800/90 mt-1.5">
                    Why: {m.explain.summary}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onOpenCandidate?.(m.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-extrabold">
                  <Eye className="w-3 h-3" /> View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenCandidate?.(m.id)
                  }}
                  title={m.explain?.summary ?? 'Open candidate'}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-[11px] font-extrabold text-teal-900"
                >
                  <Sparkles className="w-3 h-3" /> Why
                </button>
                <button type="button" onClick={() => onOpenCandidate?.(m.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-extrabold text-slate-700">
                  <UserPlus className="w-3 h-3" /> Pipeline
                </button>
                <button type="button" onClick={() => onOpenCandidate?.(m.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-extrabold text-slate-700">
                  <Phone className="w-3 h-3" /> Contact
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
