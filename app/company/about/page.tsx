import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import AboutPageContent from '@/components/marketing/pages/AboutPageContent'

export const metadata: Metadata = {
  title: 'About | SRP Recruit AI',
  description: 'SRP AI Labs builds SRP Recruit AI for recruitment agencies — explainable AI with human oversight.',
}

export default function AboutPage() {
  return (
    <MarketingLayout>
      <AboutPageContent />
    </MarketingLayout>
  )
}
