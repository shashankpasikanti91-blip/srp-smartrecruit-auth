'use client'

import { CandidateDocumentsPanel } from './CandidateDocumentsPanel'
import { CandidateTimeline } from './CandidateTimeline'
import { CandidateNotesPanel } from './CandidateNotesPanel'
import { CandidateLinkedPanel } from './CandidateLinkedPanel'
import {
  CandidateCommsPanel,
  CandidateAuditPanel,
  CandidateJobsPanel,
  CandidateAttachmentsPanel,
} from './CandidateCommsPanel'

export {
  CandidateDocumentsPanel,
  CandidateTimeline,
  CandidateNotesPanel,
  CandidateLinkedPanel,
  CandidateCommsPanel,
  CandidateAuditPanel,
  CandidateJobsPanel,
  CandidateAttachmentsPanel,
}

export type Candidate360Tab =
  | 'profile'
  | 'record'
  | 'ai'
  | 'resume'
  | 'documents'
  | 'timeline'
  | 'notes'
  | 'submissions'
  | 'interviews'
  | 'offers'
  | 'followups'
  | 'emails'
  | 'whatsapp'
  | 'jobs'
  | 'activities'
  | 'audit'
  | 'attachments'
  | 'history'

const TAB_LABELS: Record<Candidate360Tab, string> = {
  profile: 'Overview',
  record: 'ATS record',
  ai: 'AI Summary',
  resume: 'Resume',
  documents: 'Documents',
  timeline: 'Timeline',
  notes: 'Notes',
  submissions: 'Submissions',
  interviews: 'Interviews',
  offers: 'Offers & Onboarding',
  followups: 'Follow-ups',
  emails: 'Emails',
  whatsapp: 'WhatsApp',
  jobs: 'Jobs Applied',
  activities: 'Activities',
  audit: 'Audit Logs',
  attachments: 'Attachments',
  history: 'History',
}

const PANEL_TABS: Candidate360Tab[] = [
  'documents', 'timeline', 'notes', 'submissions', 'interviews', 'offers', 'followups',
  'emails', 'whatsapp', 'jobs', 'activities', 'audit', 'attachments', 'history',
]

/** Tab bar for Candidate 360° drawer — single source of truth, linked by Candidate ID */
export function Candidate360TabBar({
  tab,
  onTabChange,
  hasAiData,
  recordWarn,
}: {
  tab: Candidate360Tab
  onTabChange: (t: Candidate360Tab) => void
  hasAiData?: boolean
  recordWarn?: boolean
}) {
  const tabs: Candidate360Tab[] = [
    'profile',
    'record',
    ...(hasAiData ? (['ai'] as const) : []),
    'resume',
    'documents',
    'jobs',
    'submissions',
    'interviews',
    'offers',
    'followups',
    'emails',
    'whatsapp',
    'notes',
    'activities',
    'timeline',
    'attachments',
    'history',
    'audit',
  ]

  return (
    <div className="flex flex-wrap border-b border-slate-200 gap-x-0.5 bg-white px-1 sticky top-0 z-10">
      {tabs.map(t => (
        <button key={t} type="button" onClick={() => onTabChange(t)}
          className={`relative px-3 py-2.5 text-xs font-black tracking-tight transition-all whitespace-nowrap rounded-t-lg ${
            tab === t
              ? 'text-indigo-800 bg-indigo-50 border-b-2 border-indigo-600'
              : 'text-slate-800 hover:text-indigo-900 hover:bg-slate-50'
          }`}>
          {TAB_LABELS[t]}
          {t === 'record' && recordWarn && (
            <span className="absolute top-1.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow shadow-amber-300/80" title="Missing recommended ATS fields" />
          )}
        </button>
      ))}
    </div>
  )
}

export function isCandidate360PanelTab(tab: string): tab is typeof PANEL_TABS[number] {
  return (PANEL_TABS as string[]).includes(tab)
}

/** Candidate 360° tab panels — every panel keyed by candidateId */
export function Candidate360Panels({
  candidateId,
  tab,
  notes,
  followUpNotes,
  internalComments,
  reviewerNotes,
  onNotesSaved,
}: {
  candidateId: string
  tab: Candidate360Tab
  notes?: string | null
  followUpNotes?: string | null
  internalComments?: string | null
  reviewerNotes?: string | null
  onNotesSaved?: (profile: Record<string, string | null>) => void
}) {
  if (tab === 'documents') return <CandidateDocumentsPanel candidateId={candidateId} />
  if (tab === 'timeline' || tab === 'activities' || tab === 'history') {
    return <CandidateTimeline candidateId={candidateId} />
  }
  if (tab === 'submissions' || tab === 'interviews' || tab === 'offers' || tab === 'followups') {
    return <CandidateLinkedPanel candidateId={candidateId} kind={tab} />
  }
  if (tab === 'emails') return <CandidateCommsPanel candidateId={candidateId} channel="email" />
  if (tab === 'whatsapp') return <CandidateCommsPanel candidateId={candidateId} channel="whatsapp" />
  if (tab === 'jobs') return <CandidateJobsPanel candidateId={candidateId} />
  if (tab === 'audit') return <CandidateAuditPanel candidateId={candidateId} />
  if (tab === 'attachments') return <CandidateAttachmentsPanel candidateId={candidateId} />
  if (tab === 'notes') {
    return (
      <CandidateNotesPanel
        candidateId={candidateId}
        notes={notes}
        followUpNotes={followUpNotes}
        internalComments={internalComments}
        reviewerNotes={reviewerNotes}
        onSaved={onNotesSaved}
      />
    )
  }
  return null
}
