'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { HEADER_NAV, MARKETING_ROUTES } from '@/content/marketing/navigation'
import { BrandMark } from '@/components/ui/BrandMark'

export default function CleanMarketingHeader() {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#E5E7EB] bg-[#FCFCFA]/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={MARKETING_ROUTES.home} className="flex items-center gap-2 shrink-0 group min-h-[44px]">
            <BrandMark size={32} />
            <span
              className="font-bold text-[#111827] text-lg tracking-tight"
              style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
            >
              SRP <span className="text-[#F97316]">SmartRecruit</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {HEADER_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-[#4B5563] hover:text-[#0B1F14] transition-colors rounded-lg hover:bg-[#ecfdf3] min-h-[44px] inline-flex items-center"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <>
                <Link href="/dashboard" className="text-sm text-[#4B5563] hover:text-[#0B1F14] min-h-[44px] inline-flex items-center">Dashboard</Link>
                <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-[#4B5563] hover:text-red-600 min-h-[44px]">Sign Out</button>
              </>
            ) : (
              <>
                <Link href={MARKETING_ROUTES.login} className="text-sm font-medium text-[#4B5563] hover:text-[#0B1F14] px-3 py-2 min-h-[44px] inline-flex items-center">Sign In</Link>
                <Link
                  href={MARKETING_ROUTES.login}
                  className="px-4 py-2 rounded-lg bg-[#F97316] text-[#0B1F14] text-sm font-bold min-h-[44px] inline-flex items-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button type="button" className="lg:hidden p-2 text-[#4B5563] hover:text-[#0B1F14] min-h-[44px] min-w-[44px]" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[#E5E7EB] bg-[#FCFCFA] px-4 py-4 space-y-1">
          {HEADER_NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block py-3 text-sm font-medium text-[#111827] border-b border-[#E5E7EB] min-h-[44px]">{item.label}</Link>
          ))}
          <div className="pt-4 flex flex-col gap-2">
            {session ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="py-3 text-sm text-[#166534] min-h-[44px]">Dashboard</Link>
            ) : (
              <>
                <Link href={MARKETING_ROUTES.login} onClick={() => setOpen(false)} className="py-3 text-center rounded-lg border border-[#E5E7EB] text-sm text-[#111827] min-h-[44px]">Sign In</Link>
                <Link href={MARKETING_ROUTES.login} onClick={() => setOpen(false)} className="py-3 text-center rounded-lg bg-[#F97316] text-sm font-bold text-[#0B1F14] min-h-[44px]">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
