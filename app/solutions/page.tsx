import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import SolutionsPageContent from '@/components/marketing/pages/SolutionsPageContent'
import { SOLUTIONS_PAGE } from '@/content/marketing/solutions'

export const metadata: Metadata = {
  title: SOLUTIONS_PAGE.meta.title,
  description: SOLUTIONS_PAGE.meta.description,
}

export default function SolutionsPage() {
  return (
    <MarketingLayout>
      <SolutionsPageContent />
    </MarketingLayout>
  )
}
