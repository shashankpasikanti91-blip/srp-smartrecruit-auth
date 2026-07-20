'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import GlowStage from '@/components/marketing/ui/GlowStage'
import CTABlock from '@/components/marketing/ui/CTABlock'

const timeline = [
  { year: '2022', title: 'Founded', desc: 'SRP AI Labs began building practical AI tools for high-volume recruiting.' },
  { year: '2024', title: 'Agency platform', desc: 'Pipeline boards, bulk screening, and client submission workflows.' },
  { year: '2026', title: 'Recruit AI flagship', desc: 'Premium recruitment intelligence for agency teams worldwide.' },
]

export default function AboutPageContent() {
  return (
    <>
      <CinematicSection variant="stage" minHeight="60vh" className="flex items-center pt-16">
        <GlowStage />
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-4">About SRP AI Labs</p>
          <h1 className="font-display text-display-xl font-extrabold text-white">We build AI products that respect recruiter judgment.</h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
            SRP Recruit AI is part of the SRP AI Labs ecosystem — helping agencies turn resume overload into ranked, review-ready shortlists.
          </p>
        </div>
      </CinematicSection>

      <CinematicSection variant="mid" className="py-20">
        <div className="max-w-2xl mx-auto px-4 space-y-8">
          {timeline.map((t) => (
            <div key={t.year} className="flex gap-6 border-l-2 border-cyan-500/30 pl-6">
              <span className="text-cyan-400 font-mono text-sm">{t.year}</span>
              <div>
                <p className="font-semibold text-white">{t.title}</p>
                <p className="text-sm text-slate-500 mt-1">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CinematicSection>

      <CinematicSection variant="bleed" className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center border border-violet-500/20 rounded-2xl p-10 bg-violet-500/[0.04]">
          <p className="text-white text-lg">This website reflects our design standard for premium AI product experiences.</p>
          <Link href="/features" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-cyan-400">
            Explore the platform <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </CinematicSection>

      <CTABlock
        title="Work with a team that understands agency hiring"
        subtitle="See how SRP Recruit AI supports bulk screening and client-ready shortlists."
        primary={{ label: 'Contact us', href: '/support/contact' }}
        secondary={{ label: 'View pricing', href: '/pricing' }}
      />
    </>
  )
}
