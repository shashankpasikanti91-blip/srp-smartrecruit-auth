import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Layers, Globe, CheckCircle } from 'lucide-react'

const techPartners = [
  { name: 'Workday', category: 'HRIS', desc: 'Seamless bidirectional sync of candidate data with your Workday instance.' },
  { name: 'SAP SuccessFactors', category: 'HRIS', desc: 'Push hired candidates directly into SuccessFactors onboarding flows.' },
  { name: 'BambooHR', category: 'HRIS', desc: 'Auto-populate employee records the moment a candidate accepts an offer.' },
  { name: 'Greenhouse', category: 'ATS', desc: 'Two-way ATS sync — manage stages in either platform in real time.' },
  { name: 'Lever', category: 'ATS', desc: 'Leverage SRP AI scoring while keeping Lever as your system of record.' },
  { name: 'LinkedIn', category: 'Sourcing', desc: 'Import LinkedIn profiles and enrich them with SRP AI intelligence.' },
  { name: 'Slack', category: 'Collaboration', desc: 'Get candidate alerts, stage updates, and AI reports delivered to Slack.' },
  { name: 'Microsoft Teams', category: 'Collaboration', desc: 'Interview scheduling and candidate briefings inside Teams.' },
  { name: 'Zoom', category: 'Video', desc: 'One-click Zoom interview links with AI post-interview summaries.' },
]

const benefits = [
  'Priority access to new product features',
  'Co-marketing opportunities and joint case studies',
  'Dedicated partner integration support team',
  'Revenue share for qualified referrals',
  'Listed in the SRP partner directory',
]

export default function PartnersPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20 mb-6">
              Partner Ecosystem
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Hire faster with the tools{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                you already use.
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
              SRP Recruit AI integrates with the world's leading HRIS, ATS, sourcing, and collaboration
              platforms — so your hiring data flows freely, without copy-paste.
            </p>
            <Link href="/support/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-lg hover:shadow-cyan-500/30">
              Become a partner <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Integration Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center gap-3 mb-8">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Integration Partners</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {techPartners.map((p) => (
              <div key={p.name} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-cyan-500/30 hover:bg-white/5 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold">{p.name}</h3>
                  <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">{p.category}</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-600 text-sm mt-8">
            + dozens more via Zapier, Make, and custom webhooks
          </p>
        </section>

        {/* Partner Program */}
        <section className="border-t border-white/5 bg-white/2 py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 mb-4">
                <Globe className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Partner Program</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Grow your business with SRP</h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Whether you're a recruiter, consultant, staffing agency, or HR tech vendor — our partner
                program is designed to help you expand your offering and deliver more value to clients.
              </p>
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
              <h3 className="text-white font-semibold text-lg mb-2">Ready to partner with us?</h3>
              <p className="text-gray-500 text-sm mb-6">Tell us about your platform or agency and we'll set up a discovery call within 24 hours.</p>
              <Link href="/support/contact"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-lg">
                Apply to partner program <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
