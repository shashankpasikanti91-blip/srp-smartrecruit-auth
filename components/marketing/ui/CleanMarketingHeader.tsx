'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { HEADER_NAV, MARKETING_ROUTES } from '@/content/marketing/navigation'

export default function CleanMarketingHeader() {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-marketing-black/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={MARKETING_ROUTES.home} className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-marketing-glow">
              <Zap className="w-4 h-4 text-white" aria-hidden />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              SRP <span className="marketing-gradient-text">Recruit AI</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {HEADER_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <>
                <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white">Dashboard</Link>
                <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-slate-500 hover:text-red-400">Sign Out</button>
              </>
            ) : (
              <>
                <Link href={MARKETING_ROUTES.login} className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2">Sign In</Link>
                <Link href={MARKETING_ROUTES.login} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-sm font-semibold btn-glow">Get Started</Link>
              </>
            )}
          </div>

          <button type="button" className="lg:hidden p-2 text-slate-400 hover:text-white" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/5 bg-marketing-black/98 backdrop-blur-xl px-4 py-4 space-y-1">
          {HEADER_NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-slate-300 border-b border-white/5">{item.label}</Link>
          ))}
          <div className="pt-4 flex flex-col gap-2">
            {session ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="py-2 text-sm text-cyan-400">Dashboard</Link>
            ) : (
              <>
                <Link href={MARKETING_ROUTES.login} onClick={() => setOpen(false)} className="py-2.5 text-center rounded-lg border border-white/10 text-sm text-white">Sign In</Link>
                <Link href={MARKETING_ROUTES.login} onClick={() => setOpen(false)} className="py-2.5 text-center rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-sm font-semibold text-white">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
