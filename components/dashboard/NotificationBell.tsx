'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Check } from 'lucide-react'

type Notif = {
  id: string
  category: string
  title: string
  body?: string | null
  is_read: boolean
  created_at: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnread(data.unread ?? 0)
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const markAll = async () => {
    setLoading(true)
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      })
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-extrabold text-slate-900">Notifications</p>
              <button type="button" onClick={markAll} disabled={loading || unread === 0}
                className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 inline-flex items-center gap-1">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Mark all read
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-sm font-bold text-slate-500 text-center">No notifications yet.</li>
              ) : items.map(n => (
                <li key={n.id} className={`px-4 py-3 ${n.is_read ? 'bg-white' : 'bg-indigo-50/50'}`}>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-600">{n.category}</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{n.title}</p>
                  {n.body && <p className="text-xs font-medium text-slate-600 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] font-medium text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
