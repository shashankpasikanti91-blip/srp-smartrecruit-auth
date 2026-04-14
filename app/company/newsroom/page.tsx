import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Download, Mail } from 'lucide-react'

const pressReleases = [
  {
    date: 'June 10, 2025',
    tag: 'Product',
    title: 'SRP Recruit AI Launches Autonomous Agentic Screening — AI That Hires Without Human Prompting',
    excerpt: 'The new Agentic AI engine continuously sources, ranks, and engages candidates in the background, surfacing hiring-ready shortlists on demand.',
  },
  {
    date: 'March 22, 2025',
    tag: 'Product',
    title: 'SRP Recruit AI Adds Agentic Email Composer — Draft, Rewrite, and Send Candidate Emails in Seconds',
    excerpt: 'The new AI-powered email tool generates personalized outreach, rejection, and interview invite emails directly from candidate profiles.',
  },
  {
    date: 'January 15, 2025',
    tag: 'Product',
    title: 'New Dashboard Experience: Pipeline View, Analytics, and Candidate Profiles in One Place',
    excerpt: 'A redesigned dashboard gives recruiters a unified view of jobs, candidates, screening results, and email history without switching tabs.',
  },
  {
    date: 'October 4, 2024',
    tag: 'Product',
    title: 'SRP Recruit AI Launches Agentic Screening Engine with 95%+ Match Accuracy',
    excerpt: 'Independent benchmarks confirm the platform\'s AI screening accuracy exceeds 95%, cutting manual review time by 10× for growing teams.',
  },
  {
    date: 'July 18, 2024',
    tag: 'Product',
    title: 'Introducing Bulk Resume Intelligence: Screen 1,000 Candidates in Under 60 Seconds',
    excerpt: 'New bulk processing engine pairs LLM ranking with structured JSON extraction for structured data at unprecedented speed.',
  },
]

const mediaContacts = [
  { role: 'Press inquiries', email: 'press@srpailabs.com' },
  { role: 'Partnership enquiries', email: 'partners@srpailabs.com' },
]

export default function NewsroomPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-20 overflow-hidden border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-4">
                Newsroom
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
                Latest from SRP Recruit AI
              </h1>
            </div>
            <Link href="/support/contact"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/15 hover:border-white/30 text-sm font-medium text-gray-300 hover:text-white transition-all">
              <Mail className="w-4 h-4" /> Media contact
            </Link>
          </div>
        </section>

        {/* Press Releases */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-4">
          {pressReleases.map((pr) => (
            <article key={pr.title} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-indigo-500/30 hover:bg-white/5 transition-all group cursor-pointer">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">{pr.tag}</span>
                    <span className="text-gray-600 text-xs">{pr.date}</span>
                  </div>
                  <h2 className="text-white font-semibold text-base sm:text-lg mb-2 group-hover:text-indigo-300 transition-colors">{pr.title}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed">{pr.excerpt}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 shrink-0 transition-colors" />
              </div>
            </article>
          ))}
        </section>

        {/* Media Kit + Contact */}
        <section className="border-t border-white/5 bg-white/2 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
              <h3 className="text-white font-bold text-lg mb-2">Media kit</h3>
              <p className="text-gray-500 text-sm mb-6">Download our logo pack, brand guidelines, executive headshots, and approved product screenshots.</p>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-gray-300 text-sm font-medium transition-all">
                <Download className="w-4 h-4" /> Download media kit
              </button>
            </div>
            <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
              <h3 className="text-white font-bold text-lg mb-2">Contact our media team</h3>
              <ul className="space-y-3 mb-6">
                {mediaContacts.map((c) => (
                  <li key={c.role} className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>
                      <span className="text-gray-400">{c.role}: </span>
                      <a href={`mailto:${c.email}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">{c.email}</a>
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/support/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all">
                Send a press enquiry <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
