'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2, Check, Archive, Trash2, ExternalLink } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

type Notif = {
  id: string
  category: string
  title: string
  body?: string | null
  link?: string | null
  is_read: boolean
  is_archived?: boolean
  created_at: string
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (showArchived) params.set('archived', '1')
      const res = await fetch(`/api/notifications?${params}`)
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnread(data.unread ?? 0)
    } catch {
      setItems([])
    }
  }, [showArchived])

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

  const act = async (action: 'mark_read' | 'archive' | 'delete', id: string) => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids: [id] }),
    })
    await load()
  }

  const openItem = async (n: Notif) => {
    if (!n.is_read) await act('mark_read', n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
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
          <div
            role="dialog"
            aria-label="Notifications panel"
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 gap-2">
              <p className="text-sm font-extrabold text-slate-900" id="notif-panel-title">Notifications</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchived(v => !v)}
                  className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-700"
                >
                  {showArchived ? 'Active' : 'Archived'}
                </button>
                <button type="button" onClick={markAll} disabled={loading || unread === 0}
                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 inline-flex items-center gap-1">
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Mark all
                </button>
              </div>
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 ? (
                <li>
                  <EmptyState
                    title={showArchived ? 'No archived notifications' : 'No notifications yet'}
                    description="Ownership, interviews, offers, AI jobs, and mentions will appear here."
                    icon={<Bell className="w-5 h-5" />}
                  />
                </li>
              ) : items.map(n => (
                <li key={n.id} className={`px-3 py-3 ${n.is_read ? 'bg-white' : 'bg-indigo-50/50'}`}>
                  <button type="button" onClick={() => void openItem(n)} className="w-full text-left">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-600">{n.category}</p>
                    <p className="text-sm font-extrabold text-slate-900 mt-0.5 flex items-center gap-1">
                      {n.title}
                      {n.link && <ExternalLink className="w-3 h-3 text-slate-400" />}
                    </p>
                    {n.body && <p className="text-xs font-medium text-slate-600 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </button>
                  <div className="mt-2 flex gap-1">
                    {!n.is_read && (
                      <button type="button" onClick={() => void act('mark_read', n.id)} className="text-[10px] font-bold text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50">
                        Mark read
                      </button>
                    )}
                    {!showArchived && (
                      <button type="button" onClick={() => void act('archive', n.id)} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 px-2 py-1 rounded-md hover:bg-slate-100">
                        <Archive className="w-3 h-3" /> Archive
                      </button>
                    )}
                    <button type="button" onClick={() => void act('delete', n.id)} className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 px-2 py-1 rounded-md hover:bg-rose-50">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
