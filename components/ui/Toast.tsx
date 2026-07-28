'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

type ToastItem = {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

type ToastContextValue = {
  toast: (opts: { title: string; description?: string; tone?: ToastTone }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-rose-200 bg-rose-50 text-rose-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-sky-200 bg-sky-50 text-sky-950',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: { title: string; description?: string; tone?: ToastTone }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description,
      tone: opts.tone ?? 'info',
    }
    setItems(prev => [...prev.slice(-4), item])
    window.setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
        {items.map(t => {
          const Icon = ICONS[t.tone]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl border shadow-lg px-3.5 py-3 flex items-start gap-2.5 ${TONES[t.tone]}`}
              role="status"
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-snug">{t.title}</p>
                {t.description && <p className="text-xs font-medium mt-0.5 opacity-90">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="p-1 rounded-md hover:bg-black/5 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      toast: (opts: { title: string; description?: string; tone?: ToastTone }) => {
        if (typeof window !== 'undefined') {
          // Fallback when provider missing
          console.info('[toast]', opts.title, opts.description ?? '')
        }
      },
    }
  }
  return ctx
}
