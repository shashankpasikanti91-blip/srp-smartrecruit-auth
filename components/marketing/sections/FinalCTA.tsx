import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FINAL_CTA } from '@/content/marketing/homepage'

export default function FinalCTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 marketing-grid-bg">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden marketing-glass border border-cyan-500/20 p-10 md:p-14 text-center shadow-marketing-glow">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-violet-600/10 to-transparent pointer-events-none" aria-hidden />
          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4">
              {FINAL_CTA.title}
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">{FINAL_CTA.subtitle}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={FINAL_CTA.primary.href}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-marketing-navy font-bold text-sm hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {FINAL_CTA.primary.label}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href={FINAL_CTA.secondary.href}
                className="inline-flex items-center px-8 py-3.5 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {FINAL_CTA.secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
