import PremiumPricingSection from '@/components/marketing/sections/PremiumPricingSection'
import EditorialPageHero from '@/components/marketing/ui/EditorialPageHero'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import { PRICING_HERO, PRICING_TRUST } from '@/content/marketing/pricing'
import { Check } from 'lucide-react'
import CTABlock from '@/components/marketing/ui/CTABlock'

export default function PricingPageContent() {
  return (
    <>
      <EditorialPageHero
        eyebrow={PRICING_HERO.eyebrow}
        title={PRICING_HERO.title}
        size="compact"
      />
      <PremiumPricingSection showAllPlans />
      <CinematicSection variant="bleed" className="py-16">
        <ul className="max-w-xl mx-auto px-4 space-y-3">
          {PRICING_TRUST.map((note) => (
            <li key={note} className="flex items-start gap-2 text-sm text-slate-400">
              <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden />{note}
            </li>
          ))}
        </ul>
      </CinematicSection>
      <CTABlock
        title="Not sure which plan fits your desk?"
        subtitle="Tell us about your client load and screening volume."
        primary={{ label: 'Contact sales', href: '/support/contact' }}
        secondary={{ label: 'Explore features', href: '/features' }}
      />
    </>
  )
}
