import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import PricingPageContent from '@/components/marketing/pages/PricingPageContent'
import { PRICING_META } from '@/content/marketing/pricing'

export const metadata: Metadata = {
  title: PRICING_META.title,
  description: PRICING_META.description,
}

export default function PricingPage() {
  return (
    <MarketingLayout>
      <PricingPageContent />
    </MarketingLayout>
  )
}
