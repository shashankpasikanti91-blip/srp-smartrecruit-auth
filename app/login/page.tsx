'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import {
  AlertCircle, Brain, CheckCircle2, Eye, EyeOff, FileSearch,
  Loader2, Shield, Workflow,
} from 'lucide-react'
import { BrandMark } from '@/components/ui/BrandMark'

const trustBadges = ['SOC 2 Type II', 'GDPR Compliant', 'TLS 1.3 Encrypted']

const features = [
  {
    icon: Brain,
    title: 'AI Resume Screening',
    desc: 'Senior-level AI auditor scores every candidate against your JD.',
  },
  {
    icon: FileSearch,
    title: 'Hiring Funnel Analytics',
    desc: 'Real-time conversion, time-to-hire, and recruiter performance.',
  },
  {
    icon: Workflow,
    title: 'Recruitment Copilot',
    desc: 'JD writer, Boolean search, compose emails, and interview kits.',
  },
]

function LoginContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [status, router])

  useEffect(() => {
    const saved = localStorage.getItem('srp_remember_email')
    if (!saved) return
    queueMicrotask(() => {
      setEmail(saved)
      setRemember(true)
    })
  }, [])

  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Could not start the Google sign-in flow.',
    OAuthCallback: 'Google returned an error. Please try again.',
    OAuthCreateAccount: 'Could not create your account. Please try again.',
    CredentialsSignin: 'Invalid email or password.',
    default: 'An unexpected error occurred. Please try again.',
  }
  const oauthError = urlError ? (errorMessages[urlError] ?? errorMessages.default) : null

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!email || !password) {
      setFormError('Please enter your email and password.')
      return
    }
    setLoading(true)

    if (remember) localStorage.setItem('srp_remember_email', email.trim().toLowerCase())
    else localStorage.removeItem('srp_remember_email')

    const res = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })
    setLoading(false)

    if (res?.error) setFormError(errorMessages[res.error] ?? errorMessages.default)
    else router.replace(callbackUrl)
  }

  const handleGoogle = async () => {
    setLoading(true)
    await signIn('google', { callbackUrl })
  }

  const activeError = formError ?? oauthError

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-[#FCFCFA] overflow-x-clip">
      {/* Left — brand panel */}
      <aside className="relative lg:w-[48%] xl:w-[46%] bg-[#0B1F14] text-white px-6 sm:px-10 py-8 lg:py-12 flex flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#166534]/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#F97316]/20 blur-3xl" />

        <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto lg:mx-0 w-full">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors w-fit">
            ← srpailabs.com
          </Link>

          <div className="mt-8 lg:mt-12 flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <p className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>
                SRP SmartRecruit
              </p>
              <p className="text-sm text-[#F97316] font-medium">Powered by SRP AI Labs</p>
            </div>
          </div>

          <h1
            className="mt-8 lg:mt-12 text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
          >
            AI-powered Recruitment Operating System
          </h1>
          <p className="mt-4 text-base text-slate-300 leading-relaxed max-w-md">
            Screen resumes, match candidates to jobs, and run your hiring funnel — built for agencies and enterprise TA teams.
          </p>

          <ul className="mt-8 lg:mt-10 space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex-shrink-0 w-10 h-10 rounded-md bg-[#166534] border border-[#F97316]/40 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#F97316]" />
                </span>
                <div>
                  <p className="font-bold text-white text-sm sm:text-base">{title}</p>
                  <p className="text-sm text-slate-400 mt-0.5 leading-snug">{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-auto pt-10 text-xs text-slate-400 font-medium">
            Multi-tenant · Isolated per workspace · Audit-ready
          </p>
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 lg:py-12 bg-[#FCFCFA]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_rgba(17,24,39,0.06)] p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>
                Sign in
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">Welcome back — enter your workspace credentials.</p>
            </div>

            {activeError && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{activeError}</span>
              </div>
            )}

            <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Email address</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-[#166534] hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15 transition-colors"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <button
                  type="button"
                  onClick={() => setRemember(v => !v)}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    remember ? 'bg-[#166534] border-[#166534]' : 'border-slate-300 bg-white'
                  }`}
                  aria-pressed={remember}
                >
                  {remember && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
                <span className="text-sm text-slate-600 group-hover:text-slate-800">Remember me for 7 days</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#F97316] hover:bg-[#ea580c] disabled:opacity-60 text-[#0B1F14] text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Signing in…' : 'Sign in to SmartRecruit'}
              </button>
            </form>

            <div className="relative my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-semibold text-sm py-3 px-4 rounded-xl transition-colors border border-slate-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p className="mt-6 text-center text-sm text-slate-500">
              No account?{' '}
              <Link href="/signup" className="text-[#166534] hover:underline font-bold">Create workspace</Link>
            </p>

            <p className="mt-4 text-xs text-center text-slate-400 leading-relaxed">
              By signing in you agree to our{' '}
              <Link href="/legal/terms" className="text-[#166534] hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/legal/privacy" className="text-[#166534] hover:underline">Privacy Policy</Link>.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            {trustBadges.map((b, i) => (
              <span key={b} className="flex items-center gap-2 text-xs font-medium">
                <span>{b}</span>
                {i < trustBadges.length - 1 && <span className="text-slate-300">·</span>}
              </span>
            ))}
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            SmartRecruit is a product of SRP AI Labs
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#FCFCFA]" />}>
      <LoginContent />
    </Suspense>
  )
}
