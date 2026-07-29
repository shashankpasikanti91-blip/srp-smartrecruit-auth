'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Filter, Loader2, Search, Users } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'

type ApiCandidate = {
  id: string
  short_id?: string
  candidate_name: string
  candidate_email?: string | null
  ai_score?: number | null
  ai_skills?: string[]
  pipeline_stage?: string
  status?: string
  reviewer_notes?: string | null
  candidate_profile?: Record<string, unknown>
  uploaded_by?: { name: string | null; email: string | null } | null
  updated_at?: string
}

function safeStr(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function firstSkills(skills: string[] | undefined, limit = 3) {
  if (!skills?.length) return '—'
  return skills.slice(0, limit).join(', ')
}

export function InternalTalentPoolTab({}: {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const [location, setLocation] = useState('')

  const [rows, setRows] = useState<ApiCandidate[]>([])
  const [total, setTotal] = useState(0)

  const canSearch = useMemo(() => q.trim().length >= 1 || skill.trim().length >= 1 || location.trim().length >= 1, [q, skill, location])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '50')
      if (q.trim()) params.set('q', q.trim())
      if (skill.trim()) params.set('skill', skill.trim())
      if (location.trim()) params.set('location', location.trim())

      const res = await fetch(`/api/candidates?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Failed to load internal talent pool')
        return
      }
      setRows((data?.candidates ?? []) as ApiCandidate[])
      setTotal(Number(data?.total ?? (data?.candidates?.length ?? 0)))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [q, skill, location])

  useEffect(() => { void load() }, [load])

  const onSearch = () => { void load() }

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4 min-w-0">
          <div className="dash-section-icon">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>Internal Talent Pool</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total ? `${rows.length} of ${total}` : rows.length} candidate{rows.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-900/5 mb-5 ring-1 ring-slate-950/[0.02]">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-indigo-600" aria-hidden />
          <span className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Search</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name, skill keywords, or role…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-0.5">Skill</span>
            <input
              value={skill}
              onChange={e => setSkill(e.target.value)}
              placeholder="e.g. React"
              className="w-40 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-0.5">Location</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Bangalore"
              className="w-40 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={onSearch}
              disabled={!canSearch || loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-900/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <Briefcase className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No internal candidates match your search.</p>
          <p className="text-xs text-gray-400 max-w-xl">
            Tip: try a keyword like <span className="font-semibold">React</span>, a role like <span className="font-semibold">Java Developer</span>, or a location.
          </p>
        </div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Current Role</th>
                <th>Primary Skills</th>
                <th>Experience</th>
                <th>Location</th>
                <th>Notice</th>
                <th className="text-center">AI Score</th>
                <th>Status</th>
                <th>Recruiter</th>
                <th>Updated</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => {
                const prof = c.candidate_profile ?? {}
                const currentRole = safeStr((prof as Record<string, unknown>).current_title ?? (prof as Record<string, unknown>).current_role ?? '')
                const totalExp = safeStr((prof as Record<string, unknown>).total_experience ?? '')
                const loc = safeStr((prof as Record<string, unknown>).current_location ?? (prof as Record<string, unknown>).location ?? '')
                const notice = safeStr((prof as Record<string, unknown>).notice_period ?? '')
                const updated = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '—'
                const recruiter = c.uploaded_by?.name ?? c.uploaded_by?.email ?? '—'
                const status = c.pipeline_stage ?? c.status ?? '—'

                return (
                  <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td>
                      <div className="flex flex-col">
                        <p className="font-semibold text-gray-900 text-sm">{c.candidate_name}</p>
                        <p className="text-xs text-gray-500">{c.short_id ? `RES-${c.short_id}` : c.id.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="text-sm text-gray-700">{currentRole || '—'}</td>
                    <td className="text-sm text-gray-700">{firstSkills(c.ai_skills, 3)}</td>
                    <td className="text-sm text-gray-600">{totalExp || '—'}</td>
                    <td className="text-sm text-gray-600">{loc || '—'}</td>
                    <td className="text-sm text-gray-600">{notice || '—'}</td>
                    <td className="text-center text-sm text-gray-700">
                      {c.ai_score != null ? c.ai_score : <span className="text-gray-400">—</span>}
                    </td>
                    <td>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium border border-slate-200 bg-slate-50 text-slate-700">
                        {status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">{recruiter}</td>
                    <td className="text-sm text-gray-500 whitespace-nowrap">{updated}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.location.assign(`/dashboard/candidates/${c.id}`)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => window.location.assign(`/dashboard/candidates/${c.id}`)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200"
                          title="Open Candidate 360"
                        >
                          360
                        </button>
                        <button
                          type="button"
                          onClick={() => window.location.assign(`/dashboard/candidates/${c.id}`)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200"
                          title="Assign candidate to a job (use the Assign Job dropdown in Candidate 360)."
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => window.location.assign(`/dashboard/candidates/${c.id}`)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-violet-700 hover:text-violet-900 bg-violet-50 border border-violet-200"
                          title="Create submission (complete submission fields in Candidate 360 record)."
                        >
                          Submit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      )}
    </div>
  )
}

