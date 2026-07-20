import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import ContactPageContent from '@/components/marketing/pages/ContactPageContent'
import { CONTACT_PAGE } from '@/content/marketing/contact'

export const metadata: Metadata = {
  title: CONTACT_PAGE.meta.title,
  description: CONTACT_PAGE.meta.description,
}

export default function ContactPage() {
  return (
    <MarketingLayout>
      <ContactPageContent />
    </MarketingLayout>
  )
}
