'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Zap, Shield, AlertCircle } from 'lucide-react'
import GoogleLoginButton from '@/components/GoogleLoginButton'

const trustBadges = [
  { label: 'SOC 2 Type II' },
  { label: 'GDPR Compliant' },
  { label: 'TLS 1.3 Encrypted' },
]

function LoginContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [status, router])

  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Could not start the Google sign-in flow.',
    OAuthCallback: 'Google returned an error during sign-in.',
    OAuthCreateAccount: 'Could not create your account. Please try again.',
    default: 'An unexpected error occurred. Please try again.',
  }
  const errorMsg = error ? (errorMessages[error] ?? errorMessages.default) : null

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] relative overflow-hidden">
      {/* Background orbs */}
      <div className="orb w-96 h-96 bg-indigo-600 -top-20 -left-20 opacity-20" />
      <div className="orb w-72 h-72 bg-purple-700 -bottom-10 -right-10 opacity-15" style={{ animationDelay: '-3s' }} />

      {/* Top left nav */}
      <div className="relative z-10 p-6">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">
            SRP <span className="gradient-text">AI Labs</span>
          </span>
        </Link>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="glass-card rounded-2xl p-8 shadow-2xl border border-white/10">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Headline */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-extrabold text-white">Welcome to SRP AI Labs</h1>
              <p className="mt-2 text-sm text-gray-500">
                Sign in to access your recruiting dashboard
              </p>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google button */}
            <GoogleLoginButton callbackUrl="/dashboard" />

            {/* Divider */}
            <div className="relative my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-gray-600">Secure sign-in</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {/* Trust info */}
            <p className="text-xs text-center text-gray-600 leading-relaxed">
              By signing in you agree to our{' '}
              <a href="#" className="text-indigo-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>.
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Shield className="w-3.5 h-3.5 text-gray-600" />
            {trustBadges.map((b, i) => (
              <span key={b.label} className="flex items-center gap-4">
                <span className="text-xs text-gray-600">{b.label}</span>
                {i < trustBadges.length - 1 && (
                  <span className="text-gray-700">·</span>
                )}
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
