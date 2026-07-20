'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Bell, Briefcase, FileCheck, Home, LogOut, User,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

const NAV = [
  { href: '/m', label: 'Home', icon: Home },
  { href: '/m#offers', label: 'Offers', icon: Briefcase },
  { href: '/m#docs', label: 'Docs', icon: FileCheck },
  { href: '/m#notifications', label: 'Alerts', icon: Bell },
  { href: '/dashboard', label: 'Full app', icon: BarChart3 },
] as const

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between safe-top">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Manager</p>
          <h1 className="text-base font-extrabold text-slate-900 page-title">SRP Recruit</h1>
        </div>
        <div className="flex items-center gap-2">
          {status === 'authenticated' ? (
            <>
              <div className="hidden xs:flex items-center gap-1.5 text-xs font-semibold text-slate-600 max-w-[120px] truncate">
                <User className="w-3.5 h-3.5 shrink-0" />
                {session?.user?.name ?? session?.user?.email}
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : status === 'loading' ? (
            <span className="text-xs font-semibold text-slate-400">…</span>
          ) : (
            <Link href="/" className="text-xs font-extrabold text-indigo-700">Sign in</Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <ul className="flex items-stretch justify-around max-w-lg mx-auto">
          {NAV.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href.startsWith('/m#') && false)
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-extrabold transition-colors ${
                    active ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-indigo-600' : ''}`} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
