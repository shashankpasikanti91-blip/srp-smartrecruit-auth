import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Zap, Users, Target, Rocket, Shield, Heart } from 'lucide-react'

const timeline = [
  { year: '2022', title: 'Founded', desc: 'SRP Recruit AI Labs was founded with a single mission: make hiring intelligent and bias-free.' },
  { year: '2023', title: 'AI Screening Launch', desc: 'Released the first LLM-powered resume ranking engine, cutting screening time by 80%.' },
  { year: '2024', title: 'All-in-One Platform', desc: 'Launched the full hiring suite — pipeline, analytics, outreach, and bulk processing.' },
  { year: '2025', title: 'Agentic AI', desc: 'Introduced autonomous AI agents that source candidates, schedule interviews, and surface insights without manual input.' },
  { year: '2026', title: 'Global Scale', desc: 'Serving 500+ companies across 30 countries. Powering 50,000+ hires and counting.' },
]

const values = [
  { icon: <Zap className="w-5 h-5" />, title: 'Move with urgency', desc: 'Great hires don\'t wait. Neither do we. Speed without sacrifice is our standard.' },
  { icon: <Shield className="w-5 h-5" />, title: 'Build for trust', desc: 'From GDPR to bias reduction, we earn trust by making it easy to do the right thing.' },
  { icon: <Target className="w-5 h-5" />, title: 'Be obsessively customer-led', desc: 'Every feature ships because a real recruiter told us they needed it. Not because we guessed.' },
  { icon: <Users className="w-5 h-5" />, title: 'One team, one mission', desc: 'We win together. Cross-functional by default, ego-free by choice.' },
  { icon: <Rocket className="w-5 h-5" />, title: 'Stay hungry', desc: 'We challenge the status quo daily. Comfortable is the enemy of excellent.' },
  { icon: <Heart className="w-5 h-5" />, title: 'Jobs find people', desc: 'Behind every hire is a family. We take the weight of that seriously.' },
]

const stats = [
  { value: '500+', label: 'Companies using SRP' },
  { value: '50K+', label: 'Candidates processed' },
  { value: '30', label: 'Countries served' },
  { value: '95%', label: 'Screening accuracy' },
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-6">
              About SRP Recruit AI Labs
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              We deliver your company's{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                most valuable asset.
              </span>{' '}
              People.
            </h1>
            <p className="text-gray-400 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed mb-10">
              Employees mean everything to your business and to ours. That's why we built our talent
              acquisition platform for the leaders and recruiters who need it most.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login"
                className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center gap-2 justify-center">
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/company/careers"
                className="px-6 py-3 rounded-lg border border-white/15 hover:border-white/30 text-gray-300 hover:text-white font-medium transition-all flex items-center gap-2 justify-center">
                We're hiring <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-white/5 bg-white/2">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-gray-500 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CEO Message */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-white/3 border border-white/8 rounded-2xl p-8 sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4">A message from our founders</p>
            <blockquote className="text-lg sm:text-xl text-gray-200 leading-relaxed italic mb-6">
              "Recruiting the right talent is no simple feat. The last thing you need is technology that
              makes it harder instead of easier. We spent years listening to recruiters, understanding their
              friction, and building the platform they actually asked for. This product doesn't belong to
              anyone at our company — it belongs to the professionals who connect people with jobs and
              change lives."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">S</div>
              <div>
                <p className="text-white font-semibold text-sm">Shashank Pasikanti</p>
                <p className="text-gray-500 text-xs">CEO &amp; Co-Founder, SRP Recruit AI Labs</p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Here's how we do it</h2>
            <p className="text-gray-400">The principles that guide every decision we make.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {values.map((v) => (
              <div key={v.title} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-indigo-500/30 transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-500/25 transition-colors">
                  {v.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="border-t border-white/5 bg-white/2">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Growing with the recruitment community</h2>
            </div>
            <div className="relative border-l border-indigo-500/30 pl-8 space-y-10">
              {timeline.map((t) => (
                <div key={t.year} className="relative">
                  <span className="absolute -left-[2.6rem] top-1 w-4 h-4 rounded-full bg-indigo-600 border-2 border-indigo-400 shadow-lg shadow-indigo-500/30" />
                  <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">{t.year}</p>
                  <h3 className="text-white font-semibold mb-1">{t.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Let's get together</h2>
          <p className="text-gray-400 mb-8">Whether you're looking to use our platform or help build it, we're excited to work with you.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login"
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg">
              Learn about our platform
            </Link>
            <Link href="/company/careers"
              className="px-6 py-3 rounded-lg border border-white/15 hover:border-white/30 text-gray-300 hover:text-white font-medium transition-all">
              Join our team
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
