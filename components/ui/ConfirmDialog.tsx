'use client'

import { Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary' | 'warning'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  if (!open) return null

  const confirmCls =
    tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500'
    : tone === 'warning' ? 'bg-amber-600 hover:bg-amber-500'
    : 'bg-indigo-600 hover:bg-indigo-500'

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
            {description && <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">{description}</p>}
          </div>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children && <div className="px-5 py-3">{children}</div>}
        <div className="px-5 py-4 flex justify-end gap-2 bg-slate-50/80 border-t border-slate-100">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-extrabold text-slate-700 hover:bg-white disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-extrabold disabled:opacity-50 ${confirmCls}`}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
