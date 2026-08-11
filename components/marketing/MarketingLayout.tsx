import CleanMarketingHeader from '@/components/marketing/ui/CleanMarketingHeader'
import CleanMarketingFooter from '@/components/marketing/ui/CleanMarketingFooter'

type MarketingLayoutProps = {
  children: React.ReactNode
  className?: string
}

export default function MarketingLayout({ children, className = '' }: MarketingLayoutProps) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#166534] focus:text-white focus:font-semibold">
        Skip to main content
      </a>
      <CleanMarketingHeader />
      <main id="main-content" className={`overflow-x-hidden bg-[#FCFCFA] ${className}`}>
        {children}
      </main>
      <CleanMarketingFooter />
    </>
  )
}
