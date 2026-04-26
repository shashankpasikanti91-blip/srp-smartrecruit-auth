'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Zap, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Shield, Users } from 'lucide-react'

type Strength = 'weak' | 'fair' | 'good' | 'strong'

function getStrength(pw: string): Strength | null {
  if (!pw) return null
  if (pw.length < 6) return 'weak'
  if (pw.length < 10) return 'fair'
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && pw.length >= 10) return 'strong'
  return 'good'
}

const strengthMeta: Record<Strength, { color: string; bar: string; label: string }> = {
  weak:   { color: 'text-red-400',     bar: 'w-1/4 bg-red-500',     label: 'Weak' },
  fair:   { color: 'text-amber-400',   bar: 'w-2/4 bg-amber-500',   label: 'Fair' },
  good:   { color: 'text-blue-400',    bar: 'w-3/4 bg-blue-500',    label: 'Good' },
  strong: { color: 'text-emerald-400', bar: 'w-full bg-emerald-500', label: 'Strong' },
}

interface InvitePreview {
  email: string
  tenantName: string
  role: string
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? undefined

  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [showCf, setShowCf]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [invite, setInvite]       = useState<InvitePreview | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Fetch invite preview when token is present
  useEffect(() => {
    if (!inviteToken) return
    fetch(`/api/tenant/invite?token=${encodeURIComponent(inviteToken)}`)
      .then(r => r.json())
      .then(data => {
        if (data.email) {
          setInvite({ email: data.email, tenantName: data.tenantName, role: data.role })
          setEmail(data.email)
        } else {
          setInviteError(data.error ?? 'Invalid invite link.')
        }
      })
      .catch(() => setInviteError('Could not load invite details.'))
  }, [inviteToken])

  const strength = getStrength(password)
  const pwMatch  = confirm.length > 0 && confirm === password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm)    { setError('Passwords do not match.'); return }
    if (password.length < 8)     { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(inviteToken ? { inviteToken } : {}),
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Sign up failed. Please try again.')
      setLoading(false)
      return
    }

    // Auto sign-in after successful signup
    const signInRes = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })
    setLoading(false)

    if (signInRes?.error) {
      router.push('/login?registered=1')
    } else {
      router.replace('/dashboard')
    }
  }

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

            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Invite banner */}
            {inviteToken && invite && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm">
                <Users className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-400" />
                <span>
                  You&apos;re joining <strong>{invite.tenantName}</strong> as <strong>{invite.role}</strong>.
                  Set a password to complete your account.
                </span>
              </div>
            )}
            {inviteToken && inviteError && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{inviteError}</span>
              </div>
            )}

            <div className="text-center mb-6">
              <h1 className="text-2xl font-extrabold text-white">
                {inviteToken ? 'Complete registration' : 'Create account'}
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                {inviteToken ? 'Accept your team invite' : 'Join SRP Recruit AI Labs'}
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Full name */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name</label>
                <input
                  type="text" autoComplete="name" required
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* Email — locked to invite email if present */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={e => !inviteToken && setEmail(e.target.value)}
                  readOnly={!!inviteToken}
                  placeholder="you@company.com"
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${inviteToken ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} autoComplete="new-password" required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {strength && (
                  <div className="mt-2">
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strengthMeta[strength].bar}`} />
                    </div>
                    <p className={`text-xs mt-1 ${strengthMeta[strength].color}`}>
                      {strengthMeta[strength].label} password
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm password</label>
                <div className="relative">
                  <input
                    type={showCf ? 'text' : 'password'} autoComplete="new-password" required
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-colors ${
                      confirm && !pwMatch
                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                        : pwMatch
                        ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500'
                        : 'border-white/10 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowCf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {pwMatch
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading || (!!inviteToken && !!inviteError)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Creating account…' : inviteToken ? 'Accept invite & sign up' : 'Create account'}
              </button>

              <p className="text-center text-xs text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-indigo-400 hover:underline font-medium">Sign in</Link>
              </p>
            </form>

            {/* Google sign-up — hide when completing an invite (token-bound to specific email) */}
            {!inviteToken && (
              <>
                <div className="relative my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-xs text-gray-600">or sign up with</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-900 font-medium text-sm py-3 px-4 rounded-xl transition-colors shadow"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Shield className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-600">SOC 2 Type II</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-600">GDPR Compliant</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-600">TLS 1.3 Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
