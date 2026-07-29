'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Brain, Loader2, Mail, MessageCircle, Phone, FileText, User, Sparkles,
  Pencil, Download, Eye, Save, X,
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

const KPI_TONES = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g1', 'g4', 'g3'] as const

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`kpi-card kpi-card--gradient kpi-card--${tone} !min-h-[76px]`}>
      <p className="kpi-card__label">{label}</p>
      <p className="kpi-card__value text-lg truncate">{value}</p>
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
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [resumeFileOk, setResumeFileOk] = useState<boolean | null>(null)
  const [editForm, setEditForm] = useState({
    candidate_email: '',
    candidate_phone: '',
    availability: '',
    notice_period: '',
    current_role: '',
    current_employer: '',
    location: '',
    nationality: '',
    linkedin_url: '',
  })

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

  useEffect(() => {
    let cancelled = false
    fetch(`/api/candidates/${candidateId}/resume-file`, { method: 'HEAD' })
      .then(res => { if (!cancelled) setResumeFileOk(res.ok) })
      .catch(() => { if (!cancelled) setResumeFileOk(false) })
    return () => { cancelled = true }
  }, [candidateId, data])

  const h = data?.header
  const s = data?.summary
  const c = data?.candidate
  const profile = (c?.candidate_profile ?? {}) as Record<string, unknown>
  const name = h?.name || c?.candidate_name || 'Candidate'
  const jobId = c?.job_post_id || undefined
  const resumeText = c?.raw_text || c?.resume_text || ''

  const mailto = h?.email || c?.candidate_email
  const phone = h?.phone || c?.candidate_phone

  const startEdit = () => {
    setEditForm({
      candidate_email: String(mailto || ''),
      candidate_phone: String(phone || ''),
      availability: String(h?.availability || profile.availability || ''),
      notice_period: String(h?.notice_period || profile.notice_period || ''),
      current_role: String(h?.current_role || profile.current_role || ''),
      current_employer: String(h?.current_employer || profile.current_employer || ''),
      location: String(h?.location || profile.current_location || profile.location || ''),
      nationality: String(h?.nationality || profile.nationality || ''),
      linkedin_url: String(profile.linkedin_url || ''),
    })
    setSaveErr(null)
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_email: editForm.candidate_email || null,
          candidate_phone: editForm.candidate_phone || null,
          candidate_profile: {
            ...profile,
            availability: editForm.availability || null,
            notice_period: editForm.notice_period || null,
            current_role: editForm.current_role || null,
            current_employer: editForm.current_employer || null,
            current_location: editForm.location || null,
            location: editForm.location || null,
            nationality: editForm.nationality || null,
            linkedin_url: editForm.linkedin_url || null,
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveErr(json.error || 'Could not save')
        return
      }
      setEditing(false)
      await load()
    } catch {
      setSaveErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  const kpis = [
    { label: 'Profile', value: `${s?.profile_completion ?? 0}%` },
    { label: 'AI Match', value: s?.ai_match_score != null ? String(s.ai_match_score) : '—' },
    { label: 'Comms', value: s?.communication_status ?? '—' },
    { label: 'Submission', value: String(s?.submission_status ?? '—') },
    { label: 'Interview', value: String(s?.interview_status ?? '—') },
    { label: 'Offer', value: String(s?.offer_status ?? '—') },
    { label: 'Documents', value: s?.documents_count ?? 0 },
    { label: 'Notes', value: s?.notes_count ?? 0 },
    { label: 'Notice', value: h?.notice_period || '—' },
    { label: 'Nationality', value: h?.nationality || '—' },
  ]

  return (
    <div>
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
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-300">
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
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    {[h?.current_role, h?.current_employer, h?.location].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">
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
                  <button
                    type="button"
                    onClick={async () => {
                      const subject = window.prompt('Email subject', `Following up — ${h?.name || 'your application'}`)
                      if (!subject) return
                      const html = window.prompt('Message (plain text OK)', `Hi ${h?.name || ''},\n\n`)
                      if (html == null) return
                      const res = await fetch('/api/candidates/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          resume_id: candidateId,
                          to: mailto,
                          subject,
                          html: html.replace(/\n/g, '<br/>'),
                        }),
                      })
                      const sendData = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        window.alert(sendData.error || 'Send failed — connect Gmail/Outlook in Settings, or use mailto.')
                        window.location.href = `mailto:${mailto}?subject=${encodeURIComponent(subject)}`
                        return
                      }
                      window.alert(`Sent via ${sendData.sent_via || 'email'}`)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
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
              {kpis.map((k, i) => (
                <SummaryCard key={k.label} label={k.label} value={k.value} tone={KPI_TONES[i % KPI_TONES.length]} />
              ))}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-700">Profile details</p>
                    {!editing ? (
                      <button
                        type="button"
                        onClick={startEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-500"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit profile
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={saveEdit}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(false)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {saveErr && <p className="text-xs font-bold text-rose-600">{saveErr}</p>}
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                      {editing ? (
                        <div className="grid sm:grid-cols-2 gap-2.5">
                          {([
                            ['candidate_email', 'Email'],
                            ['candidate_phone', 'Phone'],
                            ['availability', 'Availability'],
                            ['notice_period', 'Notice period'],
                            ['current_role', 'Current role'],
                            ['current_employer', 'Employer'],
                            ['location', 'Location'],
                            ['nationality', 'Nationality'],
                            ['linkedin_url', 'LinkedIn'],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 block">
                              <span className="text-[10px] font-extrabold uppercase text-slate-700">{label}</span>
                              <input
                                className="mt-1 w-full text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                                value={editForm[key]}
                                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
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
                            <div key={label} className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
                              <p className="text-[10px] font-extrabold uppercase text-slate-600">{label}</p>
                              <p className="text-sm font-extrabold text-slate-900 mt-1 break-words">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                        Active recruiter owner for follow-up and transfer
                      </p>
                      <OwnershipPanel
                        entityType="candidate"
                        entityId={candidateId}
                        compact
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
                <div className="p-5 space-y-4">
                  {resumeFileOk === true ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/candidates/${candidateId}/resume-file?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview original
                        </a>
                        <a
                          href={`/api/candidates/${candidateId}/resume-file`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-800"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                      <iframe
                        title="Resume preview"
                        src={`/api/candidates/${candidateId}/resume-file?inline=1`}
                        className="w-full h-[420px] rounded-xl border border-slate-200 bg-slate-50"
                      />
                    </div>
                  ) : resumeFileOk === false ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                      <p className="text-sm font-extrabold text-amber-950">Original file missing on server</p>
                      <p className="text-xs font-medium text-amber-900">
                        Re-upload the PDF/DOC in the Documents tab. Extracted text below may still be available for search and screening.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('documents')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 text-white text-xs font-extrabold"
                      >
                        Open Documents
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking original file…
                    </div>
                  )}
                  {resumeText ? (
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-700 mb-2">Extracted text</p>
                      <pre className="whitespace-pre-wrap text-xs font-medium text-slate-700 leading-relaxed max-h-[50vh] overflow-auto bg-slate-50 border border-slate-200 rounded-xl p-4">
                        {resumeText}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-6 flex flex-col items-center gap-2">
                      <User className="w-5 h-5" /> No resume text on file. Check Documents for uploaded files.
                    </p>
                  )}
                </div>
              )}

              {tab === 'record' && (
                <div className="p-5 space-y-3">
                  <p className="text-sm text-slate-600">
                    Edit core contact and profile fields here, or use the full ATS form from the Candidates list.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setTab('profile'); startEdit() }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit profile details
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
