import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CinematicSection from './CinematicSection'
import GlowStage from './GlowStage'

type EditorialPageHeroProps = {
  eyebrow: string
  title: string
  subtitle?: string
  titleLines?: string[]
  size?: 'editorial' | 'compact'
  eyebrowClassName?: string
  cta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}

export default function EditorialPageHero({
  eyebrow,
  title,
  subtitle,
  titleLines,
  size = 'editorial',
  eyebrowClassName = 'text-cyan-400',
  cta,
  secondaryCta,
}: EditorialPageHeroProps) {
  const titleClass =
    size === 'editorial'
      ? 'editorial-hero-title font-display font-extrabold text-white'
      : 'font-display text-display-lg font-extrabold text-white text-balance'

  return (
    <CinematicSection variant="stage" className="flex items-center pt-28 pb-12 lg:pb-16">
      <GlowStage />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 text-center">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] mb-4 lg:mb-6 ${eyebrowClassName}`}>
          {eyebrow}
        </p>
        <h1 className={titleClass}>
          {titleLines ? (
            <>
              {titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </>
          ) : (
            title
          )}
        </h1>
        {subtitle ? (
          <p className="mt-5 lg:mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
        ) : null}
        {(cta || secondaryCta) && (
          <div className="mt-8 lg:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            {cta && (
              <Link
                href={cta.href}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-sm btn-glow"
              >
                {cta.label}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="px-8 py-4 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </CinematicSection>
  )
}
