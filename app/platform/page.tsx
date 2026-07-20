import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import PlatformPageContent from '@/components/marketing/pages/PlatformPageContent'
import { PLATFORM_PAGE } from '@/content/marketing/platform'

export const metadata: Metadata = {
  title: PLATFORM_PAGE.meta.title,
  description: PLATFORM_PAGE.meta.description,
}

export default function PlatformPage() {
  return (
    <MarketingLayout>
      <PlatformPageContent />
    </MarketingLayout>
  )
}
