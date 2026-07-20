import type { ReactNode } from 'react'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import PageHero from '@/components/marketing/ui/PageHero'
import MarketingSection from '@/components/marketing/ui/MarketingSection'
import CTABlock from '@/components/marketing/ui/CTABlock'

type SimpleMarketingPageProps = {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
  cta?: { title: string; subtitle: string }
}

/** Distinct simple layout for resource/support placeholder pages. */
export function SimpleMarketingPage({ eyebrow, title, subtitle, children, cta }: SimpleMarketingPageProps) {
  return (
    <MarketingLayout>
      <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle} variant="gradient" />
      <MarketingSection variant="mid" padding="compact">
        <div className="max-w-2xl mx-auto text-center space-y-4">{children}</div>
      </MarketingSection>
      {cta && (
        <CTABlock
          title={cta.title}
          subtitle={cta.subtitle}
          primary={{ label: 'Book a demo', href: '/support/contact' }}
          secondary={{ label: 'Help center', href: '/support/help' }}
        />
      )}
    </MarketingLayout>
  )
}
