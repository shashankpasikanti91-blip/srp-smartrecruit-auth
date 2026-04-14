'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'

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

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCf, setShowCf]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  const strength = getStrength(password)
  const pwMatch  = confirm.length > 0 && confirm === password

  if (!token) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/15 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white mb-2">Invalid Reset Link</h1>
        <p className="text-sm text-gray-400 mb-6">This link is invalid or has expired. Please request a new password reset.</p>
        <Link href="/forgot-password"
          className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
          Request New Link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white mb-2">Password Updated!</h1>
        <p className="text-sm text-gray-400 mb-6">Your password has been successfully reset. You can now sign in with your new password.</p>
        <button onClick={() => router.push('/login')}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
          Sign In Now
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-indigo-400" />
        </div>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold text-white">Set New Password</h1>
        <p className="mt-1.5 text-sm text-gray-500">Choose a strong password for your account</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* New password */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'} autoComplete="new-password" required autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {strength && (
            <div className="mt-2">
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${strengthMeta[strength].bar}`} />
              </div>
              <p className={`text-xs mt-1 ${strengthMeta[strength].color}`}>{strengthMeta[strength].label} password</p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
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

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] relative overflow-hidden">
      <div className="orb w-96 h-96 bg-indigo-600 -top-20 -left-20 opacity-20" />
      <div className="orb w-72 h-72 bg-purple-700 -bottom-10 -right-10 opacity-15" style={{ animationDelay: '-3s' }} />

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

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="glass-card rounded-2xl p-8 shadow-2xl border border-white/10">
            <Suspense fallback={<div className="text-center text-gray-400">Loading...</div>}>
              <ResetPasswordContent />
            </Suspense>
          </div>
        </div>
      </div>

      <style jsx>{`
        .orb { position: absolute; border-radius: 50%; filter: blur(120px); pointer-events: none; animation: float 8s ease-in-out infinite; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(40px); }
        .gradient-text { background: linear-gradient(135deg,#818cf8,#c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>
    </div>
  )
}
