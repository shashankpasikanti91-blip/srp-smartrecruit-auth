import Link from 'next/link'
import { PRICING } from '@/content/marketing/homepage'

export default function QuietPricing() {
  return (
    <section id="pricing" className="bg-[#FCFCFA] py-20 sm:py-24 border-t border-[#E5E7EB]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#166534] font-semibold">{PRICING.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl text-[#111827] max-w-xl leading-tight">
          Pricing built for a Recruitment OS — not a cheap scanner.
        </h2>
        <p className="mt-4 text-[#4B5563] max-w-lg">{PRICING.subtitle}</p>
        {'currencyNote' in PRICING && PRICING.currencyNote ? (
          <p className="mt-2 text-xs text-[#6b7280] max-w-lg">{PRICING.currencyNote}</p>
        ) : null}
        <div className="mt-12 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PRICING.plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col border ${
                plan.highlighted
                  ? 'border-[#F97316] bg-white shadow-[0_12px_40px_rgba(11,31,20,0.08)]'
                  : 'border-[#E5E7EB] bg-white'
              }`}
            >
              {plan.highlighted && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#F97316] mb-2">Most desks</p>
              )}
              <h3 className="font-display text-2xl text-[#111827]">{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-[#0B1F14]">
                {plan.price}
                <span className="text-sm font-normal text-[#6b7280]"> / {plan.period}</span>
              </p>
              {'priceUsd' in plan && plan.priceUsd && plan.price !== 'Custom' && (
                <p className="text-xs text-[#6b7280] mt-1">Guide {plan.priceUsd}/mo</p>
              )}
              <p className="mt-2 text-sm text-[#4B5563] mb-5">{plan.description}</p>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-[#374151] pl-3 border-l-2 border-[#166534]/30">{f}</li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`block text-center py-3 min-h-[44px] rounded-full text-sm font-bold ${
                  plan.highlighted ? 'bg-[#F97316] text-[#0B1F14]' : 'bg-[#166534] text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
