import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Star, Quote } from 'lucide-react'

const stories = [
  {
    company: 'FinanceWave',
    industry: 'FinTech',
    size: '400 employees',
    result: '80 engineers hired in 30 days',
    metric: '-65%',
    metricLabel: 'time-to-hire',
    quote: "We were drowning in resumes. SRP's AI ranked 3,000 applications in 45 minutes and gave us a shortlist that was 92% accurate. Best hiring decision we ever made.",
    author: 'Priya Ramachandran',
    role: 'Head of Talent Acquisition',
    gradient: 'from-indigo-950/60 to-purple-950/60',
    border: 'border-indigo-500/20',
  },
  {
    company: 'BuildLoop',
    industry: 'Construction Tech',
    size: '150 employees',
    result: 'Hiring team reduced from 8 to 3',
    metric: '3×',
    metricLabel: 'throughput increase',
    quote: "I was skeptical about AI recruiting tools after bad experiences, but SRP's scoring is genuinely intelligent. It actually understands context, not just keywords.",
    author: 'James O\'Brien',
    role: 'COO',
    gradient: 'from-cyan-950/50 to-blue-950/60',
    border: 'border-cyan-500/20',
  },
  {
    company: 'MediBridge',
    industry: 'Healthcare Tech',
    size: '220 employees',
    result: '95% offer acceptance rate maintained',
    metric: '$180K',
    metricLabel: 'saved in agency fees',
    quote: "Healthcare hiring is complex — certifications, regulatory requirements, soft skills. SRP handles all of it. Our recruiters are doing strategic work now, not admin.",
    author: 'Dr. Aisha Mohammed',
    role: 'CHRO',
    gradient: 'from-teal-950/50 to-green-950/60',
    border: 'border-teal-500/20',
  },
  {
    company: 'RetailNova',
    industry: 'E-commerce',
    size: '600 employees',
    result: 'Seasonal hiring cycle cut from 6 weeks to 9 days',
    metric: '6K+',
    metricLabel: 'applications processed',
    quote: "We hire 200 seasonal staff every quarter. Before SRP, it took 6 weeks. Now it's 9 days. The bulk screening feature alone paid for itself in the first month.",
    author: 'Marcus Chen',
    role: 'VP People Operations',
    gradient: 'from-orange-950/50 to-red-950/60',
    border: 'border-orange-500/20',
  },
]

export default function CustomersPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-6">
              Customer Stories
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              From overwhelmed to{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                ahead of the game.
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Real results from the teams that changed how they hire.
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section className="border-y border-white/5 bg-white/2">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[['500+', 'Companies served'], ['50K+', 'Hires powered'], ['30', 'Countries'], ['95%', 'AI accuracy']].map(([v, l]) => (
              <div key={l}><p className="text-2xl font-bold text-white">{v}</p><p className="text-gray-500 text-sm mt-1">{l}</p></div>
            ))}
          </div>
        </section>

        {/* Stories */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-6">
          {stories.map((s) => (
            <div key={s.company} className={`bg-gradient-to-br ${s.gradient} border ${s.border} rounded-2xl p-8`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold">
                      {s.company[0]}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{s.company}</p>
                      <p className="text-gray-500 text-xs">{s.industry} · {s.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                  </div>
                  <div className="flex items-start gap-2 mb-4">
                    <Quote className="w-5 h-5 text-gray-600 shrink-0 mt-1" />
                    <p className="text-gray-200 text-base leading-relaxed italic">{s.quote}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{s.author}</p>
                  <p className="text-gray-500 text-xs">{s.role}, {s.company}</p>
                </div>
                <div className="shrink-0 text-center sm:text-right">
                  <p className="text-4xl font-black text-white">{s.metric}</p>
                  <p className="text-gray-400 text-sm">{s.metricLabel}</p>
                  <p className="text-gray-600 text-xs mt-1">{s.result}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Add your success story</h2>
          <p className="text-gray-400 mb-8">Start your free trial today. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login"
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg flex items-center gap-2 justify-center">
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/support/contact"
              className="px-6 py-3 rounded-lg border border-white/15 hover:border-white/30 text-gray-300 hover:text-white font-medium transition-all flex items-center gap-2 justify-center">
              Talk to sales <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
