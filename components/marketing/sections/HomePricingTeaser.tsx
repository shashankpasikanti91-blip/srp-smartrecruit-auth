import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { PRICING } from '@/content/marketing/homepage'
import MarketingSection from '@/components/marketing/ui/MarketingSection'
import ScrollReveal from '@/components/marketing/ui/ScrollReveal'

/** Homepage pricing teaser — full plans live on /pricing */
export default function HomePricingTeaser() {
  const featured = PRICING.plans.find((p) => p.highlighted) ?? PRICING.plans[2]

  return (
    <MarketingSection id="pricing" variant="mid">
      <ScrollReveal className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-3">{PRICING.eyebrow}</p>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4">{PRICING.title}</h2>
        <p className="text-slate-400">{PRICING.subtitle}</p>
      </ScrollReveal>

      <ScrollReveal>
        <div className="max-w-lg mx-auto marketing-glass rounded-2xl border-2 border-cyan-500/40 p-8 shadow-marketing-glow text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Most popular for agencies</span>
          <h3 className="text-2xl font-bold text-white mt-2">{featured.name}</h3>
          <p className="text-4xl font-extrabold text-white mt-2">
            {featured.price}
            <span className="text-base font-normal text-slate-500"> / {featured.period}</span>
          </p>
          <p className="text-sm text-slate-400 mt-3 mb-6">{featured.description}</p>
          <ul className="text-left space-y-2 mb-8">
            {featured.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={featured.ctaHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-sm btn-glow"
            >
              {featured.cta}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5"
            >
              Compare all plans <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>
      </ScrollReveal>
    </MarketingSection>
  )
}
