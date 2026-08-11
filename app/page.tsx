import MarketingLayout from '@/components/marketing/MarketingLayout'
import PhotoHero from '@/components/marketing/site/PhotoHero'
import StoryChapters from '@/components/marketing/site/StoryChapters'
import WeekStrip from '@/components/marketing/site/WeekStrip'
import FeatureShowcase from '@/components/marketing/site/FeatureShowcase'
import QuietPricing from '@/components/marketing/site/QuietPricing'
import CloseStill from '@/components/marketing/site/CloseStill'

export default function Home() {
  return (
    <MarketingLayout>
      <PhotoHero />
      <StoryChapters />
      <WeekStrip />
      <FeatureShowcase />
      <QuietPricing />
      <CloseStill />
    </MarketingLayout>
  )
}
