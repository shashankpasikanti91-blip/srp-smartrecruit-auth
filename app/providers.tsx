'use client'

import { SessionProvider } from 'next-auth/react'
import { type Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'
import { PwaInstallBanner, PwaRegister } from '@/components/pwa/PwaInstall'

interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <PwaRegister />
      <ToastProvider>{children}</ToastProvider>
      <PwaInstallBanner />
    </SessionProvider>
  )
}
