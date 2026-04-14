import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight } from 'lucide-react'

const capabilities = [
  {
    title: 'Agentic AI Screening',
    description: 'Upload a batch of resumes and get an AI-ranked shortlist in under 3 minutes. The engine reads full resume context — not just keywords.',
    metric: '< 3 min',
    metricLabel: 'per batch',
    gradient: 'from-indigo-950/60 to-purple-950/60',
    border: 'border-indigo-500/20',
  },
  {
    title: 'AI Email Composer',
    description: 'Draft personalized interview invites, rejections, and follow-ups in seconds. Rewrite, paraphrase, or reply to any candidate communication.',
    metric: '10×',
    metricLabel: 'faster outreach',
    gradient: 'from-cyan-950/50 to-blue-950/60',
    border: 'border-cyan-500/20',
  },
  {
    title: 'Pipeline Management',
    description: 'Move candidates through stages — New, Screening, Interview, Offer, Hired — with a visual Kanban board and full history tracking.',
    metric: 'Zero',
    metricLabel: 'manual effort',
    gradient: 'from-teal-950/50 to-green-950/60',
    border: 'border-teal-500/20',
  },
  {
    title: 'Bulk Resume Parsing',
    description: 'Process hundreds of resumes at once. The parser extracts structured data — skills, experience, education — into a searchable candidate database.',
    metric: '95%',
    metricLabel: 'extraction accuracy',
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
              What SRP Does
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Built to{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                replace manual screening.
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              See what SRP SmartRecruit can do for your hiring workflow.
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section className="border-y border-white/5 bg-white/2">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[['< 3 min', 'Screening time'], ['95%', 'AI accuracy'], ['Zero', 'Manual effort'], ['10×', 'Faster hiring']].map(([v, l]) => (
              <div key={l}><p className="text-2xl font-bold text-white">{v}</p><p className="text-gray-500 text-sm mt-1">{l}</p></div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-6">
          {capabilities.map((c) => (
            <div key={c.title} className={`bg-gradient-to-br ${c.gradient} border ${c.border} rounded-2xl p-8`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg mb-3">{c.title}</p>
                  <p className="text-gray-300 text-base leading-relaxed">{c.description}</p>
                </div>
                <div className="shrink-0 text-center sm:text-right">
                  <p className="text-4xl font-black text-white">{c.metric}</p>
                  <p className="text-gray-400 text-sm">{c.metricLabel}</p>
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
