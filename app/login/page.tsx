'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { Zap, Shield, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'

const trustBadges = ['SOC 2 Type II', 'GDPR Compliant', 'TLS 1.3 Encrypted']

function LoginContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [tab, setTab]           = useState<'email' | 'google'>('email')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Redirect if already signed in
  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [status, router])

  // Pre-fill email if remember me was set previously
  useEffect(() => {
    const saved = localStorage.getItem('srp_remember_email')
    if (saved) { setEmail(saved); setRemember(true) }
  }, [])

  const errorMessages: Record<string, string> = {
    OAuthSignin:        'Could not start the Google sign-in flow.',
    OAuthCallback:      'Google returned an error. Please try again.',
    OAuthCreateAccount: 'Could not create your account. Please try again.',
    CredentialsSignin:  'Invalid email or password.',
    default:            'An unexpected error occurred. Please try again.',
  }
  const oauthError = urlError ? (errorMessages[urlError] ?? errorMessages.default) : null

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!email || !password) { setFormError('Please enter your email and password.'); return }
    setLoading(true)

    if (remember) {
      localStorage.setItem('srp_remember_email', email.trim().toLowerCase())
    } else {
      localStorage.removeItem('srp_remember_email')
    }

    const res = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })
    setLoading(false)

    if (res?.error) {
      setFormError(errorMessages[res.error] ?? errorMessages.default)
    } else {
      router.replace(callbackUrl)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    await signIn('google', { callbackUrl })
  }

  const activeError = formError ?? oauthError

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] relative overflow-hidden">
      <div className="orb w-96 h-96 bg-indigo-600 -top-20 -left-20 opacity-20" />
      <div className="orb w-72 h-72 bg-purple-700 -bottom-10 -right-10 opacity-15" style={{ animationDelay: '-3s' }} />

      {/* Nav */}
      <div className="relative z-10 p-6">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">
            SRP <span className="gradient-text">Recruit AI Labs</span>
          </span>
        </Link>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="glass-card rounded-2xl p-8 shadow-2xl border border-white/10">

            {/* Heading */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-extrabold text-white">Welcome back</h1>
              <p className="mt-1.5 text-sm text-gray-500">Sign in to continue to SmartRecruit</p>
            </div>

            {/* Error */}
            {activeError && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{activeError}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-6 gap-1">
              {(['email', 'google'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setFormError(null) }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                    tab === t ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'email' ? 'Email' : 'Google'}
                </button>
              ))}
            </div>

            {/* ── EMAIL TAB ─────────────────────────────── */}
            {tab === 'email' ? (
              <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
                  <input
                    type="email" autoComplete="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-400">Password</label>
                    <Link href="/login" className="text-xs text-indigo-400 hover:underline">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} autoComplete="current-password" required
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <button type="button" onClick={() => setRemember(v => !v)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      remember ? 'bg-indigo-600 border-indigo-600' : 'border-white/20 bg-white/5'
                    }`}
                  >
                    {remember && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Remember me</span>
                </label>

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="text-center text-xs text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="text-indigo-400 hover:underline font-medium">Create one</Link>
                </p>
              </form>

            ) : (
              /* ── GOOGLE TAB ─────────────────────────── */
              <div className="space-y-4">
                <button onClick={handleGoogle} disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-900 font-medium text-sm py-3 px-4 rounded-xl transition-colors shadow">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-600" /> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continue with Google
                </button>
                <p className="text-center text-xs text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="text-indigo-400 hover:underline font-medium">Create one</Link>
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="relative my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-gray-600">Secure sign-in</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <p className="text-xs text-center text-gray-600 leading-relaxed">
              By signing in you agree to our{' '}
              <a href="#" className="text-indigo-400 hover:underline">Terms of Service</a>{' '}and{' '}
              <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>.
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Shield className="w-3.5 h-3.5 text-gray-600" />
            {trustBadges.map((b, i) => (
              <span key={b} className="flex items-center gap-3">
                <span className="text-xs text-gray-600">{b}</span>
                {i < trustBadges.length - 1 && <span className="text-gray-700">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <LoginContent />
    </Suspense>
  )
}
