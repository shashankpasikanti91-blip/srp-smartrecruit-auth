'use client'

/** Clickable entity short IDs — RES / SUB / INT / OFF / JOB / CLT */

export type EntityIdKind = 'candidate' | 'submission' | 'interview' | 'offer' | 'job' | 'client'

const KIND_META: Record<EntityIdKind, { label: string; prefixHint: string }> = {
  candidate: { label: 'Cand. ID', prefixHint: 'RES-' },
  submission: { label: 'Submission ID', prefixHint: 'SUB-' },
  interview: { label: 'Interview ID', prefixHint: 'INT-' },
  offer: { label: 'Offer ID', prefixHint: 'OFF-' },
  job: { label: 'Job ID', prefixHint: 'JOB-' },
  client: { label: 'Client ID', prefixHint: 'CLT-' },
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
  if (!id?.trim() || display === '—') {
    return <span className={`font-mono text-xs text-slate-400 ${className}`}>—</span>
  }
  if (!onClick) {
    return (
      <span
        className={`font-mono text-xs font-extrabold text-slate-800 ${className}`}
        title={`${meta.label} (${meta.prefixHint}…)`}
      >
        {display}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open ${meta.label}: ${display}`}
      className={`font-mono text-xs font-extrabold text-indigo-700 hover:underline hover:text-indigo-900 ${className}`}
    >
      {display}
    </button>
  )
}

export function entityKindLabel(kind: EntityIdKind): string {
  return KIND_META[kind].label
}
