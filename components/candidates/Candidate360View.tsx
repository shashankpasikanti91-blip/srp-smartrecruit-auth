'use client'

import { CandidateDocumentsPanel } from './CandidateDocumentsPanel'
import { CandidateTimeline } from './CandidateTimeline'
import { CandidateNotesPanel } from './CandidateNotesPanel'

export { CandidateDocumentsPanel, CandidateTimeline, CandidateNotesPanel }

export type Candidate360Tab = 'profile' | 'record' | 'ai' | 'resume' | 'documents' | 'timeline' | 'notes'

const TAB_LABELS: Record<Candidate360Tab, string> = {
  profile: 'Profile & Actions',
  record: 'ATS record',
  ai: 'AI Screening',
  resume: 'Resume / CV',
  documents: 'Documents',
  timeline: 'Timeline',
  notes: 'Notes',
}

/** Tab bar for Candidate 360° drawer */
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
  const tabs: Candidate360Tab[] = ['profile', 'record', ...(hasAiData ? ['ai' as const] : []), 'resume', 'documents', 'timeline', 'notes']

  return (
    <div className="flex flex-wrap border-b border-slate-200 gap-x-1 bg-white px-2">
      {tabs.map(t => (
        <button key={t} type="button" onClick={() => onTabChange(t)}
          className={`relative px-5 py-3 text-sm font-medium transition-all ${
            tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}>
          {TAB_LABELS[t]}
          {t === 'record' && recordWarn && (
            <span className="absolute top-2 right-1 w-2 h-2 rounded-full bg-amber-400 shadow shadow-amber-300/80" title="Missing recommended ATS fields" />
          )}
        </button>
      ))}
    </div>
  )
}

/** Candidate 360° tab panels for documents / timeline / notes slots. */
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
  tab: 'documents' | 'timeline' | 'notes'
  notes?: string | null
  followUpNotes?: string | null
  internalComments?: string | null
  reviewerNotes?: string | null
  onNotesSaved?: (profile: Record<string, string | null>) => void
}) {
  if (tab === 'documents') return <CandidateDocumentsPanel candidateId={candidateId} />
  if (tab === 'timeline') return <CandidateTimeline candidateId={candidateId} />
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
