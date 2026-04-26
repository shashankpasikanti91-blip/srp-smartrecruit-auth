'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { Zap, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface InviteDetails {
  email: string
  name: string | null
  tenantName: string
  tenantSlug: string
  role: string
}

function AcceptInviteContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const token   = params.get('token') ?? ''
  const { data: session, status } = useSession()

  const [invite,  setInvite]  = useState<InviteDetails | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  // Load invite details
  useEffect(() => {
    if (!token) { setError('No invite token found.'); return }
    fetch(`/api/tenant/invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.email) setInvite(data)
        else setError(data.error ?? 'Invalid invite link.')
      })
      .catch(() => setError('Could not load invite details.'))
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/tenant/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setDone(true)
        // Redirect to dashboard after a brief pause to let the session refresh
        setTimeout(() => router.replace('/dashboard'), 1500)
      } else {
        setError(data.error ?? 'Failed to accept invite.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Not authenticated ───────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  const callbackUrl = `/accept-invite?token=${encodeURIComponent(token)}`

  if (status === 'unauthenticated') {
    return (
      <PageShell>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-white">Team invite</h1>
          {invite ? (
            <p className="mt-2 text-sm text-gray-400">
              Sign in to accept your invite to <strong className="text-white">{invite.tenantName}</strong>.
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Sign in to accept your team invite.</p>
          )}
        </div>
        {error && <ErrorBox msg={error} />}
        {!error && !invite && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>}
        {invite && (
          <InviteBadge invite={invite} />
        )}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => signIn(undefined, { callbackUrl })}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Sign in to accept
          </button>
          <p className="text-center text-xs text-gray-600">
            New to SRP?{' '}
            <Link href={`/signup?invite=${encodeURIComponent(token)}`} className="text-indigo-400 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </PageShell>
    )
  }

  // ── Authenticated ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <PageShell>
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white">Invite accepted!</h1>
          <p className="text-sm text-gray-400 mt-2">Redirecting to your dashboard…</p>
        </div>
      </PageShell>
    )
  }

  const sessionEmail = session?.user?.email ?? ''
  const emailMismatch = invite && invite.email !== sessionEmail

  return (
    <PageShell>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold text-white">Accept team invite</h1>
        {invite && (
          <p className="mt-2 text-sm text-gray-400">
            You&apos;ve been invited to join <strong className="text-white">{invite.tenantName}</strong>
          </p>
        )}
      </div>

      {!invite && !error && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      )}

      {error && <ErrorBox msg={error} />}

      {emailMismatch && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            This invite is for <strong>{invite!.email}</strong> but you&apos;re signed in as{' '}
            <strong>{sessionEmail}</strong>. Please sign in with the correct account.
          </span>
        </div>
      )}

      {invite && !emailMismatch && (
        <>
          <InviteBadge invite={invite} />
          <button
            onClick={handleAccept}
            disabled={loading}
            className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Accepting…' : `Join ${invite.tenantName}`}
          </button>
        </>
      )}

      <p className="mt-4 text-center text-xs text-gray-600">
        Signed in as <span className="text-gray-400">{sessionEmail}</span>
      </p>
    </PageShell>
  )
}

// ── Small shared sub-components ───────────────────────────────────────────────
function InviteBadge({ invite }: { invite: InviteDetails }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
      <Users className="w-5 h-5 text-indigo-400 shrink-0" />
      <div>
        <p className="text-sm font-medium text-indigo-200">{invite.tenantName}</p>
        <p className="text-xs text-gray-400">Role: <span className="capitalize">{invite.role}</span></p>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] relative overflow-hidden">
      <div className="orb w-96 h-96 bg-indigo-600 -top-20 -left-20 opacity-20" />
      <div className="orb w-72 h-72 bg-purple-700 -bottom-10 -right-10 opacity-15"
        style={{ animationDelay: '-3s' }} />

      <div className="relative z-10 p-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">
            SRP <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Recruit AI Labs</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="glass-card rounded-2xl p-8 shadow-2xl border border-white/10">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  )
}
