'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
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

            {sent ? (
              /* ── Success State ──────────────────────────── */
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h1 className="text-xl font-extrabold text-white mb-2">Check Your Email</h1>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  If an account exists for <span className="text-white font-medium">{email}</span>, we&apos;ve sent a password reset link. Check your inbox and spam folder.
                </p>
                <div className="space-y-3">
                  <button onClick={() => { setSent(false); setEmail('') }}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">
                    Try a different email
                  </button>
                  <Link href="/login"
                    className="block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors">
                    Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Form State ───────────────────────────── */
              <>
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-indigo-400" />
                  </div>
                </div>

                <div className="text-center mb-6">
                  <h1 className="text-2xl font-extrabold text-white">Forgot Password?</h1>
                  <p className="mt-1.5 text-sm text-gray-500">Enter your email and we&apos;ll send you a reset link</p>
                </div>

                {error && (
                  <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
                    <input
                      type="email" autoComplete="email" required autoFocus
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>

                  <Link href="/login"
                    className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-indigo-400 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                  </Link>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Trust */}
      <div className="relative z-10 pb-8 flex justify-center gap-6">
        {['SOC 2 Type II', 'GDPR Compliant', 'TLS 1.3 Encrypted'].map(b => (
          <span key={b} className="text-xs text-gray-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" /> {b}
          </span>
        ))}
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
