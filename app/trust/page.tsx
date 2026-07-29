'use client'

import Link from 'next/link'
import { Shield, Lock, Users, FileText, Database, Eye, Download, Headphones } from 'lucide-react'

const SECTIONS = [
  {
    icon: Database,
    title: 'Workspace isolation',
    body: 'Every agency runs in a tenant-scoped workspace. Jobs, candidates, notes, and communications are filtered by tenant_id on every API path.',
  },
  {
    icon: Users,
    title: 'Role-based access (RBAC)',
    body: 'Owners, admins, recruiters, and viewers receive least-privilege permissions. Destructive actions can require approval workflows.',
  },
  {
    icon: Lock,
    title: 'Encryption & credentials',
    body: 'Passwords are stored with bcrypt. OAuth tokens for Gmail/Outlook are encrypted at rest. Sessions use HttpOnly cookies with SameSite controls.',
  },
  {
    icon: FileText,
    title: 'Audit & accountability',
    body: 'Security-relevant actions (logins, exports, OAuth connect/disconnect, support access, password changes) are written to audit logs.',
  },
  {
    icon: Database,
    title: 'Backups & resilience',
    body: 'Database backups and disaster recovery are platform-managed. Ask your account contact for the current backup window and RPO/RTO targets.',
  },
  {
    icon: Eye,
    title: 'Data ownership & privacy',
    body: 'Your tenant owns candidate and job data. Processing practices are described in the Privacy Policy. AI outputs are recommendations — hiring decisions stay with humans.',
  },
  {
    icon: Download,
    title: 'Export & deletion',
    body: 'Tenant admins can export candidates, jobs, audit trails, AI usage history, communications, and notes. Deletion follows product retention and approval rules.',
  },
  {
    icon: Headphones,
    title: 'Support access policy',
    body: 'Platform operators cannot browse tenant candidate PII by default. Time-boxed support access requires an explicit Tenant Owner/Admin approval and is audited end-to-end.',
  },
]

export default function TrustCenterPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-bold text-indigo-700 hover:underline">← SRP SmartRecruit</Link>
          <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Open dashboard</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-start gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Trust Center</p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              How we protect recruitment data
            </h1>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-2xl">
              Transparent controls for isolation, access, encryption, audit, backups, ownership, privacy, export/deletion, and support access — without claiming certifications we have not verified.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {SECTIONS.map(s => (
            <article key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">{s.title}</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <p className="font-bold text-slate-900 mb-2">Questions?</p>
          <p>
            Security reports and DPA requests:{' '}
            <a className="text-indigo-700 font-semibold hover:underline" href="mailto:security@srpailabs.com">security@srpailabs.com</a>
            {' · '}
            <Link href="/legal/privacy" className="text-indigo-700 font-semibold hover:underline">Privacy Policy</Link>
            {' · '}
            <Link href="/support/contact" className="text-indigo-700 font-semibold hover:underline">Contact</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
