'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Filter, Loader2, Search, Sparkles, Users, X } from 'lucide-react'
import { ScrollableTable } from '@/components/dashboard/ScrollableTable'
import { formatPhoneInternational } from '@/lib/phoneFormat'

type ApiCandidate = {
  id: string
  short_id?: string
  candidate_name: string
  candidate_email?: string | null
  candidate_phone?: string | null
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

const SKILL_CHIPS = ['React', 'Java', 'Python', 'SAP', 'AWS', 'Node.js', '.NET', 'DevOps']

export function InternalTalentPoolTab({}: {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const [location, setLocation] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

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
  const preview = previewId ? rows.find(r => r.id === previewId) : null

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4 min-w-0">
          <div className="dash-section-icon">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>Internal Talent Pool</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total ? `${rows.length} of ${total}` : rows.length} candidate{rows.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5 mb-5 ring-1 ring-slate-950/[0.02]">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-[#166534]" aria-hidden />
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#166534]">Search</span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSearch() }}
            placeholder="Search name, skill keywords, or role…"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15 shadow-inner"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {SKILL_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => setSkill(prev => prev === chip ? '' : chip)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition-all ${
                skill === chip
                  ? 'bg-[#166534] text-white border-[#166534]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#166534]/40'
              }`}
            >
              {chip}
            </button>
          ))}
          {(skill || location || q) && (
            <button
              type="button"
              onClick={() => { setQ(''); setSkill(''); setLocation('') }}
              className="px-3 py-1.5 rounded-full text-xs font-extrabold border border-slate-200 text-slate-500 inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wide px-0.5">Skill filter</span>
            <input
              value={skill}
              onChange={e => setSkill(e.target.value)}
              placeholder="e.g. React"
              className="w-40 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-[#c2410c] uppercase tracking-wide px-0.5">Location</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Bangalore"
              className="w-40 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
            />
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={onSearch}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors bg-[#F97316] hover:bg-[#ea580c] shadow-md shadow-orange-900/15 disabled:opacity-50"
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

      {preview && (
        <div className="mb-4 rounded-2xl border border-[#166534]/25 bg-gradient-to-br from-[#ecfdf3] to-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-900">{preview.candidate_name}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {preview.ai_score != null && (
                  <span className="ui-badge ui-badge--purple inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI {preview.ai_score}
                  </span>
                )}
                <span className="ui-badge ui-badge--slate">{preview.pipeline_stage ?? preview.status ?? '—'}</span>
                {safeStr((preview.candidate_profile ?? {}).visa_status) && (
                  <span className="ui-badge ui-badge--cyan">Visa {safeStr((preview.candidate_profile ?? {}).visa_status)}</span>
                )}
                {safeStr((preview.candidate_profile ?? {}).availability) && (
                  <span className="ui-badge ui-badge--green">{safeStr((preview.candidate_profile ?? {}).availability)}</span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Recruiter: {preview.uploaded_by?.name ?? preview.uploaded_by?.email ?? '—'}
                {' · '}Exp: {safeStr((preview.candidate_profile ?? {}).total_experience) || '—'}
                {' · '}Notice: {safeStr((preview.candidate_profile ?? {}).notice_period) || '—'}
                {' · '}Salary: {safeStr((preview.candidate_profile ?? {}).expected_salary ?? (preview.candidate_profile ?? {}).current_salary) || '—'}
              </p>
            </div>
            <button type="button" onClick={() => setPreviewId(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-[#166534]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="ui-empty h-60">
          <Briefcase className="w-10 h-10 text-gray-300" />
          <p>No internal candidates match your search.</p>
          <p className="text-xs text-gray-400 max-w-xl font-medium">
            Tip: try a keyword like <span className="font-semibold">React</span>, a role like <span className="font-semibold">Java Developer</span>, or a location.
          </p>
        </div>
      ) : (
        <ScrollableTable stickyX>
          <table className="ent-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Primary Skills</th>
                <th>Experience</th>
                <th>Location</th>
                <th>Visa</th>
                <th>Expected Salary</th>
                <th>Notice</th>
                <th className="text-center">AI Match</th>
                <th>Status</th>
                <th>Recruiter</th>
                <th>Updated</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => {
                const prof = c.candidate_profile ?? {}
                const currentRole = safeStr(prof.current_title ?? prof.current_role ?? '')
                const totalExp = safeStr(prof.total_experience ?? '')
                const loc = safeStr(prof.current_location ?? prof.location ?? '')
                const notice = safeStr(prof.notice_period ?? '')
                const visa = safeStr(prof.visa_status ?? prof.visa ?? '')
                const salary = safeStr(prof.expected_salary ?? prof.current_salary ?? '')
                const updated = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '—'
                const recruiter = c.uploaded_by?.name ?? c.uploaded_by?.email ?? '—'
                const status = c.pipeline_stage ?? c.status ?? '—'

                return (
                  <tr key={c.id} className="hover:bg-[#ecfdf3]/80 transition-colors cursor-pointer" onClick={() => setPreviewId(c.id)}>
                    <td>
                      <div className="flex flex-col">
                        <p className="font-semibold text-gray-900 text-sm">{c.candidate_name}</p>
                        <p className="text-xs text-gray-500">{c.short_id ? `RES-${c.short_id}` : c.id.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="text-sm text-gray-700 whitespace-nowrap">{formatPhoneInternational(c.candidate_phone) || c.candidate_phone || '—'}</td>
                    <td className="text-sm text-gray-700 max-w-[160px] truncate" title={c.candidate_email || ''}>{c.candidate_email || '—'}</td>
                    <td className="text-sm text-gray-700">{currentRole || '—'}</td>
                    <td className="text-sm text-gray-700">{firstSkills(c.ai_skills, 3)}</td>
                    <td className="text-sm text-gray-600">{totalExp || '—'}</td>
                    <td className="text-sm text-gray-600">{loc || '—'}</td>
                    <td className="text-sm text-gray-600">{visa || '—'}</td>
                    <td className="text-sm text-gray-600">{salary || '—'}</td>
                    <td className="text-sm text-gray-600">{notice || '—'}</td>
                    <td className="text-center">
                      {c.ai_score != null ? (
                        <span className="ui-badge ui-badge--purple inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> {c.ai_score}
                        </span>
                      ) : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td>
                      <span className="ui-badge ui-badge--slate">{status}</span>
                    </td>
                    <td className="text-sm text-gray-600">{recruiter}</td>
                    <td className="text-sm text-gray-500 whitespace-nowrap">{updated}</td>
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => window.location.assign(`/dashboard/candidates/${c.id}`)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-[#166534] hover:text-[#14532d] bg-[#ecfdf3] border border-[#166534]/20"
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
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-[#c2410c] hover:text-[#9a3412] bg-[#fff7ed] border border-[#F97316]/30"
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
