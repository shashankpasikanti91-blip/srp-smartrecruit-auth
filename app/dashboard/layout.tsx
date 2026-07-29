'use client'

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // The main dashboard (`/dashboard`) already renders its own sidebar.
  // Only wrap deeper pages (Candidate 360 / Job 360) so the left nav stays visible.
  if (pathname === '/dashboard') return <>{children}</>

  return <DashboardShell>{children}</DashboardShell>
}

