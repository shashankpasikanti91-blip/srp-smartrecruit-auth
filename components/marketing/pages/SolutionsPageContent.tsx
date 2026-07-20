'use client'

import { SOLUTIONS_PAGE } from '@/content/marketing/solutions'
import { INNER_PAGE_CTA } from '@/content/marketing/cta'
import EditorialPageHero from '@/components/marketing/ui/EditorialPageHero'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import CTABlock from '@/components/marketing/ui/CTABlock'
import SolutionsScrollytelling from '@/components/marketing/sections/SolutionsScrollytelling'

export default function SolutionsPageContent() {
  const { hero } = SOLUTIONS_PAGE

  return (
    <>
      <EditorialPageHero eyebrow={hero.eyebrow} title={hero.title} subtitle={hero.subtitle} />

      <CinematicSection variant="bleed" className="py-0">
        <SolutionsScrollytelling />
      </CinematicSection>

      <CTABlock
        title={INNER_PAGE_CTA.title}
        subtitle={INNER_PAGE_CTA.subtitle}
        primary={INNER_PAGE_CTA.primary}
        secondary={INNER_PAGE_CTA.secondary}
      />
    </>
  )
}
