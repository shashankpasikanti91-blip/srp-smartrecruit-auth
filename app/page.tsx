import MarketingLayout from '@/components/marketing/MarketingLayout'
import RecruitHeroStage from '@/components/marketing/sections/RecruitHeroStage'
import FullBleedImageTransition from '@/components/marketing/sections/FullBleedImageTransition'
import AgencyOperationsRoom from '@/components/marketing/sections/AgencyOperationsRoom'
import StickyProductStory from '@/components/marketing/sections/StickyProductStory'
import RecruitmentCommandCenter from '@/components/marketing/sections/RecruitmentCommandCenter'
import PremiumBentoGrid from '@/components/marketing/sections/PremiumBentoGrid'
import AgencyWorkflowJourney from '@/components/marketing/sections/AgencyWorkflowJourney'
import HumanReviewPanel from '@/components/marketing/sections/HumanReviewPanel'
import SecurityTrustPanel from '@/components/marketing/sections/SecurityTrustPanel'
import PremiumPricingSection from '@/components/marketing/sections/PremiumPricingSection'
import PortfolioBadge from '@/components/marketing/ui/PortfolioBadge'
import CinematicCTA from '@/components/marketing/sections/CinematicCTA'

export default function Home() {
  return (
    <MarketingLayout>
      <RecruitHeroStage />
      <FullBleedImageTransition />
      <AgencyOperationsRoom />
      <StickyProductStory />
      <RecruitmentCommandCenter />
      <PremiumBentoGrid />
      <AgencyWorkflowJourney />
      <HumanReviewPanel />
      <SecurityTrustPanel />
      <PremiumPricingSection showAllPlans />
      <PortfolioBadge />
      <CinematicCTA />
    </MarketingLayout>
  )
}
