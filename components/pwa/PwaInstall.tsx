'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Share, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])
  return null
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    const t = window.setTimeout(() => {
      if (isStandalone()) setInstalled(true)
    }, 0)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(t)
    }
  }, [])

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferred(null)
      return
    }
    setIosHint(v => !v)
  }, [deferred])

  if (installed) return null

  const phoneOrTablet =
    isIos()
    || (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches)
  if (compact && !deferred && !phoneOrTablet) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void install()}
        className={
          compact
            ? 'inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2.5 rounded-lg border border-[#166534]/30 bg-[#ecfdf3] text-[#166534] text-[11px] font-extrabold'
            : 'inline-flex items-center justify-center gap-2 min-h-[44px] w-full px-4 rounded-xl bg-[#F97316] text-white text-sm font-extrabold'
        }
        aria-label="Install SRP SmartRecruit on this phone or tablet"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : undefined}>Install</span>
      </button>
      {iosHint && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[min(16rem,calc(100vw-1.5rem))] rounded-xl border border-[#166534]/20 bg-white p-3 shadow-lg text-left">
          <p className="text-xs font-extrabold text-[#166534] flex items-center gap-1">
            <Share className="w-3.5 h-3.5" /> Add to Home Screen
          </p>
          <p className="text-[11px] font-medium text-slate-600 mt-1.5 leading-relaxed">
            iPhone / iPad: tap Share, then <strong>Add to Home Screen</strong>. Android / tablet: tap Install when Chrome shows it, or Chrome menu → Install app.
          </p>
          <button type="button" className="mt-2 text-[11px] font-bold text-[#c2410c]" onClick={() => setIosHint(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  )
}

export function PwaInstallBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return
    if (typeof localStorage !== 'undefined' && localStorage.getItem('srp-pwa-dismiss') === '1') return
    const phoneOrTablet = () =>
      isIos() || window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      if (phoneOrTablet()) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const t = window.setTimeout(() => {
      if (phoneOrTablet()) setShow(true)
    }, 0)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.clearTimeout(t)
    }
  }, [])

  if (!show) return null

  const aboveTabBar = pathname === '/m' || pathname.startsWith('/m/')

  return (
    <div
      className={`fixed inset-x-3 z-[70] mx-auto max-w-lg rounded-2xl border border-[#166534]/25 bg-white shadow-xl px-4 py-3 flex items-start gap-3 ${
        aboveTabBar
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[#0B1F14]">Install SmartRecruit</p>
        <p className="text-[12px] font-medium text-slate-600 mt-0.5">
          {isIos()
            ? 'Share → Add to Home Screen for iPhone and iPad.'
            : 'Add to your phone or tablet home screen — works offline for the app shell.'}
        </p>
      </div>
      {deferred ? (
        <button
          type="button"
          className="shrink-0 min-h-[44px] px-3 rounded-xl bg-[#F97316] text-white text-xs font-extrabold"
          onClick={async () => {
            await deferred.prompt()
            setShow(false)
            setDeferred(null)
          }}
        >
          Install
        </button>
      ) : isIos() ? (
        <p className="shrink-0 text-[10px] font-extrabold text-[#166534] leading-tight text-right pt-1">
          Share →<br />Add to Home Screen
        </p>
      ) : null}
      <button
        type="button"
        className="shrink-0 p-2 min-h-[44px] min-w-[44px] text-slate-400"
        aria-label="Dismiss install"
        onClick={() => {
          setShow(false)
          try { localStorage.setItem('srp-pwa-dismiss', '1') } catch { /* ignore */ }
        }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
