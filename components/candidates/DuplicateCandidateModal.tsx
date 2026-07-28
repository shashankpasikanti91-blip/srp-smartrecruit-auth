'use client'

import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import type { DuplicateMatch } from '@/lib/duplicateCheckTypes'

export function DuplicateCandidateModal({
  duplicates,
  onClose,
  onView,
  onCancelCreate,
  onForceCreate,
  allowForce = false,
}: {
  duplicates: DuplicateMatch[]
  onClose: () => void
  onView: (id: string) => void
  onCancelCreate: () => void
  onForceCreate?: () => void
  allowForce?: boolean
}) {
  if (!duplicates.length) return null
  const primary = duplicates[0]

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-amber-950">Candidate already exists</h3>
              <p className="text-xs font-medium text-amber-900/80 mt-1">
                A matching record was found in this workspace. Creating another copy is blocked by default.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-auto">
          {duplicates.map(d => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{d.candidate_name || 'Unnamed'}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {d.short_id}
                    {d.candidate_email ? ` · ${d.candidate_email}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onView(d.id)}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-700 hover:underline"
                >
                  View <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div><dt className="text-slate-400 font-bold uppercase">Owner</dt><dd className="font-semibold text-slate-800">{d.owner_name || d.owner_email || '—'}</dd></div>
                <div><dt className="text-slate-400 font-bold uppercase">Stage</dt><dd className="font-semibold text-slate-800 capitalize">{d.pipeline_stage || '—'}</dd></div>
                <div><dt className="text-slate-400 font-bold uppercase">Client</dt><dd className="font-semibold text-slate-800">{d.client_name || '—'}</dd></div>
                <div><dt className="text-slate-400 font-bold uppercase">Created</dt><dd className="font-semibold text-slate-800">{new Date(d.created_at).toLocaleDateString()}</dd></div>
              </dl>
              {d.matched_on?.length > 0 && (
                <p className="mt-2 text-[10px] font-bold text-amber-800">
                  Matched on: {d.matched_on.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end bg-white">
          <button
            type="button"
            onClick={onCancelCreate}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onView(primary.id)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-extrabold hover:bg-indigo-500"
          >
            View existing
          </button>
          {allowForce && onForceCreate && (
            <button
              type="button"
              onClick={onForceCreate}
              className="px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm font-extrabold"
            >
              Create anyway
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
