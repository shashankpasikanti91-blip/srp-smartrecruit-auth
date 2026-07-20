import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import SecurityPageContent from '@/components/marketing/pages/SecurityPageContent'
import { SECURITY_PAGE } from '@/content/marketing/security'

export const metadata: Metadata = {
  title: SECURITY_PAGE.meta.title,
  description: SECURITY_PAGE.meta.description,
}

export default function SecurityPage() {
  return (
    <MarketingLayout>
      <SecurityPageContent />
    </MarketingLayout>
  )
}
