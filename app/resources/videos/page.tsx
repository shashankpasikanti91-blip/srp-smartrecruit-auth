import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Play, Clock, Eye } from 'lucide-react'

const categories = ['All', 'Product Tours', 'Webinars', 'Tutorials', 'Customer Stories']

const videos = [
  {
    title: 'SRP Recruit AI — Full Platform Demo (2025)',
    cat: 'Product Tours',
    duration: '18:24',
    views: '12K',
    thumbnail: 'from-indigo-900 to-purple-900',
    desc: 'Complete walkthrough of all features: job posts, bulk screening, analytics, agentic AI, and pipeline management.',
  },
  {
    title: 'Getting Started: Your First AI-Screened Job in 10 Minutes',
    cat: 'Tutorials',
    duration: '9:47',
    views: '8.4K',
    thumbnail: 'from-blue-900 to-indigo-900',
    desc: 'Set up your first job post, upload resumes, and get an AI-ranked shortlist in under 10 minutes.',
  },
  {
    title: 'Agentic AI: How Autonomous Hiring Works',
    cat: 'Product Tours',
    duration: '14:03',
    views: '6.7K',
    thumbnail: 'from-purple-900 to-pink-900',
    desc: 'See the AI agent source candidates, score them, and surface a shortlist — without any manual input.',
  },
  {
    title: 'Webinar: AI Recruiting Trends in 2025 — Panel Discussion',
    cat: 'Webinars',
    duration: '54:18',
    views: '3.2K',
    thumbnail: 'from-slate-800 to-indigo-900',
    desc: 'Four HR leaders share how they transformed their talent pipeline using AI screening and automation.',
  },
  {
    title: 'Bulk Resume Processing: Upload 500 CVs, Rank in 60 Seconds',
    cat: 'Tutorials',
    duration: '11:22',
    views: '5.1K',
    thumbnail: 'from-cyan-900 to-blue-900',
    desc: 'Step-by-step bulk workflow demo: upload zip, configure scoring weights, export ranked CSV.',
  },
  {
    title: 'Customer Story: How FinanceWave Hired 80 Engineers in 30 Days',
    cat: 'Customer Stories',
    duration: '7:55',
    views: '2.9K',
    thumbnail: 'from-teal-900 to-green-900',
    desc: 'Their Head of TA walks through the exact workflow they used to hire 80 engineers at a fintech scale-up.',
  },
]

export default function VideosPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="py-20 border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 mb-5">
              Video Library
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">See SRP in action</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Product demos, tutorials, webinars, and customer stories — everything you need to hire faster.
            </p>
          </div>
        </section>

        {/* Filter tabs */}
        <section className="border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((c, i) => (
              <button key={c}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  i === 0
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((v) => (
            <div key={v.title} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden hover:border-blue-500/30 hover:bg-white/5 transition-all group cursor-pointer flex flex-col">
              <div className={`bg-gradient-to-br ${v.thumbnail} h-40 flex items-center justify-center relative`}>
                <div className="w-14 h-14 rounded-full bg-black/40 border border-white/20 flex items-center justify-center group-hover:bg-indigo-600/70 transition-all">
                  <Play className="w-6 h-6 text-white ml-1" />
                </div>
                <span className="absolute bottom-2 right-2 text-xs bg-black/60 px-2 py-0.5 rounded text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />{v.duration}
                </span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <span className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full w-fit mb-3">{v.cat}</span>
                <h3 className="text-white font-semibold text-sm mb-2 group-hover:text-blue-300 transition-colors flex-1">{v.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-3">{v.desc}</p>
                <div className="flex items-center gap-1 text-gray-600 text-xs mt-auto">
                  <Eye className="w-3.5 h-3.5" /><span>{v.views} views</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
          <h2 className="text-xl font-bold text-white mb-3">Want a live demo?</h2>
          <p className="text-gray-400 text-sm mb-6">Schedule a personalized walkthrough with our team.</p>
          <Link href="/support/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg">
            Book a demo <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  )
}
