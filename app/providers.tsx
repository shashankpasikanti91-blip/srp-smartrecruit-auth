'use client'

import { SessionProvider } from 'next-auth/react'
import { type Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'

interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  )
}
