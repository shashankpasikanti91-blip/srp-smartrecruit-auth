import { type ReactNode } from 'react'

type MarketingSectionProps = {
  id?: string
  children: ReactNode
  className?: string
  variant?: 'default' | 'grid' | 'mid' | 'gradient'
  padding?: 'default' | 'compact' | 'hero'
}

const VARIANTS = {
  default: 'bg-marketing-navy',
  grid: 'marketing-grid-bg',
  mid: 'bg-marketing-navy-mid',
  gradient: 'bg-gradient-to-b from-marketing-navy-mid to-marketing-navy',
}

const PADDING = {
  default: 'py-20 md:py-24',
  compact: 'py-14 md:py-16',
  hero: 'pt-28 pb-16 md:pt-32 md:pb-20',
}

export default function MarketingSection({
  id,
  children,
  className = '',
  variant = 'default',
  padding = 'default',
}: MarketingSectionProps) {
  return (
    <section id={id} className={`${VARIANTS[variant]} ${PADDING[padding]} px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto w-full">{children}</div>
    </section>
  )
}
