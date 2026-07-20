'use client'

import { FEATURES_PAGE } from '@/content/marketing/features'
import { INNER_PAGE_CTA } from '@/content/marketing/cta'
import EditorialPageHero from '@/components/marketing/ui/EditorialPageHero'
import FeatureWorkflowSection from '@/components/marketing/sections/FeatureWorkflowSection'
import PremiumBentoGrid from '@/components/marketing/sections/PremiumBentoGrid'
import CTABlock from '@/components/marketing/ui/CTABlock'

export default function FeaturesPageContent() {
  const { hero } = FEATURES_PAGE

  return (
    <>
      <EditorialPageHero eyebrow={hero.eyebrow} title={hero.title} subtitle={hero.subtitle} />
      <FeatureWorkflowSection />
      <PremiumBentoGrid />
      <CTABlock
        title={INNER_PAGE_CTA.title}
        subtitle={INNER_PAGE_CTA.subtitle}
        primary={INNER_PAGE_CTA.primary}
        secondary={INNER_PAGE_CTA.secondary}
      />
    </>
  )
}
