'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Loader2, Send, Briefcase, FileText } from 'lucide-react'
import { SUBMISSION_STAGES, INTERVIEW_STATUSES, OFFER_STATUSES, labelFor } from '@/lib/recruitmentOs'
import { DocsUploadPanel } from '@/components/recruitment/DocsUploadPanel'

export type AllocateMode = 'submissions' | 'interviews' | 'offers'

type JobOpt = { id: string; title: string; company?: string | null; status?: string | null; client_id?: string | null }
type ClientOpt = { id: string; name: string }
type SubRow = {
  id: string
  short_id: string
  stage: string
  client_name?: string | null
  applying_for?: string | null
  job_title?: string | null
  job_post_id?: string | null
}
type IvRow = {
  id: string
  short_id: string
  status: string
  scheduled_at?: string | null
  job_title?: string | null
  format?: string | null
}
type OfferRow = {
  id: string
  short_id: string
  status: string
  offer_salary?: string | null
  expected_joining?: string | null
  offer_letter_status?: string | null
  docs_status?: string | null
  joined_date?: string | null
}

const FEEDBACK_STAGES = ['client_review', 'shortlisted', 'interview', 'waiting_feedback', 'rejected', 'hold'] as const

function defaultSlotLocal() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CandidateAllocatePanel({
  candidateId,
  candidateName,
  candidateEmail,
  defaultJobId,
  onChanged,
  mode = 'submissions',
}: {
  candidateId: string
  candidateName: string
  candidateEmail?: string | null
  defaultJobId?: string | null
  onChanged?: () => void
  mode?: AllocateMode
}) {
  const [jobs, setJobs] = useState<JobOpt[]>([])
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [subs, setSubs] = useState<SubRow[]>([])
  const [interviews, setInterviews] = useState<IvRow[]>([])
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [clientId, setClientId] = useState('')
  const [jobId, setJobId] = useState(defaultJobId ?? '')
  const [notes, setNotes] = useState('')
  const [slot, setSlot] = useState(defaultSlotLocal)
  const [format, setFormat] = useState<'video' | 'phone' | 'in_person'>('video')
  const [salary, setSalary] = useState('')
  const [docsOpen, setDocsOpen] = useState(false)
  const [joining, setJoining] = useState('')
  const [editingSub, setEditingSub] = useState<string | null>(null)
  const [editClient, setEditClient] = useState('')
  const [editJob, setEditJob] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [j, s, i, o, cl] = await Promise.all([
        fetch('/api/jobs').then(r => r.json()),
        fetch(`/api/submissions?resume_id=${candidateId}&limit=30&mine=0`).then(r => r.json()),
        fetch(`/api/interviews?resume_id=${candidateId}&mine=0`).then(r => r.json()),
        fetch(`/api/offers?resume_id=${candidateId}&mine=0`).then(r => r.json()),
        fetch('/api/clients').then(r => r.json()).catch(() => ({ clients: [] })),
      ])
      const jobRows = (j.jobs ?? []) as JobOpt[]
      setJobs(jobRows.filter(x => (x.status ?? 'active') !== 'archived'))
      setClients((cl.clients ?? []) as ClientOpt[])
      setSubs(s.submissions ?? [])
      setInterviews(i.interviews ?? [])
      setOffers(o.offers ?? [])
      if (!jobId && defaultJobId) setJobId(defaultJobId)
      else if (!jobId && jobRows[0]?.id) setJobId(jobRows[0].id)
    } catch {
      setErr('Could not load jobs / pipeline records')
    } finally {
      setLoading(false)
    }
  }, [candidateId, defaultJobId, jobId])

  useEffect(() => { void load() }, [candidateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedClient = clients.find(c => c.id === clientId)
  const jobsForClient = clientId
    ? jobs.filter(j => j.client_id === clientId || (selectedClient && (j.company || '').toLowerCase() === selectedClient.name.toLowerCase()))
    : jobs
  const roleJobs = jobsForClient.length ? jobsForClient : jobs
  const selectedJob = jobs.find(j => j.id === jobId)
  const latestSub = subs[0]
  const latestIv = interviews[0]
  const latestOffer = offers[0]

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await fn()
      await load()
      onChanged?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const submitToJob = () => run(async () => {
    if (!jobId) throw new Error('Select the role / JD')
    const clientName = selectedClient?.name || selectedJob?.company || ''
    if (!clientName) throw new Error('Select which client this profile is going to')
    const roleName = selectedJob?.title || ''
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_id: candidateId,
        job_post_id: jobId,
        client_name: clientName,
        applying_for: roleName,
        stage: 'submitted',
        submission_date: new Date().toISOString().slice(0, 10),
        notes: notes || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 409 && data.existing_short_id) {
      setMsg(`Already submitted to this role: ${data.existing_short_id} (${data.existing_stage})`)
      return
    }
    if (!res.ok) throw new Error(data.error || 'Could not create submission')
    setMsg(`Shared this profile to ${clientName || 'client'} · ${roleName} · ${data.submission?.short_id ?? ''}`)
    setNotes('')
  })

  const saveShareEdit = (sub: SubRow) => run(async () => {
    const job = jobs.find(j => j.id === editJob)
    const client = clients.find(c => c.id === editClient)
    const res = await fetch(`/api/submissions/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_post_id: editJob || null,
        client_name: client?.name || job?.company || sub.client_name,
        applying_for: job?.title || sub.applying_for,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update client / role')
    setEditingSub(null)
    setMsg('Client and role updated on this submission')
  })

  const patchSub = (id: string, stage: string) => run(async () => {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update submission')
    setMsg(`Client feedback: ${labelFor(SUBMISSION_STAGES, stage)}`)
  })

  const scheduleInterview = (sub?: SubRow) => run(async () => {
    const email = (candidateEmail ?? '').trim()
    const when = new Date(slot)
    if (Number.isNaN(when.getTime())) throw new Error('Pick a valid date and time')
    const job = sub?.job_post_id || jobId || defaultJobId || undefined
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_id: candidateId,
        job_post_id: job,
        candidate_name: candidateName,
        candidate_email: email || undefined,
        scheduled_at: when.toISOString(),
        duration_minutes: 60,
        format,
        send_invite: false,
        create_calendar: false,
        notes: sub ? `From submission ${sub.short_id}` : notes || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not schedule interview')
    if (sub?.id) {
      await fetch(`/api/submissions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'interview' }),
      })
    }
    setMsg(`Interview booked · ${data.interview?.short_id ?? data.short_id ?? ''} — also on Interviews`)
  })

  const patchInterview = (id: string, status: string) => run(async () => {
    const res = await fetch(`/api/interviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update interview')
    setMsg(`Interview ${labelFor(INTERVIEW_STATUSES, status)}`)
  })

  const startOffer = (sub?: SubRow) => run(async () => {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_id: candidateId,
        submission_id: sub?.id,
        status: 'selected',
        offer_salary: salary || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not create offer')
    if (sub?.id) {
      await fetch(`/api/submissions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'selected' }),
      })
    }
    if (latestIv?.id) {
      await fetch(`/api/interviews/${latestIv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'selected' }),
      }).catch(() => null)
    }
    setMsg(`Selected · offer ${data.offer?.short_id ?? ''} — also on Offer & Onboarding`)
  })

  const patchOffer = (id: string, status: string) => run(async () => {
    const res = await fetch(`/api/offers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update offer')
    setMsg(`Offer → ${status.replace(/_/g, ' ')}`)
  })

  const patchOfferMeta = (id: string, body: Record<string, unknown>) => run(async () => {
    const res = await fetch(`/api/offers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update offer')
    setMsg('Offer details saved')
  })

  const showShare = mode === 'submissions'
  const showSubs = mode === 'submissions'
  const showIvs = mode === 'interviews'
  const showOffers = mode === 'offers'
  const shortlistedSubs = subs.filter(s => ['shortlisted', 'interview', 'client_review'].includes(s.stage))

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="px-5 py-4 space-y-4" data-testid="candidate-allocate-panel">
      {showShare && (
        <>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">Share this profile</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Same person can go to several clients. Each share is a submission with its own client and role — not a duplicate candidate.
            </p>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-2.5">
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">Client</span>
              <select
                data-testid="allocate-client-select"
                className="mt-1 w-full text-sm font-semibold border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                value={clientId}
                onChange={e => {
                  setClientId(e.target.value)
                  setJobId('')
                }}
              >
                <option value="">Select client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">Role / JD submitted</span>
              <select
                data-testid="allocate-job-select"
                className="mt-1 w-full text-sm font-semibold border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                value={jobId}
                onChange={e => {
                  const next = e.target.value
                  setJobId(next)
                  const j = jobs.find(x => x.id === next)
                  if (j?.client_id) setClientId(j.client_id)
                }}
              >
                <option value="">Select role…</option>
                {roleJobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.title}{j.company ? ` · ${j.company}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">Package notes (optional)</span>
              <textarea
                className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white min-h-[56px]"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Rate, availability, why this person for this JD"
              />
            </label>
            <button
              type="button"
              data-testid="allocate-submit-btn"
              disabled={busy || !jobId}
              onClick={submitToJob}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit to this client &amp; role
            </button>
          </div>
        </>
      )}

      {showIvs && (
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">Interviews</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Shortlist a submission first — an interview slot appears here. Client and role are already on the share.
          </p>
        </div>
      )}

      {showOffers && (
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">Offer &amp; onboarding</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Mark the interview Selected — documents, offer letter, and date of joining appear here.
          </p>
        </div>
      )}

      {showSubs && subs.length > 0 && (
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600 mb-2">Submissions</p>
          <ul className="space-y-2">
            {subs.map(s => (
              <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-900 font-mono">
                  {s.short_id}
                  <span className="ml-2 font-sans font-semibold text-indigo-800">
                    {s.job_title || s.applying_for || 'Role'}
                    {' · '}
                    {s.client_name || 'Client'}
                  </span>
                </p>
                <button
                  type="button"
                  className="mt-1 text-[10px] font-extrabold text-indigo-700 hover:underline"
                  onClick={() => {
                    setEditingSub(editingSub === s.id ? null : s.id)
                    setEditJob(s.job_post_id || '')
                    const match = clients.find(c => c.name.toLowerCase() === (s.client_name || '').toLowerCase())
                    setEditClient(match?.id || '')
                  }}
                >
                  {editingSub === s.id ? 'Close edit' : 'Edit client / role'}
                </button>
                {editingSub === s.id && (
                  <div className="mt-2 grid sm:grid-cols-2 gap-2">
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      value={editClient}
                      onChange={e => setEditClient(e.target.value)}
                    >
                      <option value="">Client…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      value={editJob}
                      onChange={e => setEditJob(e.target.value)}
                    >
                      <option value="">Role / JD…</option>
                      {jobs.map(j => (
                        <option key={j.id} value={j.id}>{j.title}{j.company ? ` · ${j.company}` : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveShareEdit(s)}
                      className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-extrabold"
                    >
                      Save client &amp; role
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-0.5">{labelFor(SUBMISSION_STAGES, s.stage)}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {FEEDBACK_STAGES.map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={busy}
                      onClick={() => patchSub(s.id, st)}
                      className={`px-2 py-1 rounded-md text-[10px] font-extrabold border ${
                        s.stage === st ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {labelFor(SUBMISSION_STAGES, st)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showSubs && subs.length === 0 && (
        <p className="text-xs font-medium text-slate-500">No submissions yet. Pick a client and role above.</p>
      )}

      {showIvs && shortlistedSubs.length > 0 && interviews.length === 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-teal-900">Shortlisted — pick a slot to put this person on Interviews.</p>
          {shortlistedSubs.slice(0, 1).map(s => (
            <div key={s.id} className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] font-extrabold uppercase text-slate-600">
                Interview slot
                <input
                  type="datetime-local"
                  data-testid="allocate-interview-slot"
                  className="mt-1 block text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                  value={slot}
                  onChange={e => setSlot(e.target.value)}
                />
              </label>
              <select
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                value={format}
                onChange={e => setFormat(e.target.value as typeof format)}
              >
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="in_person">In person</option>
              </select>
              <button
                type="button"
                data-testid="allocate-schedule-btn"
                disabled={busy}
                onClick={() => scheduleInterview(s)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-[10px] font-extrabold"
              >
                <Calendar className="w-3 h-3" /> Schedule interview
              </button>
            </div>
          ))}
        </div>
      )}

      {showIvs && interviews.length > 0 && (
        <div>
          <ul className="space-y-2">
            {interviews.map(iv => (
              <li key={iv.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-bold font-mono text-slate-900">
                  {iv.short_id}
                  <span className="ml-2 font-sans font-semibold text-teal-800">{iv.job_title || 'Interview'}</span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {iv.status === 'to_schedule' || !iv.scheduled_at
                    ? 'To schedule'
                    : new Date(iv.scheduled_at).toLocaleString()}
                  {' · '}
                  {labelFor(INTERVIEW_STATUSES, iv.status)}
                </p>
                {(iv.status === 'to_schedule' || !iv.scheduled_at) && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-[10px] font-extrabold uppercase text-slate-600">
                      Interview slot
                      <input
                        type="datetime-local"
                        data-testid="allocate-interview-slot"
                        className="mt-1 block text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                        value={slot}
                        onChange={e => setSlot(e.target.value)}
                      />
                    </label>
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      value={format}
                      onChange={e => setFormat(e.target.value as typeof format)}
                    >
                      <option value="video">Video</option>
                      <option value="phone">Phone</option>
                      <option value="in_person">In person</option>
                    </select>
                    <button
                      type="button"
                      data-testid="allocate-schedule-btn"
                      disabled={busy}
                      onClick={() => scheduleInterview(shortlistedSubs[0] || latestSub)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-[10px] font-extrabold"
                    >
                      <Calendar className="w-3 h-3" /> Schedule interview
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(['confirmed', 'completed', 'no_show', 'cancelled', 'rejected', 'selected'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={busy}
                      onClick={() => patchInterview(iv.id, st)}
                      className={`px-2 py-1 rounded-md text-[10px] font-extrabold border ${
                        iv.status === st ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {st === 'selected' ? 'Selected' : st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showIvs && interviews.length === 0 && shortlistedSubs.length === 0 && (
        <p className="text-xs font-medium text-slate-500">No interviews yet. Shortlist the candidate on Submissions first.</p>
      )}

      {showOffers && offers.length > 0 && (
        <div>
          <ul className="space-y-2">
            {offers.map(o => (
              <li key={o.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-sm font-bold font-mono">{o.short_id}
                  <span className="ml-2 font-sans font-semibold">{labelFor(OFFER_STATUSES, o.status)}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Docs: {o.docs_status?.replace(/_/g, ' ') || 'collecting'} · Letter: {o.offer_letter_status || 'draft'}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">
                    Salary
                    <input
                      className="mt-1 block w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      defaultValue={o.offer_salary ?? salary}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (v && v !== (o.offer_salary ?? '')) void patchOfferMeta(o.id, { offer_salary: v })
                      }}
                      placeholder="e.g. MYR 8,000"
                    />
                  </label>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">
                    Date of joining
                    <input
                      type="date"
                      className="mt-1 block w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      defaultValue={(o.expected_joining || joining || '').slice(0, 10)}
                      onChange={e => {
                        setJoining(e.target.value)
                        void patchOfferMeta(o.id, { expected_joining: e.target.value || null })
                      }}
                    />
                  </label>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">
                    Offer letter
                    <select
                      className="mt-1 block w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      value={o.offer_letter_status || 'draft'}
                      onChange={e => void patchOfferMeta(o.id, { offer_letter_status: e.target.value })}
                    >
                      <option value="not_started">Not started</option>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="signed">Signed</option>
                      <option value="declined">Withdrawn / declined</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(['offer_released', 'offer_accepted', 'joining_confirmed', 'onboarding', 'joined', 'offer_rejected', 'cancelled'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={busy}
                      onClick={() => patchOffer(o.id, st)}
                      className={`px-2 py-1 rounded-md text-[10px] font-extrabold border ${
                        o.status === st ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDocsOpen(v => !v)}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 hover:underline"
                >
                  <FileText className="w-3 h-3" /> {docsOpen ? 'Hide documents' : 'Documents collection'}
                </button>
                {docsOpen && (
                  <DocsUploadPanel
                    resumeId={candidateId}
                    candidateName={candidateName}
                    onClose={() => setDocsOpen(false)}
                    onUploaded={() => { void load() }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showOffers && offers.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">No offer yet. Mark the interview as Selected and an offer case opens automatically.</p>
          {latestSub && latestIv?.status === 'selected' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => startOffer(latestSub)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-extrabold"
            >
              <Briefcase className="w-3 h-3" /> Create offer now
            </button>
          )}
        </div>
      )}

      {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
      {msg && <p className="text-xs font-bold text-emerald-700">{msg}</p>}
    </div>
  )
}
