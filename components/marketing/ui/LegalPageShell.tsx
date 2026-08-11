import { type ReactNode } from 'react'
import PageHero from '@/components/marketing/ui/PageHero'
import MarketingSection from '@/components/marketing/ui/MarketingSection'

type LegalPageShellProps = {
  eyebrow: string
  title: string
  subtitle?: string
  children: ReactNode
}

/** Clean legal/trust page layout — readable prose, premium shell. */
export default function LegalPageShell({ eyebrow, title, subtitle, children }: LegalPageShellProps) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle ?? ''} variant="gradient" />
      <MarketingSection variant="mid" padding="compact">
        <article className="max-w-3xl mx-auto prose prose-invert prose-slate prose-headings:font-display prose-headings:text-white prose-p:text-slate-400 prose-li:text-slate-400 prose-a:text-[#F97316]">
          {children}
        </article>
      </MarketingSection>
    </>
  )
}
