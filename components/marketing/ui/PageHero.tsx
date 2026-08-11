import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MarketingSection from './MarketingSection'

type PageHeroProps = {
  eyebrow: string
  title: string
  subtitle: string
  align?: 'center' | 'left'
  cta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  visual?: React.ReactNode
  variant?: 'grid' | 'mid' | 'gradient'
}

export default function PageHero({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  cta,
  secondaryCta,
  visual,
  variant = 'grid',
}: PageHeroProps) {
  const centered = align === 'center'

  return (
    <MarketingSection variant={variant} padding="hero" className="overflow-hidden relative">
      <div className={`absolute inset-0 pointer-events-none ${centered ? '' : ''}`} aria-hidden>
        <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-[#166534]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-[#F97316]/10 rounded-full blur-3xl" />
      </div>

      <div className={`relative z-10 grid grid-cols-1 ${visual ? 'lg:grid-cols-2' : ''} gap-12 items-center`}>
        <div className={centered && !visual ? 'max-w-3xl mx-auto text-center' : 'max-w-xl'}>
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full marketing-glass text-xs font-semibold text-[#F97316] mb-5">
            {eyebrow}
          </p>
          <h1 className={`font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-white leading-[1.1] tracking-tight ${centered && !visual ? '' : ''}`}>
            {title}
          </h1>
          <p className={`mt-5 text-lg text-slate-400 leading-relaxed ${centered && !visual ? 'max-w-2xl mx-auto' : ''}`}>
            {subtitle}
          </p>
          {(cta || secondaryCta) && (
            <div className={`mt-8 flex flex-col sm:flex-row gap-3 ${centered && !visual ? 'justify-center' : ''}`}>
              {cta && (
                <Link
                  href={cta.href}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#F97316] text-[#0B1F14] font-bold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  {cta.label}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
              )}
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  className="inline-flex items-center justify-center px-6 py-3 min-h-[44px] rounded-xl marketing-glass text-white font-semibold text-sm hover:border-[#F97316]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          )}
        </div>
        {visual && <div className="relative">{visual}</div>}
      </div>
    </MarketingSection>
  )
}
