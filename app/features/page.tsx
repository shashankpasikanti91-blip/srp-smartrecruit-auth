import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import FeaturesPageContent from '@/components/marketing/pages/FeaturesPageContent'
import { FEATURES_PAGE } from '@/content/marketing/features'

export const metadata: Metadata = {
  title: FEATURES_PAGE.meta.title,
  description: FEATURES_PAGE.meta.description,
}

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <FeaturesPageContent />
    </MarketingLayout>
  )
}
