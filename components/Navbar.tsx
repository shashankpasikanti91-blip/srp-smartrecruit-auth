'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

interface NavbarProps {
  transparent?: boolean
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()

  const navLinks = [
    { href: '/#features', label: 'Features' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/#about', label: 'About' },
  ]

  const baseClass = transparent
    ? 'fixed top-0 left-0 right-0 z-50 bg-transparent'
    : 'fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5'

  return (
    <nav className={baseClass}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/40 transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              SRP <span className="gradient-text">Recruit AI Labs</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                {session.user?.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? 'User'}
                    width={32}
                    height={32}
                    className="rounded-full border border-indigo-500/40"
                  />
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-sm text-gray-400 hover:text-red-400 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-300 hover:text-white transition-colors font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors btn-glow"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden bg-[#0f0f1a]/95 backdrop-blur-xl border-t border-white/5 px-4 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-gray-300 hover:text-white text-sm font-medium border-b border-white/5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            {session ? (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)} className="block py-2 text-sm text-indigo-400">
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-left text-sm text-gray-400 hover:text-red-400 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
              >
                Get Started Free
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
