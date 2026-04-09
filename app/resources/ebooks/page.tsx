import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Download, Lock, FileText } from 'lucide-react'

const ebooks = [
  {
    title: 'The Complete Guide to AI-Powered Recruiting in 2025',
    pages: '48 pages',
    category: 'Strategy',
    desc: 'A comprehensive playbook covering AI screening, agentic sourcing, bias mitigation, and measuring ROI on hiring tech.',
    free: true,
  },
  {
    title: 'How to Cut Time-to-Hire by 60% with Bulk Resume Screening',
    pages: '28 pages',
    category: 'How-to Guide',
    desc: 'Step-by-step walkthrough of setting up bulk screening workflows, parsing structured data, and automating candidate communication.',
    free: true,
  },
  {
    title: 'Job Description Templates That AI Can Score — 50 Ready-to-Use JDs',
    pages: '34 pages',
    category: 'Templates',
    desc: '50 professionally written job descriptions across tech, marketing, sales, operations, and HR — pre-formatted for SRP AI matching.',
    free: true,
  },
  {
    title: 'Enterprise Talent Intelligence: Moving Beyond ATS to AI-Native Hiring',
    pages: '56 pages',
    category: 'Enterprise',
    desc: 'For HR leaders managing 100+ hires/year. Covers integration architecture, change management, and analytics maturity models.',
    free: true,
  },
  {
    title: "2025 Recruiter's Handbook: Prompting AI to Surface Better Candidates",
    pages: '22 pages',
    category: 'AI Skills',
    desc: 'Hands-on guide to writing screening criteria, tuning match thresholds, and improving AI output quality through iteration.',
    free: true,
  },
  {
    title: 'Diversity Hiring in the AI Era: Reducing Bias While Increasing Speed',
    pages: '32 pages',
    category: 'DEI',
    desc: 'Research-backed strategies for using AI to reduce bias in job descriptions, screening, and pipeline management.',
    free: true,
  },
]

const catColor: Record<string, string> = {
  Strategy: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  'How-to Guide': 'text-green-400 bg-green-400/10 border-green-400/20',
  Templates: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  Enterprise: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'AI Skills': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  DEI: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
}

export default function EbooksPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="py-20 border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-5">
              Free eBooks & Guides
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Resources to hire smarter</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Practitioner-written guides, templates, and frameworks — free to download, no credit card required.
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ebooks.map((e) => (
            <div key={e.title} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden hover:border-indigo-500/30 hover:bg-white/5 transition-all group flex flex-col">
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950/30 h-32 flex items-center justify-center relative">
                <div className="w-16 h-20 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center shadow-2xl">
                  <FileText className="w-8 h-8 text-indigo-400/70" />
                </div>
                {e.free && (
                  <span className="absolute top-3 right-3 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">Free</span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColor[e.category] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>{e.category}</span>
                  <span className="text-gray-600 text-xs">{e.pages}</span>
                </div>
                <h3 className="text-white font-semibold text-sm mb-2 group-hover:text-indigo-300 transition-colors flex-1">{e.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-4">{e.desc}</p>
                <Link href="/login"
                  className="mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition-all">
                  <Download className="w-3.5 h-3.5" /> Download free
                </Link>
              </div>
            </div>
          ))}
        </section>

        {/* Note */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
            <Lock className="w-4 h-4" />
            <span>Downloads require a free SRP account. No credit card needed.</span>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
