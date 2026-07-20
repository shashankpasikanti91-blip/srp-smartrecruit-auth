'use client'

import { Download, Users } from 'lucide-react'
import { exportCsv } from '@/lib/exportCsv'

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
            <h1 className="page-title text-lg sm:text-xl">Recruiters</h1>
            <p className="text-sm text-slate-500 mt-0.5">{active.length} team members in this workspace</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(
            'recruiters.csv',
            ['Name', 'Email', 'Role', 'Last Active'],
            active.map(m => [m.name, m.email, m.role, m.last_active_at]),
          )}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
        >
          <Download className="w-4 h-4" /> Export Excel
        </button>
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
