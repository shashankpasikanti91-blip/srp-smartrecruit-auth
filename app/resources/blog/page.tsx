import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Clock, Tag } from 'lucide-react'

const posts = [
  {
    tag: 'AI Recruiting',
    date: 'June 12, 2025',
    readTime: '7 min',
    title: 'Why Traditional Boolean Search is Dead (And What Replaces It)',
    excerpt: "LLM-powered semantic matching understands intent and context — not keywords. Here's why your next search should never use AND/OR/NOT again.",
    featured: true,
  },
  {
    tag: 'Best Practices',
    date: 'May 28, 2025',
    readTime: '5 min',
    title: '10 Resume Screening Mistakes That Cost You Great Hires',
    excerpt: 'From over-relying on job title matches to ignoring transferable skills — avoid the biases that eliminate your best candidates before the first call.',
    featured: false,
  },
  {
    tag: 'Product',
    date: 'May 14, 2025',
    readTime: '4 min',
    title: 'New: Bulk Screening Now Supports 1,000 Resumes in Under 60 Seconds',
    excerpt: "We completely rewrote the processing pipeline. Here's what changed, how it scales, and what you can do with structured output now.",
    featured: false,
  },
  {
    tag: 'Industry',
    date: 'April 30, 2025',
    readTime: '8 min',
    title: 'The State of Talent Acquisition in 2025: AI Adoption Report',
    excerpt: "We surveyed 300+ HR leaders across APAC, US, and EU. 78% are now using AI tools for some part of their hiring funnel. Here's what's working.",
    featured: false,
  },
  {
    tag: 'Agentic AI',
    date: 'April 10, 2025',
    readTime: '6 min',
    title: 'Agentic Recruiting: When Your AI Finds Candidates Without Being Asked',
    excerpt: 'Autonomous agents that run continuously in the background, surface surprises, and create shortlists before you think to ask. The future is here.',
    featured: false,
  },
  {
    tag: 'Best Practices',
    date: 'March 20, 2025',
    readTime: '5 min',
    title: 'How to Write Job Descriptions That AI Can Actually Score Well',
    excerpt: 'JD quality directly affects your AI match scores. Use these templates and writing patterns to get better candidates surfaced, faster.',
    featured: false,
  },
]

const tagColor: Record<string, string> = {
  'AI Recruiting': 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  'Best Practices': 'text-green-400 bg-green-400/10 border-green-400/20',
  'Product': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'Industry': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'Agentic AI': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
}

export default function BlogPage() {
  const [featured, ...rest] = posts
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Header */}
        <section className="border-b border-white/5 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-4">
              Blog
            </span>
            <h1 className="text-4xl font-bold text-white">Insights for modern recruiters</h1>
          </div>
        </section>

        {/* Featured */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-indigo-500/20 rounded-2xl p-8 group hover:border-indigo-500/40 transition-all cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagColor[featured.tag] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>{featured.tag}</span>
              <span className="text-gray-600 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{featured.readTime} read</span>
              <span className="text-gray-600 text-xs">{featured.date}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">{featured.title}</h2>
            <p className="text-gray-400 leading-relaxed mb-4">{featured.excerpt}</p>
            <span className="inline-flex items-center gap-1 text-indigo-400 text-sm font-medium">Read article <ArrowRight className="w-4 h-4" /></span>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rest.map((p) => (
            <div key={p.title} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-indigo-500/30 hover:bg-white/5 transition-all group cursor-pointer flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagColor[p.tag] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>{p.tag}</span>
              </div>
              <h3 className="text-white font-semibold mb-2 group-hover:text-indigo-300 transition-colors flex-1">{p.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">{p.excerpt}</p>
              <div className="flex items-center gap-3 text-gray-600 text-xs mt-auto">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.readTime}</span>
                <span>{p.date}</span>
              </div>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  )
}
