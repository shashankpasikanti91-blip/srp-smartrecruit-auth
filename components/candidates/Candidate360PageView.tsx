'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Brain, Loader2, Mail, MessageCircle, Phone, FileText, User, Sparkles,
} from 'lucide-react'
import {
  Candidate360Panels,
  Candidate360TabBar,
  type Candidate360Tab,
} from '@/components/candidates/Candidate360View'
import { OwnershipPanel } from '@/components/ownership/OwnershipPanel'
import { EntityNotesTimeline } from '@/components/ui/EntityNotesTimeline'

type Header = {
  name?: string
  ai_score?: number | null
  match_category?: string | null
  status?: string | null
  stage?: string | null
  lifecycle?: string | null
  availability?: string | null
  notice_period?: string | null
  current_employer?: string | null
  current_role?: string | null
  location?: string | null
  nationality?: string | null
  owner?: { name?: string | null; email?: string | null } | string | null
  last_updated?: string | null
  email?: string | null
  phone?: string | null
}

type Summary = {
  profile_completion?: number
  ai_match_score?: number | null
  resume_score?: number | null
  communication_status?: string
  submission_status?: string
  interview_status?: string
  offer_status?: string
  documents_count?: number
  notes_count?: number
  activity_count?: number
}

type Ownership = {
  id: string
  owner_user_id: string
  owner_name?: string | null
  owner_email?: string | null
  assigned_at: string
  valid_until: string
  status: string
  expired?: boolean
}

type Cand360 = {
  candidate?: Record<string, unknown> & {
    id: string
    short_id?: string
    candidate_name?: string
    candidate_email?: string | null
    candidate_phone?: string | null
    candidate_profile?: Record<string, unknown>
    ai_summary?: string | null
    raw_text?: string | null
    resume_text?: string | null
    job_post_id?: string | null
  }
  header?: Header
  summary?: Summary
  ownership?: Ownership | null
  ownership_history?: unknown[]
  submissions?: unknown[]
  interviews?: unknown[]
  offers?: unknown[]
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function ownerLabel(owner: Header['owner']) {
  if (!owner) return '—'
  if (typeof owner === 'string') return owner
  return owner.name || owner.email || '—'
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-900 mt-1 truncate">{value}</p>
    </div>
  )
}

export function Candidate360PageView({
  candidateId,
  onClose,
  onOpenJob,
  teamMembers = [],
  canManageOwnership = false,
}: {
  candidateId: string
  onClose: () => void
  onOpenJob?: (jobId: string) => void
  teamMembers?: { user_id: string; name: string | null; email: string; role: string }[]
  canManageOwnership?: boolean
}) {
  const [data, setData] = useState<Cand360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Candidate360Tab>('profile')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/360`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `Could not load candidate (${res.status})`)
        return
      }
      setData(json)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => { load() }, [load])

  const h = data?.header
  const s = data?.summary
  const c = data?.candidate
  const profile = (c?.candidate_profile ?? {}) as Record<string, unknown>
  const name = h?.name || c?.candidate_name || 'Candidate'
  const jobId = c?.job_post_id || undefined
  const resumeText = c?.raw_text || c?.resume_text || ''

  const mailto = h?.email || c?.candidate_email
  const phone = h?.phone || c?.candidate_phone

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200">
            <button type="button" onClick={onClose} className="text-xs font-bold text-indigo-700 hover:underline mb-1">
              ← Back to Candidates
            </button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white shrink-0">
                  {name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {c?.short_id && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {c.short_id}
                      </span>
                    )}
                    <h1 className="text-xl font-extrabold text-slate-900 truncate">{name}</h1>
                    {h?.stage && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {h.stage}
                      </span>
                    )}
                    {h?.status && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {h.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {[h?.current_role, h?.current_employer, h?.location].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Owner: {ownerLabel(h?.owner)} · Updated {fmtWhen(h?.last_updated)}
                    {h?.ai_score != null ? ` · AI ${h.ai_score}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {phone && (
                  <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
                {mailto && (
                  <a href={`mailto:${mailto}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                )}
                {phone && (
                  <a
                    href={`https://wa.me/${String(phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                {jobId && onOpenJob && (
                  <button
                    type="button"
                    onClick={() => onOpenJob(jobId)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-500"
                  >
                    <FileText className="w-3.5 h-3.5" /> Open job
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTab('ai')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-extrabold hover:bg-violet-500"
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Summary
                </button>
              </div>
            </div>
          </div>

          {!loading && !error && (
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 border-b border-slate-100">
              <SummaryCard label="Profile" value={`${s?.profile_completion ?? 0}%`} />
              <SummaryCard label="AI Match" value={s?.ai_match_score != null ? String(s.ai_match_score) : '—'} />
              <SummaryCard label="Comms" value={s?.communication_status ?? '—'} />
              <SummaryCard label="Submission" value={String(s?.submission_status ?? '—')} />
              <SummaryCard label="Interview" value={String(s?.interview_status ?? '—')} />
              <SummaryCard label="Offer" value={String(s?.offer_status ?? '—')} />
              <SummaryCard label="Documents" value={s?.documents_count ?? 0} />
              <SummaryCard label="Notes" value={s?.notes_count ?? 0} />
              <SummaryCard label="Notice" value={h?.notice_period || '—'} />
              <SummaryCard label="Nationality" value={h?.nationality || '—'} />
            </div>
          )}

          <Candidate360TabBar
            tab={tab}
            onTabChange={setTab}
            hasAiData={Boolean(c?.ai_summary) || tab === 'ai'}
          />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm min-h-[420px]">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-rose-700">{error}</p>
              <button type="button" onClick={load} className="mt-3 text-xs font-bold text-indigo-700 hover:underline">Retry</button>
            </div>
          ) : (
            <>
              {tab === 'profile' && (
                <div className="p-5 space-y-4">
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {[
                          ['Email', mailto || '—'],
                          ['Phone', phone || '—'],
                          ['Availability', h?.availability || '—'],
                          ['Notice period', h?.notice_period || '—'],
                          ['Current role', h?.current_role || '—'],
                          ['Employer', h?.current_employer || '—'],
                          ['Location', h?.location || '—'],
                          ['Nationality', h?.nationality || '—'],
                          ['Lifecycle', h?.lifecycle || h?.stage || '—'],
                          ['LinkedIn', String(profile.linkedin_url ?? '—')],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                            <p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-1 break-words">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <OwnershipPanel
                      entityType="candidate"
                      entityId={candidateId}
                      initialOwnership={data?.ownership ?? null}
                      initialHistory={(data?.ownership_history as {
                        id: string
                        action: string
                        reason?: string | null
                        created_at: string
                        from_name?: string | null
                        to_name?: string | null
                        actor_email?: string | null
                      }[]) ?? []}
                      teamMembers={teamMembers}
                      canManage={canManageOwnership}
                    />
                  </div>
                </div>
              )}

              {tab === 'ai' && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-violet-700">
                    <Brain className="w-4 h-4" />
                    <p className="text-xs font-extrabold uppercase tracking-widest">AI Summary</p>
                  </div>
                  {c?.ai_summary ? (
                    <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed bg-violet-50/50 border border-violet-100 rounded-xl p-4">
                      {c.ai_summary}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-10">No AI summary yet. Run screening from AI Hub.</p>
                  )}
                </div>
              )}

              {tab === 'resume' && (
                <div className="p-5">
                  {resumeText ? (
                    <pre className="whitespace-pre-wrap text-xs font-medium text-slate-700 leading-relaxed max-h-[70vh] overflow-auto bg-slate-50 border border-slate-200 rounded-xl p-4">
                      {resumeText}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-10 flex flex-col items-center gap-2">
                      <User className="w-5 h-5" /> No resume text on file. Check Documents for uploaded files.
                    </p>
                  )}
                </div>
              )}

              {tab === 'record' && (
                <div className="p-5">
                  <p className="text-sm text-slate-600 mb-3">
                    ATS record fields are editable from the Candidates list drawer. This page shows the live 360 summary and ownership.
                  </p>
                  <button type="button" onClick={onClose} className="text-xs font-extrabold text-indigo-700 hover:underline">
                    Open list to edit ATS record →
                  </button>
                </div>
              )}

              {tab === 'notes' ? (
                <div className="p-4 sm:p-5 bg-slate-50/40">
                  <EntityNotesTimeline
                    entityType="candidate"
                    entityId={candidateId}
                    title="Candidate notes"
                    subtitle="Unlimited notes with pin, private/team visibility, search, and edit."
                  />
                </div>
              ) : (
                <Candidate360Panels candidateId={candidateId} tab={tab} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
