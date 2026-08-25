'use client'

/** Clickable entity short IDs — RES / SUB / INT / OFF / JOB / CLT */

export type EntityIdKind = 'candidate' | 'submission' | 'interview' | 'offer' | 'job' | 'client'

const KIND_META: Record<EntityIdKind, { label: string; prefixHint: string; badge: string }> = {
  candidate: { label: 'Cand. ID', prefixHint: 'RES-', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  submission: { label: 'Submission ID', prefixHint: 'SUB-', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
  interview: { label: 'Interview ID', prefixHint: 'INT-', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  offer: { label: 'Offer ID', prefixHint: 'OFF-', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  job: { label: 'Job ID', prefixHint: 'JOB-', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  client: { label: 'Client ID', prefixHint: 'CLT-', badge: 'bg-slate-50 text-slate-800 border-slate-200' },
}

export function EntityIdLink({
  kind,
  id,
  onClick,
  className = '',
}: {
  kind: EntityIdKind
  id: string | null | undefined
  onClick?: () => void
  className?: string
}) {
  const meta = KIND_META[kind]
  const display = (id ?? '').trim() || '—'
  const badge = `inline-flex items-center font-mono text-[11px] font-extrabold px-2 py-0.5 rounded border ${meta.badge} ${className}`
  if (!id?.trim() || display === '—') {
    return <span className={`font-mono text-xs text-slate-400 ${className}`}>—</span>
  }
  if (!onClick) {
    return (
      <span className={badge} title={`${meta.label} (${meta.prefixHint}…)`}>
        {display}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open ${meta.label}: ${display}`}
      className={`${badge} hover:brightness-95`}
    >
      {display}
    </button>
  )
}

export function entityKindLabel(kind: EntityIdKind): string {
  return KIND_META[kind].label
}
