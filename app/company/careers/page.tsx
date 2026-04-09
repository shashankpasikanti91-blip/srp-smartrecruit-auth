import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArrowRight, Globe, Briefcase, Code, BarChart2, Headphones, Users, Heart, Coffee, Zap } from 'lucide-react'

const openRoles = [
  { title: 'Senior AI / ML Engineer', team: 'Engineering', location: 'Remote · Worldwide' },
  { title: 'Full Stack Engineer (Next.js, Python)', team: 'Engineering', location: 'Remote · Worldwide' },
  { title: 'Product Manager – Talent Intelligence', team: 'Product', location: 'Remote · APAC' },
  { title: 'Enterprise Account Executive', team: 'Sales', location: 'Remote · US/EU' },
  { title: 'Customer Success Manager', team: 'Customer Success', location: 'Remote · APAC/EU' },
  { title: 'AI/ML Researcher', team: 'Research', location: 'Remote · Worldwide' },
]

const perks = [
  { icon: <Globe className="w-5 h-5" />, title: '100% Remote', desc: 'Work from anywhere. We have teammates in 12 countries.' },
  { icon: <Briefcase className="w-5 h-5" />, title: 'Equity', desc: 'Every employee owns a stake in what we build.' },
  { icon: <Heart className="w-5 h-5" />, title: 'Health & Wellbeing', desc: 'Full medical, dental, vision, and mental health benefits.' },
  { icon: <Coffee className="w-5 h-5" />, title: 'Home Office Budget', desc: '$1,000 setup allowance and $50/mo co-working stipend.' },
  { icon: <Zap className="w-5 h-5" />, title: 'Learning Budget', desc: '$1,500/year for courses, conferences, and certifications.' },
  { icon: <Users className="w-5 h-5" />, title: 'Team Retreats', desc: 'Annual company offsite and quarterly team meetups.' },
]

const teamSizes = [
  { dept: 'Engineering & AI', icon: <Code className="w-4 h-4" /> },
  { dept: 'Product', icon: <BarChart2 className="w-4 h-4" /> },
  { dept: 'Sales & Marketing', icon: <Briefcase className="w-4 h-4" /> },
  { dept: 'Customer Success', icon: <Headphones className="w-4 h-4" /> },
]

export default function CareersPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 mb-6">
              Careers at SRP Recruit AI
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Help us change how the{' '}
              <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                world finds talent.
              </span>
            </h1>
            <p className="text-gray-400 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed mb-10">
              We're building the most intelligent talent acquisition platform on the planet.
              Join a team that moves fast, thinks big, and puts people first.
            </p>
            <a href="#open-roles"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all shadow-lg hover:shadow-purple-500/30">
              View open roles <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* Culture / Quote */}
        <section className="border-y border-white/5 bg-white/2 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <blockquote className="text-xl sm:text-2xl text-white font-medium leading-relaxed italic mb-6">
              "We don't hire for roles. We hire for impact. Every person here raises the bar."
            </blockquote>
            <p className="text-gray-500 text-sm">Culture at SRP Recruit AI Labs</p>
          </div>
        </section>

        {/* Perks */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Why work with us</h2>
            <p className="text-gray-400">We believe the best work happens when people feel supported, trusted, and excited.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {perks.map((p) => (
              <div key={p.title} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-purple-500/30 transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 mb-4 group-hover:bg-purple-500/25 transition-colors">
                  {p.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Teams */}
        <section className="border-t border-white/5 bg-white/2 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-white mb-8 text-center">Our teams</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {teamSizes.map((t) => (
                <div key={t.dept} className="bg-white/3 border border-white/8 rounded-xl p-5 flex flex-col items-center text-center gap-3 hover:border-white/15 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400">{t.icon}</div>
                  <p className="text-sm font-medium text-gray-300">{t.dept}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Roles */}
        <section id="open-roles" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Open roles</h2>
            <p className="text-gray-400">We're actively hiring across engineering, product, and go-to-market.</p>
          </div>
          <div className="space-y-3">
            {openRoles.map((r) => (
              <div key={r.title} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/3 border border-white/8 rounded-xl px-6 py-5 hover:border-indigo-500/30 hover:bg-white/5 transition-all group">
                <div>
                  <h3 className="text-white font-semibold group-hover:text-indigo-300 transition-colors">{r.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{r.team} · {r.location}</p>
                </div>
                <Link href="/support/contact"
                  className="shrink-0 flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                  Apply now <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
          <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-indigo-500/20 rounded-2xl p-10">
            <h2 className="text-2xl font-bold text-white mb-3">Don't see the right role?</h2>
            <p className="text-gray-400 mb-6">We're always interested in exceptional people. Send us a note and tell us how you'd like to contribute.</p>
            <Link href="/support/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/30">
              Get in touch <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
