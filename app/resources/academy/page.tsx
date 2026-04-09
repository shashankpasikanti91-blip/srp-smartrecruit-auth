import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, BookOpen, Play, Clock, Users } from 'lucide-react'

const courses = [
  {
    title: 'AI Recruiting Fundamentals',
    level: 'Beginner',
    duration: '2h 15m',
    lessons: 12,
    desc: 'Understand how LLMs, vector search, and AI scoring transform talent acquisition from first principles.',
  },
  {
    title: 'Mastering the SRP Dashboard',
    level: 'Beginner',
    duration: '1h 30m',
    lessons: 8,
    desc: 'Go from zero to confident — creating job posts, uploading resumes, reading AI scores in under 2 hours.',
  },
  {
    title: 'Bulk Screening at Scale',
    level: 'Intermediate',
    duration: '3h 00m',
    lessons: 15,
    desc: 'Process thousands of applications. Learn batching strategy, data cleanup, and using structured JSON output.',
  },
  {
    title: 'Building a Hiring Pipeline',
    level: 'Intermediate',
    duration: '2h 45m',
    lessons: 14,
    desc: 'Set up stage-based workflows, automate status updates, and integrate with your existing ATS or HRIS.',
  },
  {
    title: 'Agentic AI for Recruiters',
    level: 'Advanced',
    duration: '4h 00m',
    lessons: 20,
    desc: 'Deploy autonomous AI agents for sourcing, outreach, shortlisting, and post-interview analysis.',
  },
  {
    title: 'Analytics & Reporting Deep Dive',
    level: 'Advanced',
    duration: '2h 30m',
    lessons: 11,
    desc: 'Extract actionable insights from hiring data. Build dashboards for time-to-hire, funnel drop-off, and AI accuracy.',
  },
]

const levelColor: Record<string, string> = {
  Beginner: 'text-green-400 bg-green-400/10 border-green-400/20',
  Intermediate: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  Advanced: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export default function AcademyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20 mb-6">
              SRP Academy
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Become an AI‑powered{' '}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                recruiting expert.
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Self-paced video courses, interactive labs, and certification paths designed for
              modern recruiters and HR leaders.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-white/5 bg-white/2">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-3 gap-6 text-center">
            {[['6', 'Courses'], ['65+', 'Video lessons'], ['Free', 'For all users']].map(([v, l]) => (
              <div key={l}><p className="text-2xl font-bold text-white">{v}</p><p className="text-gray-500 text-sm mt-1">{l}</p></div>
            ))}
          </div>
        </section>

        {/* Courses */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <div key={c.title} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden hover:border-violet-500/30 hover:bg-white/5 transition-all group flex flex-col">
              <div className="bg-gradient-to-br from-violet-950/40 to-indigo-950/40 h-28 flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-violet-400/60" />
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${levelColor[c.level]}`}>{c.level}</span>
                </div>
                <h3 className="text-white font-semibold mb-2 group-hover:text-violet-300 transition-colors flex-1">{c.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-4">{c.desc}</p>
                <div className="flex items-center gap-4 text-gray-600 text-xs mt-auto">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration}</span>
                  <span className="flex items-center gap-1"><Play className="w-3 h-3" />{c.lessons} lessons</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start learning for free</h2>
          <p className="text-gray-400 mb-8">All Academy courses are included in every SRP Recruit AI plan.</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-lg hover:shadow-violet-500/30">
            Create free account <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  )
}
