'use client'

import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon,
  action,
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
        {icon ?? <Inbox className="w-5 h-5" />}
      </div>
      <p className="text-sm font-extrabold text-slate-800">{title}</p>
      {description && (
        <p className="text-xs font-medium text-slate-500 mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
