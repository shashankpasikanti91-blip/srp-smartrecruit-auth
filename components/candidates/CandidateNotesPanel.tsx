'use client'

import { EntityNotesTimeline } from '@/components/ui/EntityNotesTimeline'
import { SectionPanel } from '@/components/ui/SectionPanel'

/** Candidate Notes tab — append-only timeline with categories. */
export function CandidateNotesPanel({
  candidateId,
}: {
  candidateId: string
  notes?: string | null
  followUpNotes?: string | null
  internalComments?: string | null
  reviewerNotes?: string | null
  onSaved?: (profile: Record<string, string | null>) => void
}) {
  return (
    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/40">
      <EntityNotesTimeline
        entityType="candidate"
        entityId={candidateId}
        title="Candidate notes"
        subtitle="Threaded notes for recruiter, follow-up, internal, and reviewer communication."
        defaultCategory="recruiter"
        allowedCategories={['recruiter', 'follow_up', 'internal', 'reviewer', 'general']}
      />
      <SectionPanel
        title="Tip"
        subtitle="Older single-field notes were migrated into this timeline when available. New notes always append — they never overwrite history."
        className="!p-4"
      >
        <p className="text-xs text-slate-500 leading-relaxed">
          Use categories to separate recruiter notes, follow-ups, internal comments, and reviewer notes.
        </p>
      </SectionPanel>
    </div>
  )
}
