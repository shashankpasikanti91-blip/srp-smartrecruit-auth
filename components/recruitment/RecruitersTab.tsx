'use client'

import { Users, Loader2 } from 'lucide-react'

type Member = {
  user_id: string
  name: string | null
  email: string
  role: string
  invite_accepted: boolean
  last_active_at: string | null
}

export function RecruitersTab({ teamMembers }: { teamMembers: Member[] }) {
  const active = teamMembers.filter(m => m.invite_accepted)

  return (
    <div>
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Users className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Recruiters</h1>
            <p className="text-sm text-slate-500 mt-0.5">{active.length} team members in this workspace</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="ent-table w-full">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Active</th></tr></thead>
          <tbody>
            {active.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-slate-400">No team members</td></tr>
            ) : active.map(m => (
              <tr key={m.user_id}>
                <td className="font-medium">{m.name || '—'}</td>
                <td>{m.email}</td>
                <td><span className="text-xs capitalize px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800">{m.role}</span></td>
                <td className="text-xs text-slate-500">{m.last_active_at ? new Date(m.last_active_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
